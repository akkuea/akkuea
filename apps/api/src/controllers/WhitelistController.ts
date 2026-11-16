import { StrKey } from '@stellar/stellar-sdk';
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

export interface ReviewWhitelistBody {
  action: string;
  reason?: string;
}

export interface ReviewContext {
  params: { id: string };
  body: ReviewWhitelistBody;
}

/** Minimal context shape consumed by WhitelistController.status. */
export interface StatusContext {
  params: { walletAddress: string };
  headers: Record<string, string | undefined>;
  getAuthenticatedUser?: () => Promise<{ id: string; walletAddress: string }>;
}

export function isValidStellarWalletAddress(walletAddress: string): boolean {
  return StrKey.isValidEd25519PublicKey(walletAddress);
}

function assertValidStellarWalletAddress(walletAddress: string): void {
  if (!isValidStellarWalletAddress(walletAddress)) {
    throw new BadRequestError(
      'Invalid Stellar wallet address: expected a valid Ed25519 public key starting with G',
    );
  }
}

export class WhitelistController {
  static async request(ctx: RequestContext) {
    const { walletAddress, fullName, idType, idReference } = ctx.body;

    assertValidStellarWalletAddress(walletAddress);

    const trimmedName = fullName.trim();
    const trimmedReference = idReference.trim();
    if (!trimmedName) {
      throw new BadRequestError('Full name is required');
    }
    if (!trimmedReference) {
      throw new BadRequestError('ID reference is required');
    }

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
          fullName: trimmedName,
          idType,
          idReference: trimmedReference,
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

    if (action === 'approve') {
      const txHash = await whitelistService.approveRequest(id);
      return { success: true, txHash };
    }

    if (action === 'reject') {
      const trimmedReason = reason?.trim();
      if (!trimmedReason) {
        throw new BadRequestError('Rejection reason is required');
      }
      await whitelistService.rejectRequest(id, trimmedReason);
      return { success: true };
    }

    throw new BadRequestError('Invalid action');
  }

  static async status(ctx: StatusContext) {
    const { walletAddress } = ctx.params;
    assertValidStellarWalletAddress(walletAddress);

    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
      orderBy: (requests, { desc }) => [desc(requests.createdAt), desc(requests.id)],
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
