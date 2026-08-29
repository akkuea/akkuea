import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { getPilotWhitelistContractId } from '../config/contracts';
import { stellarService } from './StellarService';
import { auditService } from './AuditService';

export class WhitelistService {
  /**
   * Approves a whitelist request in the database and submits the transaction to the C6-001 contract.
   *
   * @param requestId - UUID of the pilot_whitelist_requests row to approve.
   * @param actorWallet - Stellar public key of the operator performing the action.
   *   Recorded in the audit trail so there is an accountable identity for every approval.
   *   Falls back to 'system' if not provided (e.g. automated flows), though the review
   *   route requires it explicitly.
   */
  async approveRequest(requestId: string, actorWallet = 'system'): Promise<string> {
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

    const beforeValue = {
      status: request.status,
      reviewedAt: request.reviewedAt,
    };

    // Update database status
    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    const afterValue = {
      status: 'approved',
      reviewedAt: new Date(),
    };

    await auditService.logAction({
      actor: actorWallet,
      action: 'whitelist.approve',
      entityType: 'pilot_whitelist_request',
      entityId: requestId,
      beforeValue: beforeValue as unknown as Record<string, unknown>,
      afterValue: afterValue as unknown as Record<string, unknown>,
      metadata: {
        walletAddress: request.walletAddress,
        txHash,
      },
    });

    return txHash;
  }

  /**
   * Rejects a whitelist request, recording the reason in the database and the audit trail.
   *
   * @param requestId - UUID of the pilot_whitelist_requests row to reject.
   * @param reason - Human-readable rejection reason provided by the operator.
   * @param actorWallet - Stellar public key of the operator performing the action.
   *   Falls back to 'system' if not provided.
   */
  async rejectRequest(requestId: string, reason: string, actorWallet = 'system'): Promise<void> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new Error('Cannot reject an already approved request');
    }

    const beforeValue = {
      status: request.status,
      rejectionReason: request.rejectionReason,
      reviewedAt: request.reviewedAt,
    };

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    const afterValue = {
      status: 'rejected',
      rejectionReason: reason,
      reviewedAt: new Date(),
    };

    await auditService.logAction({
      actor: actorWallet,
      action: 'whitelist.reject',
      entityType: 'pilot_whitelist_request',
      entityId: requestId,
      beforeValue: beforeValue as unknown as Record<string, unknown>,
      afterValue: afterValue as unknown as Record<string, unknown>,
      metadata: {
        walletAddress: request.walletAddress,
        reason,
      },
    });
  }
}

export const whitelistService = new WhitelistService();
