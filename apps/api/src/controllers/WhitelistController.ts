import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests, type PilotWhitelistRequest } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import {
  reviewTurnaroundService,
  type ReviewMetricsResult,
} from '../services/ReviewTurnaroundService';
import type { MetricsWindowQuery } from '../services/reviewTurnaround';
import { BadRequestError, ConflictError } from '../utils/errors';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

export type WhitelistIdType = 'passport' | 'national_id' | 'drivers_license';

export interface RequestWhitelistBody {
  walletAddress: string;
  fullName: string;
  idType: WhitelistIdType;
  idReference: string;
}

export interface RequestContext {
  body: RequestWhitelistBody;
}

export interface ReviewContext {
  params: { id: string };
  body: {
    action: string;
    reason?: string;
  };
  headers?: Record<string, string | undefined>;
}

export interface RevokeContext {
  params: { id: string };
  body: {
    reason?: string;
  };
  headers?: Record<string, string | undefined>;
}

/** Minimal context shape consumed by WhitelistController.status. */
export interface StatusContext {
  params: { walletAddress: string };
  headers: Record<string, string | undefined>;
  getAuthenticatedUser?: () => Promise<{ id: string; walletAddress: string }>;
}

export class WhitelistController {
  static async request(ctx: RequestContext) {
    const { walletAddress, fullName, idType, idReference } = ctx.body;

    const active = await db.query.pilotWhitelistRequests.findFirst({
      where: and(
        eq(pilotWhitelistRequests.walletAddress, walletAddress),
        inArray(pilotWhitelistRequests.status, ['pending', 'approved']),
      ),
      orderBy: (requests, { desc }) => [desc(requests.createdAt), desc(requests.id)],
    });

    if (active) {
      if (active.status === 'pending') {
        throw new ConflictError('A whitelist request is already pending for this address');
      }
      if (active.status === 'approved') {
        throw new ConflictError('This address is already whitelisted');
      }
    }

    let inserted: PilotWhitelistRequest[];
    try {
      inserted = await db
        .insert(pilotWhitelistRequests)
        .values({
          walletAddress,
          fullName,
          idType,
          idReference,
          status: 'pending',
        })
        .returning();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictError('An active whitelist request already exists for this address');
      }
      throw error;
    }

    return { success: true, data: inserted[0] };
  }

  static async pending() {
    const requests = await db.query.pilotWhitelistRequests.findMany({
      where: eq(pilotWhitelistRequests.status, 'pending'),
      orderBy: (requests, { asc }) => [asc(requests.createdAt)],
    });

    return { success: true, data: requests };
  }

  static async metrics(query: MetricsWindowQuery = {}): Promise<{
    success: true;
    data: ReviewMetricsResult;
  }> {
    const data = await reviewTurnaroundService.getMetrics(query);
    return { success: true, data };
  }

  static async review(ctx: ReviewContext) {
    const { id } = ctx.params;
    const { action, reason } = ctx.body;
    const actor = ctx.headers?.['x-operator-wallet'];

    if (action === 'approve') {
      const txHash = await whitelistService.approveRequest(id, { actor, reason });
      return { success: true, txHash };
    }

    if (action === 'reject') {
      const trimmedReason = reason?.trim();
      if (!trimmedReason) {
        throw new BadRequestError('Rejection reason is required');
      }
      await whitelistService.rejectRequest(id, trimmedReason, { actor });
      return { success: true };
    }

    if (action === 'revoke') {
      const trimmedReason = reason?.trim();
      if (!trimmedReason) {
        throw new BadRequestError('Revocation reason is required');
      }
      const txHash = await whitelistService.revokeRequest(id, trimmedReason, { actor });
      return { success: true, txHash };
    }

    throw new BadRequestError('Invalid action');
  }

  static async revoke(ctx: RevokeContext) {
    const { id } = ctx.params;
    const trimmedReason = ctx.body.reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestError('Revocation reason is required');
    }
    const actor = ctx.headers?.['x-operator-wallet'];
    const txHash = await whitelistService.revokeRequest(id, trimmedReason, { actor });
    return { success: true, txHash };
  }

  static async status(ctx: StatusContext) {
    const { walletAddress } = ctx.params;
    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
      orderBy: (requests, { desc }) => [desc(requests.createdAt), desc(requests.id)],
    });

    if (!existing) {
      return { success: true, status: 'none' };
    }

    // Rejection and revocation reasons are operator notes and should only
    // reach the wallet owner or an authorized operator.
    const isOperator = isInternalOperationsAuthorized(ctx.headers);
    let isOwner = false;
    if (!isOperator) {
      try {
        const user = await ctx.getAuthenticatedUser?.();
        isOwner = user?.walletAddress === walletAddress;
      } catch {
        isOwner = false;
      }
    }

    if (!isOperator && !isOwner) {
      return { success: true, status: existing.status };
    }

    if (existing.status === 'revoked') {
      return {
        success: true,
        status: existing.status,
        reason: existing.revocationReason,
        revocationReason: existing.revocationReason,
      };
    }

    return {
      success: true,
      status: existing.status,
      rejectionReason: existing.rejectionReason,
    };
  }
}
