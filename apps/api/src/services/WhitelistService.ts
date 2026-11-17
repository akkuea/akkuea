import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests, type PilotWhitelistRequest } from '../db/schema/pilotWhitelist';
import { getPilotWhitelistContractId } from '../config/contracts';
import { ApiError } from '../errors/ApiError';
import { auditService, type AuditService } from './AuditService';
import { stellarService } from './StellarService';

export interface WhitelistActionOptions {
  actorWallet?: string;
  reason?: string;
}

export interface WhitelistChainGateway {
  submitWhitelistApprove(
    contractId: string,
    adminPublicKey: string,
    adminSecret: string,
    walletAddress: string,
  ): Promise<string>;
  submitWhitelistRevoke(
    contractId: string,
    adminPublicKey: string,
    adminSecret: string,
    walletAddress: string,
  ): Promise<string>;
}

function isInvalidUuidDriverError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '22P02'
  );
}

function toAuditSnapshot(row: {
  status: string;
  rejectionReason?: string | null;
  revocationReason?: string | null;
  reviewedAt?: Date | null;
  revokedAt?: Date | null;
}): Record<string, unknown> {
  return {
    status: row.status,
    rejectionReason: row.rejectionReason ?? null,
    revocationReason: row.revocationReason ?? null,
    reviewedAt: row.reviewedAt ?? null,
    revokedAt: row.revokedAt ?? null,
  };
}

export class WhitelistService {
  constructor(
    private readonly audit: AuditService = auditService,
    private readonly chain: WhitelistChainGateway = stellarService,
  ) {}

  private async findRequestOrThrow(requestId: string): Promise<PilotWhitelistRequest> {
    let request: PilotWhitelistRequest | undefined;
    try {
      request = await db.query.pilotWhitelistRequests.findFirst({
        where: eq(pilotWhitelistRequests.id, requestId),
      });
    } catch (error) {
      if (isInvalidUuidDriverError(error)) {
        throw ApiError.notFound('Whitelist request not found');
      }
      throw error;
    }

    if (!request) {
      throw ApiError.notFound('Whitelist request not found');
    }

    return request;
  }

  private resolveContractConfig(): {
    contractId: string;
    adminPublicKey: string;
    adminSecret: string;
  } {
    const contractId = getPilotWhitelistContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw ApiError.internal('Whitelist contract or admin credentials not configured');
    }

    return { contractId, adminPublicKey, adminSecret };
  }

  /**
   * Submits `approve` on-chain first, then marks the request `approved` in the
   * database and records an audit entry.
   */
  async approveRequest(requestId: string, options?: WhitelistActionOptions): Promise<string> {
    const request = await this.findRequestOrThrow(requestId);

    if (request.status === 'approved') {
      throw ApiError.conflict('Request is already approved');
    }
    if (request.status !== 'pending') {
      throw ApiError.conflict(`Cannot approve a ${request.status} request`);
    }

    const { contractId, adminPublicKey, adminSecret } = this.resolveContractConfig();
    const beforeValue = toAuditSnapshot(request);

    let txHash: string;
    try {
      txHash = await this.chain.submitWhitelistApprove(
        contractId,
        adminPublicKey,
        adminSecret,
        request.walletAddress,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        502,
        'ON_CHAIN_SUBMISSION_FAILED',
        error instanceof Error ? error.message : 'Failed to approve whitelist request on-chain',
      );
    }

    const now = new Date();
    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'approved',
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    const trimmedReason = options?.reason?.trim() || null;
    await this.audit.logAction({
      actor: options?.actorWallet || 'system',
      action: 'whitelist.approve',
      entityType: 'pilot_whitelist_request',
      entityId: request.id,
      beforeValue,
      afterValue: toAuditSnapshot({
        status: 'approved',
        rejectionReason: request.rejectionReason,
        revocationReason: request.revocationReason,
        reviewedAt: now,
        revokedAt: request.revokedAt,
      }),
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
    options?: { actorWallet?: string },
  ): Promise<void> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw ApiError.badRequest('Rejection reason is required');
    }

    const request = await this.findRequestOrThrow(requestId);

    if (request.status === 'approved') {
      throw ApiError.conflict('Cannot reject an already approved request');
    }
    if (request.status !== 'pending') {
      throw ApiError.conflict(`Cannot reject a ${request.status} request`);
    }

    const beforeValue = toAuditSnapshot(request);
    const now = new Date();

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'rejected',
        rejectionReason: trimmedReason,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    await this.audit.logAction({
      actor: options?.actorWallet || 'system',
      action: 'whitelist.reject',
      entityType: 'pilot_whitelist_request',
      entityId: request.id,
      beforeValue,
      afterValue: toAuditSnapshot({
        status: 'rejected',
        rejectionReason: trimmedReason,
        revocationReason: request.revocationReason,
        reviewedAt: now,
        revokedAt: request.revokedAt,
      }),
      metadata: {
        walletAddress: request.walletAddress,
        reason: trimmedReason,
      },
    });
  }

  /**
   * Submits `revoke` to `pilot-whitelist` on-chain first, then sets the database
   * row to `revoked` with the operator's reason and timestamp and writes an
   * audit entry. If the on-chain call fails, the database row stays `approved`.
   */
  async revokeRequest(
    requestId: string,
    reason: string,
    options?: { actorWallet?: string },
  ): Promise<string> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw ApiError.badRequest('Revocation reason is required');
    }

    const request = await this.findRequestOrThrow(requestId);

    if (request.status === 'revoked') {
      throw ApiError.conflict('Request is already revoked');
    }
    if (request.status !== 'approved') {
      throw ApiError.conflict(`Cannot revoke a ${request.status} request`);
    }

    const { contractId, adminPublicKey, adminSecret } = this.resolveContractConfig();
    const beforeValue = toAuditSnapshot(request);

    let txHash: string;
    try {
      txHash = await this.chain.submitWhitelistRevoke(
        contractId,
        adminPublicKey,
        adminSecret,
        request.walletAddress,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        502,
        'ON_CHAIN_SUBMISSION_FAILED',
        error instanceof Error ? error.message : 'Failed to revoke whitelist approval on-chain',
      );
    }

    const now = new Date();
    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'revoked',
        revocationReason: trimmedReason,
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    await this.audit.logAction({
      actor: options?.actorWallet || 'system',
      action: 'whitelist.revoke',
      entityType: 'pilot_whitelist_request',
      entityId: request.id,
      beforeValue,
      afterValue: toAuditSnapshot({
        status: 'revoked',
        rejectionReason: request.rejectionReason,
        revocationReason: trimmedReason,
        reviewedAt: request.reviewedAt,
        revokedAt: now,
      }),
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
