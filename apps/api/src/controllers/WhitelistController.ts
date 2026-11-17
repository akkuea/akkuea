import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import {
  reviewTurnaroundService,
  type ReviewMetricsResult,
} from '../services/ReviewTurnaroundService';
import type { MetricsWindowQuery } from '../services/reviewTurnaround';
import { and, eq, inArray } from 'drizzle-orm';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import { BadRequestError, ConflictError } from '../utils/errors';
import { StrKey } from '@stellar/stellar-sdk';

/** Request payload for submitting a whitelist intake application. */
interface RequestBody {
  walletAddress: string;
  fullName: string;
  idType: 'passport' | 'national_id' | 'drivers_license';
  idReference: string;
}

interface RequestContext {
  body: RequestBody;
}

/** Operator review payload. */
interface ReviewBody {
  action: 'approve' | 'reject';
  reason?: string;
}

interface ReviewContext {
  params: { id: string };
  body: ReviewBody;
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

    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new BadRequestError('Invalid Stellar wallet address');
    }

    // Check if an active request already exists (pending or approved)
    const active = await db.query.pilotWhitelistRequests.findFirst({
      where: and(
        eq(pilotWhitelistRequests.walletAddress, walletAddress),
        inArray(pilotWhitelistRequests.status, ['pending', 'approved']),
      ),
    });

    if (active) {
      if (active.status === 'pending') {
        throw new ConflictError('A whitelist request is already pending for this address');
      }
      if (active.status === 'approved') {
        throw new ConflictError('This address is already whitelisted');
      }
    }

    // Allow re-submission after rejection without deleting historical records:
    // the previous rejected row is preserved in the database along with its reason.
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

    if (action === 'approve') {
      const txHash = await whitelistService.approveRequest(id);
      return { success: true, txHash };
    } else if (action === 'reject') {
      if (!reason || reason.trim() === '') {
        throw new BadRequestError('Rejection reason is required');
      }
      await whitelistService.rejectRequest(id, reason.trim());
      return { success: true };
    } else {
      throw new BadRequestError('Invalid action');
    }
  }

  static async status(ctx: StatusContext) {
    const { walletAddress } = ctx.params;

    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new BadRequestError('Invalid Stellar wallet address');
    }

    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
      orderBy: (requests, { desc: descOrder }) => [descOrder(requests.createdAt)],
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
