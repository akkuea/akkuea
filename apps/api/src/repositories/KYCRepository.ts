import { eq, and, asc } from 'drizzle-orm';
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
   */
  async updateUserKycStatus(
    userId: string,
    status: 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired',
  ): Promise<void> {
    await db
      .update(users)
      .set({ kycStatus: status, updatedAt: new Date() })
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
}

export const kycRepository = new KYCRepository();
