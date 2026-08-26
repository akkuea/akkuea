import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  pilotEscalationState,
  type PilotEscalationState,
  type NewPilotEscalationState,
} from '../db/schema';

export class PilotEscalationRepository {
  async findByContractId(contractId: string): Promise<PilotEscalationState | undefined> {
    const results = await db
      .select()
      .from(pilotEscalationState)
      .where(eq(pilotEscalationState.contractId, contractId))
      .limit(1);
    return results[0];
  }

  /**
   * Records that an escalation notification was (re-)sent for the given
   * contract's current breach, upserting on `contractId`.
   */
  async recordNotified(input: {
    contractId: string;
    lastMissedCycleId: string;
    consecutiveMissed: number;
    now?: Date;
  }): Promise<PilotEscalationState> {
    const now = input.now ?? new Date();
    const existing = await this.findByContractId(input.contractId);

    if (!existing) {
      const values: NewPilotEscalationState = {
        contractId: input.contractId,
        lastMissedCycleId: input.lastMissedCycleId,
        consecutiveMissed: input.consecutiveMissed,
        firstNotifiedAt: now,
        lastNotifiedAt: now,
      };
      const [created] = await db.insert(pilotEscalationState).values(values).returning();
      if (!created) throw new Error('Failed to create pilot escalation state');
      return created;
    }

    // A different (or larger) gap than the one we last notified on: this is
    // a fresh breach as far as dedup is concerned, so the "first notified"
    // clock resets.
    const isSameBreach = existing.lastMissedCycleId === input.lastMissedCycleId;

    const [updated] = await db
      .update(pilotEscalationState)
      .set({
        lastMissedCycleId: input.lastMissedCycleId,
        consecutiveMissed: input.consecutiveMissed,
        firstNotifiedAt: isSameBreach ? existing.firstNotifiedAt : now,
        lastNotifiedAt: now,
        updatedAt: now,
      })
      .where(eq(pilotEscalationState.contractId, input.contractId))
      .returning();

    if (!updated) throw new Error('Failed to update pilot escalation state');
    return updated;
  }

  /**
   * Clears dedup state once the ally is no longer in breach (evidence was
   * recorded for the most recent expected cycle), so a future gap is
   * treated as new.
   */
  async clear(contractId: string): Promise<void> {
    await db.delete(pilotEscalationState).where(eq(pilotEscalationState.contractId, contractId));
  }
}

export const pilotEscalationRepository = new PilotEscalationRepository();
