import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import {
  reviewTurnaroundService,
  type ReviewMetricsResult,
} from '../services/ReviewTurnaroundService';
import type { MetricsWindowQuery } from '../services/reviewTurnaround';
import { eq } from 'drizzle-orm';
import { ApiError } from '../errors/ApiError';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

/** Minimal context shape consumed by WhitelistController.status. */
interface StatusContext {
  params: { walletAddress: string };
  headers: Record<string, string | undefined>;
  getAuthenticatedUser?: () => Promise<{ id: string; walletAddress: string }>;
}

interface ReviewContext {
  params: { id: string };
  body: { action: 'approve' | 'reject'; reason?: string };
  headers?: Record<string, string | undefined>;
}

interface RevokeContext {
  params: { id: string };
  body: { reason?: string };
  headers?: Record<string, string | undefined>;
}

function extractOperatorActor(
  headers: Record<string, string | undefined> | undefined,
): string | undefined {
  const raw = headers?.['x-operator-wallet']?.trim();
  return raw && /^G[A-Z2-7]{55}$/.test(raw) ? raw : undefined;
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
        throw ApiError.conflict('A whitelist request is already pending for this address');
      }
      if (existing.status === 'approved') {
        throw ApiError.conflict('This address is already whitelisted');
      }
      // If previously rejected or revoked, allow re-submission: delete the old
      // record so the investor gets a clean slate. Audit log entries remain intact.
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
    const actorWallet = extractOperatorActor(ctx.headers);

    if (action === 'approve') {
      const trimmedReason = reason?.trim() || undefined;
      const txHash =
        actorWallet || trimmedReason
          ? await whitelistService.approveRequest(id, { actorWallet, reason: trimmedReason })
          : await whitelistService.approveRequest(id);
      return { success: true, txHash };
    }

    if (action === 'reject') {
      const trimmedReason = reason?.trim() ?? '';
      if (!trimmedReason) {
        throw ApiError.badRequest('Rejection reason is required');
      }
      if (actorWallet) {
        await whitelistService.rejectRequest(id, trimmedReason, { actorWallet });
      } else {
        await whitelistService.rejectRequest(id, trimmedReason);
      }
      return { success: true };
    }

    throw ApiError.badRequest('Invalid action');
  }

  static async revoke(ctx: RevokeContext) {
    const { id } = ctx.params;
    const trimmedReason = typeof ctx.body?.reason === 'string' ? ctx.body.reason.trim() : '';
    if (!trimmedReason) {
      throw ApiError.badRequest('Revocation reason is required');
    }

    const actorWallet = extractOperatorActor(ctx.headers);
    const txHash = actorWallet
      ? await whitelistService.revokeRequest(id, trimmedReason, { actorWallet })
      : await whitelistService.revokeRequest(id, trimmedReason);

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

    // Rejection and revocation reasons are operator notes explaining why an
    // investor failed review or was removed; they should only reach that
    // investor or an operator, not anyone who knows the wallet address.
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
      ...(existing.status === 'revoked' ? { revocationReason: existing.revocationReason } : {}),
    };
  }
}
