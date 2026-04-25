import type { PropertyInfo, ValuationRecord } from '@real-estate-defi/shared';
import { NotFoundError, ValidationError } from '@real-estate-defi/shared';
import { PropertyController } from './PropertyController';
import { propertyRepository, type PropertyReviewStatus } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { OracleService } from '../services/OracleService';
import type { Property } from '../db/schema';

export type OperationsQueue = 'pending' | 'approved' | 'rejected' | 'hold' | 'changes' | 'all';

export type ReviewAction = 'approve' | 'reject' | 'request_changes' | 'hold';

export interface OperationalPropertyListItem {
  id: string;
  name: string;
  propertyType: Property['propertyType'];
  city: string;
  country: string;
  reviewStatus: PropertyReviewStatus;
  verified: boolean;
  ownerWallet: string;
  ownerKycStatus: string;
  ownerKycTier: string;
  tokenized: boolean;
  sorobanPropertyId: number | null;
  valuationState: string;
  documentCount: number;
  readiness: {
    kycApproved: boolean;
    valuationActive: boolean;
    hasTokenAddress: boolean;
  };
  lastReviewedAt: string | null;
  lastReviewerWallet: string | null;
  lastReviewNote: string | null;
  listedAt: string;
}

export interface OperationalPropertyDetail extends PropertyInfo {
  reviewStatus: PropertyReviewStatus;
  lastReviewedAt: string | null;
  lastReviewerWallet: string | null;
  lastReviewNote: string | null;
  ownerKycStatus: string;
  ownerKycTier: string;
  valuation: {
    state: string;
    record?: ValuationRecord;
  };
  audit: {
    lastActionAt: string | null;
    lastActorWallet: string | null;
    lastNote: string | null;
  };
}

function queueToStatuses(queue: OperationsQueue): PropertyReviewStatus[] | undefined {
  switch (queue) {
    case 'pending':
      return ['pending_review'];
    case 'changes':
      return ['changes_requested'];
    case 'approved':
      return ['approved'];
    case 'rejected':
      return ['rejected'];
    case 'hold':
      return ['on_hold'];
    case 'all':
    default:
      return undefined;
  }
}

function valuationSummary(propertyId: string): { state: string; record?: ValuationRecord } {
  try {
    const record = OracleService.getLatestValuation(propertyId);
    if (record.status === 'manual_review') {
      return { state: 'manual_review', record };
    }
    if (record.status === 'rejected') {
      return { state: 'rejected', record };
    }
    if (record.status === 'stale') {
      return { state: 'stale', record };
    }
    return { state: 'active', record };
  } catch {
    return { state: 'missing' };
  }
}

export class OperationalPropertyController {
  static async listProperties(query: {
    queue?: OperationsQueue;
    page?: string | number;
    limit?: string | number;
  }): Promise<{
    data: OperationalPropertyListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page =
      typeof query.page === 'string' ? parseInt(query.page, 10) : Number(query.page) || 1;
    const limitRaw =
      typeof query.limit === 'string' ? parseInt(query.limit, 10) : Number(query.limit) || 20;
    const limit = limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const safePage = page > 0 ? page : 1;

    const queue = query.queue ?? 'pending';
    const reviewStatuses = queueToStatuses(queue);

    const result = await propertyRepository.findPaginated(
      { page: safePage, limit },
      reviewStatuses ? { reviewStatuses } : undefined,
    );

    const docCounts = await propertyRepository.countDocumentsByPropertyIds(
      result.data.map((p) => p.id),
    );

    const data: OperationalPropertyListItem[] = result.data.map((p) => {
      const wallet = p.ownerWalletAddress;
      const v = valuationSummary(p.id);
      const kycApproved = p.ownerKycStatus === 'approved';

      return {
        id: p.id,
        name: p.name,
        propertyType: p.propertyType,
        city: p.location.city,
        country: p.location.country,
        reviewStatus: p.reviewStatus,
        verified: p.verified,
        ownerWallet: wallet,
        ownerKycStatus: p.ownerKycStatus,
        ownerKycTier: p.ownerKycTier,
        tokenized: Boolean(p.tokenAddress),
        sorobanPropertyId: p.sorobanPropertyId ?? null,
        valuationState: v.state,
        documentCount: docCounts[p.id] ?? 0,
        readiness: {
          kycApproved,
          valuationActive: v.state === 'active',
          hasTokenAddress: Boolean(p.tokenAddress),
        },
        lastReviewedAt: p.lastReviewedAt?.toISOString() ?? null,
        lastReviewerWallet: p.lastReviewerWallet ?? null,
        lastReviewNote: p.lastReviewNote ?? null,
        listedAt: p.listedAt.toISOString(),
      };
    });

    return { data, pagination: result.pagination };
  }

  static async getPropertyDetail(id: string): Promise<OperationalPropertyDetail> {
    const base = await PropertyController.getProperty(id);
    const row = await propertyRepository.findById(id);
    if (!row) {
      throw new NotFoundError('Property', id);
    }

    const owner = await userRepository.findById(row.ownerId);
    const v = valuationSummary(id);

    return {
      ...base,
      reviewStatus: row.reviewStatus,
      lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
      lastReviewerWallet: row.lastReviewerWallet ?? null,
      lastReviewNote: row.lastReviewNote ?? null,
      ownerKycStatus: owner?.kycStatus ?? 'not_started',
      ownerKycTier: owner?.kycTier ?? 'none',
      valuation: v,
      audit: {
        lastActionAt: row.lastReviewedAt?.toISOString() ?? null,
        lastActorWallet: row.lastReviewerWallet ?? null,
        lastNote: row.lastReviewNote ?? null,
      },
    };
  }

  static async applyReviewAction(
    propertyId: string,
    body: { action: ReviewAction; note?: string; actorWallet: string },
  ): Promise<OperationalPropertyDetail> {
    const { action, note, actorWallet } = body;

    if (!actorWallet || actorWallet.length < 50) {
      throw new ValidationError('A valid operator wallet is required for audit logging', [
        { field: 'actorWallet', message: 'Invalid Stellar public key' },
      ]);
    }

    const property = await propertyRepository.findById(propertyId);
    if (!property) {
      throw new NotFoundError('Property', propertyId);
    }

    let reviewStatus: PropertyReviewStatus;
    let verified: boolean;

    switch (action) {
      case 'approve':
        reviewStatus = 'approved';
        verified = true;
        break;
      case 'reject':
        reviewStatus = 'rejected';
        verified = false;
        break;
      case 'request_changes':
        reviewStatus = 'changes_requested';
        verified = false;
        break;
      case 'hold':
        reviewStatus = 'on_hold';
        verified = false;
        break;
      default:
        throw new ValidationError('Unknown review action', [
          { field: 'action', message: 'Invalid action' },
        ]);
    }

    const updated = await propertyRepository.update(propertyId, {
      reviewStatus,
      verified,
      lastReviewNote: note?.trim() ? note.trim() : null,
      lastReviewedAt: new Date(),
      lastReviewerWallet: actorWallet,
    });

    if (!updated) {
      throw new NotFoundError('Property', propertyId);
    }

    return OperationalPropertyController.getPropertyDetail(propertyId);
  }
}
