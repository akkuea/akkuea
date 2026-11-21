import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import {
  reviewTurnaroundService,
  type ReviewMetricsResult,
} from '../services/ReviewTurnaroundService';
import type { MetricsWindowQuery } from '../services/reviewTurnaround';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import { BadRequestError } from '../utils/errors';

/** Minimal context shape consumed by WhitelistController.status. */
interface StatusContext {
  params: { walletAddress: string };
  headers: Record<string, string | undefined>;
  getAuthenticatedUser?: () => Promise<{ id: string; walletAddress: string }>;
}

export class WhitelistController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async request(ctx: any) {
    const { walletAddress, fullName, idType, idReference } = ctx.body;

    // Check if a request already exists
    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
    });

    if (existing) {
      if (existing.status === 'pending') {
        throw new BadRequestError('A whitelist request is already pending for this address');
      }
      if (existing.status === 'approved') {
        throw new BadRequestError('This address is already whitelisted');
      }
      // If previously rejected or revoked, allow re-submission: delete the old record
      // so the investor gets a clean slate after fixing whatever was wrong.
      await db
        .delete(pilotWhitelistRequests)
        .where(eq(pilotWhitelistRequests.walletAddress, walletAddress));
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async review(ctx: any) {
    const { id } = ctx.params;
    const { action, reason } = ctx.body;
    const actor = ctx.headers?.['x-operator-wallet'];

    if (action === 'approve') {
      const txHash = actor
        ? await whitelistService.approveRequest(id, actor)
        : await whitelistService.approveRequest(id);
      return { success: true, txHash };
    } else if (action === 'reject') {
      if (!reason) {
        throw new BadRequestError('Rejection reason is required');
      }
      if (actor) {
        await whitelistService.rejectRequest(id, reason, actor);
      } else {
        await whitelistService.rejectRequest(id, reason);
      }
      return { success: true };
    } else if (action === 'revoke') {
      if (!reason) {
        throw new BadRequestError('Revocation reason is required');
      }
      const txHash = actor
        ? await whitelistService.revokeRequest(id, reason, actor)
        : await whitelistService.revokeRequest(id, reason);
      return { success: true, txHash };
    } else {
      throw new BadRequestError('Invalid action');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async revoke(ctx: any) {
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
    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
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
