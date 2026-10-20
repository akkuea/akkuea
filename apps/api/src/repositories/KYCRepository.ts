import { eq, and, asc, lte, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { kycDocuments, users, type KycDocument, type NewKycDocument } from '../db/schema/users';

type DocumentType =
  | 'passport'
  | 'national_id'
  | 'drivers_license'
  | 'proof_of_address'
  | 'bank_statement'
  | 'tax_document';
type DocumentStatus = 'pending' | 'approved' | 'rejected';

const notRemindedForCurrentExpiry = sql`${users.kycReminderSentFor} IS DISTINCT FROM ${users.kycExpiresAt}`;

export class KYCRepository {
  async findById(id: string): Promise<KycDocument | undefined> {
    const results = await db.select().from(kycDocuments).where(eq(kycDocuments.id, id)).limit(1);
    return results[0];
  }

  async findByUserId(userId: string): Promise<KycDocument[]> {
    return db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.userId, userId))
      .orderBy(asc(kycDocuments.uploadedAt));
  }

  async findByUserIdAndType(userId: string, type: DocumentType): Promise<KycDocument | undefined> {
    const results = await db
      .select()
      .from(kycDocuments)
      .where(and(eq(kycDocuments.userId, userId), eq(kycDocuments.type, type)))
      .limit(1);
    return results[0];
  }

  async create(data: NewKycDocument): Promise<KycDocument> {
    const results = await db.insert(kycDocuments).values(data).returning();
    const doc = results[0];
    if (!doc) throw new Error('Failed to create KYC document');
    return doc;
  }

  async update(
    id: string,
    data: Partial<
      Pick<KycDocument, 'status' | 'rejectionReason' | 'reviewedAt' | 'fileName' | 'fileUrl'>
    >,
  ): Promise<KycDocument | undefined> {
    const results = await db
      .update(kycDocuments)
      .set(data)
      .where(eq(kycDocuments.id, id))
      .returning();
    return results[0];
  }

  async updateStatus(
    documentId: string,
    status: DocumentStatus,
    rejectionReason?: string,
  ): Promise<KycDocument | undefined> {
    return this.update(documentId, {
      status,
      rejectionReason: status === 'rejected' ? (rejectionReason ?? null) : null,
      reviewedAt: new Date(),
    });
  }

  async delete(id: string): Promise<boolean> {
    const results = await db.delete(kycDocuments).where(eq(kycDocuments.id, id)).returning();
    return results.length > 0;
  }

  /**
   * Set user KYC status (not_started | pending | approved | rejected | expired).
   * Pass kycExpiresAt to set/clear the expiry timestamp; omit to leave it unchanged.
   * An approval with a new expiry clears the expiring-soon reminder marker, so
   * the new approval cycle gets its own reminder.
   */
  async updateUserKycStatus(
    userId: string,
    status: 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired',
    kycExpiresAt?: Date | null,
  ): Promise<void> {
    const startsApprovalCycle = status === 'approved' && kycExpiresAt !== undefined;
    await db
      .update(users)
      .set({
        kycStatus: status,
        ...(kycExpiresAt !== undefined ? { kycExpiresAt } : {}),
        ...(startsApprovalCycle ? { kycReminderSentFor: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUserKycStatus(
    userId: string,
  ): Promise<'not_started' | 'pending' | 'approved' | 'rejected' | 'expired' | undefined> {
    const results = await db
      .select({ kycStatus: users.kycStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return results[0]?.kycStatus;
  }

  /**
   * Find users whose approved KYC has already expired (kycExpiresAt <= now).
   */
  async findExpiredApprovedUsers(): Promise<{ id: string; kycExpiresAt: Date }[]> {
    const now = new Date();
    const results = await db
      .select({ id: users.id, kycExpiresAt: users.kycExpiresAt })
      .from(users)
      .where(
        and(
          eq(users.kycStatus, 'approved'),
          isNotNull(users.kycExpiresAt),
          lte(users.kycExpiresAt, now),
        ),
      );
    return results.filter((r): r is { id: string; kycExpiresAt: Date } => r.kycExpiresAt !== null);
  }

  /**
   * Find users whose approved KYC will expire within the given window and who
   * have not yet been reminded for that expiry (for reminder notifications).
   * Returns users where now <= kycExpiresAt <= now + windowMs.
   */
  async findUsersExpiringWithin(windowMs: number): Promise<{ id: string; kycExpiresAt: Date }[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + windowMs);
    const results = await db
      .select({ id: users.id, kycExpiresAt: users.kycExpiresAt })
      .from(users)
      .where(
        and(
          eq(users.kycStatus, 'approved'),
          isNotNull(users.kycExpiresAt),
          gte(users.kycExpiresAt, now),
          lte(users.kycExpiresAt, cutoff),
          notRemindedForCurrentExpiry,
        ),
      );
    return results.filter((r): r is { id: string; kycExpiresAt: Date } => r.kycExpiresAt !== null);
  }

  /**
   * Atomically record that the expiring-soon reminder is being sent for the
   * user's current kycExpiresAt. Returns false when it was already recorded,
   * so concurrent ticks or restarts never send the same reminder twice.
   */
  async claimKycReminder(userId: string): Promise<boolean> {
    const results = await db
      .update(users)
      .set({ kycReminderSentFor: sql`${users.kycExpiresAt}` })
      .where(
        and(
          eq(users.id, userId),
          eq(users.kycStatus, 'approved'),
          isNotNull(users.kycExpiresAt),
          notRemindedForCurrentExpiry,
        ),
      )
      .returning({ id: users.id });
    return results.length > 0;
  }

  /**
   * Undo claimKycReminder after the notification could not be created, so the
   * next tick retries it.
   */
  async releaseKycReminder(userId: string): Promise<void> {
    await db.update(users).set({ kycReminderSentFor: null }).where(eq(users.id, userId));
  }
}

export const kycRepository = new KYCRepository();
