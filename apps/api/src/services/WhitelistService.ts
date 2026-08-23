import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { getPilotWhitelistContractId } from '../config/contracts';
import { stellarService } from './StellarService';

export class WhitelistService {
  /**
   * Approves a whitelist request in the database and submits the transaction to the C6-001 contract.
   */
  async approveRequest(requestId: string): Promise<string> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new Error('Request is already approved');
    }

    const contractId = getPilotWhitelistContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw new Error('Whitelist contract or admin credentials not configured');
    }

    const txHash = await stellarService.submitWhitelistApprove(
      contractId,
      adminPublicKey,
      adminSecret,
      request.walletAddress,
    );

    // Update database status
    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    return txHash;
  }

  async rejectRequest(requestId: string, reason: string): Promise<void> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new Error('Cannot reject an already approved request');
    }

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));
  }
}

export const whitelistService = new WhitelistService();
