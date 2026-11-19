import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { getPilotWhitelistContractId } from '../config/contracts';
import { stellarService } from './StellarService';
import { auditService } from './AuditService';

export class WhitelistService {
  /**
   * Approves a whitelist request in the database and submits the transaction to the C6-001 contract.
   */
  async approveRequest(requestId: string, actor: string = 'system'): Promise<string> {
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
    const updated = await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId))
      .returning();

    await auditService.logAction({
      actor,
      action: 'whitelist.approve',
      entityType: 'pilot_whitelist_request',
      entityId: requestId,
      beforeValue: request as unknown as Record<string, unknown>,
      afterValue: (updated[0] ?? { ...request, status: 'approved' }) as unknown as Record<string, unknown>,
      metadata: {
        walletAddress: request.walletAddress,
        txHash,
      },
    });

    return txHash;
  }

  async rejectRequest(requestId: string, reason: string, actor: string = 'system'): Promise<void> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new Error('Cannot reject an already approved request');
    }

    const updated = await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId))
      .returning();

    await auditService.logAction({
      actor,
      action: 'whitelist.reject',
      entityType: 'pilot_whitelist_request',
      entityId: requestId,
      beforeValue: request as unknown as Record<string, unknown>,
      afterValue: (updated[0] ?? { ...request, status: 'rejected', rejectionReason: reason }) as unknown as Record<string, unknown>,
      metadata: {
        walletAddress: request.walletAddress,
        reason,
      },
    });
  }

  /**
   * Revokes an approved investor on-chain and updates the database record.
   * If on-chain submission fails, the database remains in 'approved' status.
   */
  async revokeRequest(requestId: string, reason: string, actor: string = 'system'): Promise<string> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Revocation reason is required');
    }

    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status !== 'approved') {
      throw new Error('Only approved requests can be revoked');
    }

    const contractId = getPilotWhitelistContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw new Error('Whitelist contract or admin credentials not configured');
    }

    // Submit on-chain first. If this throws, DB row remains approved.
    const txHash = await stellarService.submitWhitelistRevoke(
      contractId,
      adminPublicKey,
      adminSecret,
      request.walletAddress,
    );

    // Update database status
    const updated = await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'revoked',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId))
      .returning();

    await auditService.logAction({
      actor,
      action: 'whitelist.revoke',
      entityType: 'pilot_whitelist_request',
      entityId: requestId,
      beforeValue: request as unknown as Record<string, unknown>,
      afterValue: (updated[0] ?? { ...request, status: 'revoked', rejectionReason: reason }) as unknown as Record<string, unknown>,
      metadata: {
        walletAddress: request.walletAddress,
        reason,
        txHash,
      },
    });

    return txHash;
  }
}

export const whitelistService = new WhitelistService();
