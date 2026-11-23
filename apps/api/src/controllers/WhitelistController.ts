import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import {
  reviewTurnaroundService,
  type ReviewMetricsResult,
} from '../services/ReviewTurnaroundService';
import type { MetricsWindowQuery } from '../services/reviewTurnaround';
import { BadRequestError, ConflictError } from '../utils/errors';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

/** Minimal context shape consumed by WhitelistController.request. */
interface RequestContext {
  body: {
    walletAddress: string;
    fullName: string;
    idType: 'passport' | 'national_id' | 'drivers_license';
    idReference: string;
  };
}

/** Minimal context shape consumed by WhitelistController.review. */
interface ReviewContext {
  params: { id: string };
  headers?: Record<string, string | undefined>;
  body: {
    action: 'approve' | 'reject' | 'revoke';
    reason?: string;
  };
}

/** Minimal context shape consumed by WhitelistController.revoke. */
interface RevokeContext {
  params: { id: string };
  headers?: Record<string, string | undefined>;
  body: {
    reason: string;
  };
}

/** Minimal context shape consumed by WhitelistController.status. */
interface StatusContext {
  params: { walletAddress: string };
  headers: Record<string, string | undefined>;
  getAuthenticatedUser?: () => Promise<{ id: string; walletAddress: string }>;
}

export class WhitelistController {
  static async request(ctx: RequestContext) {
    const { walletAddress, fullName, idType, idReference } = ctx.body;

    // Only the active request (pending or approved) blocks a new submission.
    // Rejected rows are kept so their rejection reason stays auditable.
    const active = await db.query.pilotWhitelistRequests.findFirst({
      where: and(
        eq(pilotWhitelistRequests.walletAddress, walletAddress),
        inArray(pilotWhitelistRequests.status, ['pending', 'approved']),
      ),
    });

    if (active?.status === 'pending') {
      throw new ConflictError('A whitelist request is already pending for this address');
    }
    if (active?.status === 'approved') {
      throw new ConflictError('This address is already whitelisted');
    }

    const inserted = await db
      .insert(pilotWhitelistRequests)
      .values({
        walletAddress,
        fullName,
        idType,
        idReference,
        status: 'pending',
      })
      .returning();

    return { success: true, data: inserted[0] };
  }

  static async pending() {
    // In a real app, verify ctx.user is an admin
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
      const txHash = actor
        ? await whitelistService.approveRequest(id, actor)
        : await whitelistService.approveRequest(id);
      return { success: true, txHash };
    }

    if (action === 'reject') {
      if (!reason) {
        throw new BadRequestError('Rejection reason is required');
      }
      if (actor) {
        await whitelistService.rejectRequest(id, reason, actor);
      } else {
        await whitelistService.rejectRequest(id, reason);
      }
      return { success: true };
    }

    if (action === 'revoke') {
      if (!reason) {
        throw new BadRequestError('Revocation reason is required');
      }
      const txHash = actor
        ? await whitelistService.revokeRequest(id, reason, actor)
        : await whitelistService.revokeRequest(id, reason);
      return { success: true, txHash };
    }

    throw new BadRequestError('Invalid action');
  }

  static async revoke(ctx: RevokeContext) {
    const { id } = ctx.params;
    const { reason } = ctx.body;
    const actor = ctx.headers?.['x-operator-wallet'];

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError('Revocation reason is required');
    }

    const txHash = actor
      ? await whitelistService.revokeRequest(id, reason, actor)
      : await whitelistService.revokeRequest(id, reason);
    return { success: true, txHash };
  }

  static async status(ctx: StatusContext) {
    const { walletAddress } = ctx.params;
    // A wallet can have several rows once a rejected request has been
    // resubmitted, so report the newest one rather than an arbitrary row.
    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
      orderBy: (requests, { desc }) => [desc(requests.createdAt)],
    });

    if (!existing) {
      return { success: true, status: 'none' };
    }

    // The rejection reason is an operator's note on why an investor failed
    // review; it should only reach that investor or an operator, not anyone
    // who knows the wallet address.
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

    return {
      success: true,
      status: existing.status,
      rejectionReason: existing.rejectionReason,
    };
  }
}
