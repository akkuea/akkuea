import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { getPilotWhitelistContractId } from '../config/contracts';
import { ConflictError, NotFoundError } from '../utils/errors';
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
      throw new NotFoundError('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new ConflictError('Request is already approved');
    }

    if (request.status === 'rejected') {
      throw new ConflictError('Cannot approve a rejected request');
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
      throw new NotFoundError('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new ConflictError('Cannot reject an already approved request');
    }

    if (request.status === 'rejected') {
      throw new ConflictError('Request is already rejected');
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
