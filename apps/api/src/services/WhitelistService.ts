import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests, type PilotWhitelistRequest } from '../db/schema/pilotWhitelist';
import { getPilotWhitelistContractId } from '../config/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { auditService } from './AuditService';
import { stellarService } from './StellarService';

export interface WhitelistAuditContext {
  actor?: string;
  reason?: string;
}

function snapshotWhitelistRow(row: PilotWhitelistRequest): Record<string, unknown> {
  return {
    status: row.status,
    rejectionReason: row.rejectionReason ?? null,
    revocationReason: row.revocationReason ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

function resolveActor(explicitActor?: string): string {
  const candidate = explicitActor?.trim() || process.env.STELLAR_ADMIN_PUBLIC_KEY?.trim();
  if (!candidate) return 'system';
  return candidate.slice(0, 56);
}

export class WhitelistService {
  /**
   * Approves a whitelist request on-chain first, updates the database row, and writes an audit entry.
   */
  async approveRequest(requestId: string, context: WhitelistAuditContext = {}): Promise<string> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new NotFoundError('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new ConflictError('Request is already approved');
    }

    if (request.status !== 'pending') {
      throw new ConflictError(`Cannot approve a request with status '${request.status}'`);
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

    const reviewedAt = new Date();
    const beforeValue = snapshotWhitelistRow(request);

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'approved',
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    const trimmedReason = context.reason?.trim() || null;
    await auditService.logAction({
      actor: resolveActor(context.actor),
      action: 'whitelist.approve',
      entityType: 'pilot_whitelist_request',
      entityId: request.id,
      beforeValue,
      afterValue: {
        ...beforeValue,
        status: 'approved',
        reviewedAt: reviewedAt.toISOString(),
      },
      metadata: {
        walletAddress: request.walletAddress,
        reason: trimmedReason,
        txHash,
      },
    });

    return txHash;
  }

  async rejectRequest(
    requestId: string,
    reason: string,
    context: WhitelistAuditContext = {},
  ): Promise<void> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new BadRequestError('Rejection reason is required');
    }

    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new NotFoundError('Whitelist request not found');
    }

    if (request.status !== 'pending') {
      throw new ConflictError(`Cannot reject a request with status '${request.status}'`);
    }

    const reviewedAt = new Date();
    const beforeValue = snapshotWhitelistRow(request);

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'rejected',
        rejectionReason: trimmedReason,
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    await auditService.logAction({
      actor: resolveActor(context.actor),
      action: 'whitelist.reject',
      entityType: 'pilot_whitelist_request',
      entityId: request.id,
      beforeValue,
      afterValue: {
        ...beforeValue,
        status: 'rejected',
        rejectionReason: trimmedReason,
        reviewedAt: reviewedAt.toISOString(),
      },
      metadata: {
        walletAddress: request.walletAddress,
        reason: trimmedReason,
      },
    });
  }

  /**
   * Revokes an approved investor on-chain first, then updates the database row to `revoked`
   * with reason and timestamp, and records an audit log entry.
   */
  async revokeRequest(
    requestId: string,
    reason: string,
    context: WhitelistAuditContext = {},
  ): Promise<string> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new BadRequestError('Revocation reason is required');
    }

    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new NotFoundError('Whitelist request not found');
    }

    if (request.status !== 'approved') {
      throw new ConflictError(
        `Only approved whitelist requests can be revoked (current status: '${request.status}')`,
      );
    }

    const contractId = getPilotWhitelistContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw new Error('Whitelist contract or admin credentials not configured');
    }

    const txHash = await stellarService.submitWhitelistRevoke(
      contractId,
      adminPublicKey,
      adminSecret,
      request.walletAddress,
    );

    const revokedAt = new Date();
    const beforeValue = snapshotWhitelistRow(request);

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'revoked',
        revocationReason: trimmedReason,
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    await auditService.logAction({
      actor: resolveActor(context.actor),
      action: 'whitelist.revoke',
      entityType: 'pilot_whitelist_request',
      entityId: request.id,
      beforeValue,
      afterValue: {
        ...beforeValue,
        status: 'revoked',
        revocationReason: trimmedReason,
        revokedAt: revokedAt.toISOString(),
      },
      metadata: {
        walletAddress: request.walletAddress,
        reason: trimmedReason,
        txHash,
      },
    });

    return txHash;
  }
}

export const whitelistService = new WhitelistService();
