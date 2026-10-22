import type { PropertyInfo, ShareOwnership as SharedShareOwnership } from '@akkuea/shared';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  parseDecimalStringToBigInt,
  formatBigIntAsDecimalString,
} from '@akkuea/shared';
import { and, eq, gte, sql } from 'drizzle-orm';
import { logger } from '../services/logger';
import { db } from '../db';
import { ApiError } from '../errors/ApiError';
import { getPaymentTokenContractId } from '../config/contracts';
import { formatTokenUnits, PRICE_PER_SHARE_DECIMALS, purchaseTotalToTokenUnits } from '../utils/paymentAmount';
import { tokenizationService, type TokenizationResponse } from '../services/TokenizationService';
import { stellarService } from '../services/StellarService';
import {
  propertyRepository,
  type PropertyFilter,
  type PaginatedResult,
  type PropertyListRow,
} from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import {
  properties,
  shareOwnerships,
  transactions,
  type Property,
  type NewProperty,
  type PropertyDocument,
} from '../db/schema';
import { cacheService } from '../services/CacheService';
import { auditService } from '../services/AuditService';
import { MARKETPLACE_CACHE_PREFIX } from './MarketplaceController';

const PROPERTIES_CACHE_TTL = 30; // seconds
const PROPERTIES_CACHE_PREFIX = 'properties:list:';

// Invalidated together: a review-state change on update, or a delete, can
// change which properties the marketplace should list, not just the
// properties list itself.
async function invalidatePropertyCaches(): Promise<void> {
  await Promise.all([
    cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`),
    cacheService.invalidate(`${MARKETPLACE_CACHE_PREFIX}*`),
  ]);
}

/**
 * Fields that affect what a listing promises buyers (price, value, location,
 * type, images). Editing one of these on an already-approved property must
 * not silently keep it approved and listed.
 */
function touchesMaterialField(data: UpdatePropertyInput): boolean {
  return (
    data.pricePerShare !== undefined ||
    data.totalValue !== undefined ||
    data.location !== undefined ||
    data.propertyType !== undefined ||
    data.images !== undefined
  );
}

function touchesPriceOrValue(data: UpdatePropertyInput): boolean {
  return data.pricePerShare !== undefined || data.totalValue !== undefined;
}

function isTokenized(property: Property): boolean {
  return Boolean(property.tokenAddress) || property.sorobanPropertyId !== null;
}

function reviewAuditSnapshot(property: Property): Record<string, unknown> {
  return {
    reviewStatus: property.reviewStatus,
    verified: property.verified,
    pricePerShare: property.pricePerShare,
    totalValue: property.totalValue,
    location: property.location,
    propertyType: property.propertyType,
    images: property.images,
  };
}

/**
 * DTO for creating a property
 */
export interface CreatePropertyInput {
  name: string;
  description: string;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  location: {
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  totalValue: string; // Decimal as string for precision
  totalShares: number;
  pricePerShare: string; // Decimal as string for precision
  images: string[];
}

/**
 * Unsigned `purchase_shares` transaction the buyer must sign and submit.
 */
export interface PrepareBuySharesResponse {
  /** Simulated, unsigned XDR with the buyer as its source. */
  xdr: string;
  /** Tokenization contract the transaction invokes. */
  contractId: string;
  sorobanPropertyId: string;
  shares: number;
  /** Payment token the buyer pays with, in its contract address form. */
  paymentToken: string;
  /** Total price in payment token units (7 decimals) as a decimal string. */
  totalAmount: string;
}

/**
 * DTO for updating a property
 */
export interface UpdatePropertyInput {
  name?: string;
  description?: string;
  propertyType?: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  location?: {
    address?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  totalValue?: string; // Decimal as string for precision
  pricePerShare?: string; // Decimal as string for precision
  images?: string[];
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Maps database Property to shared PropertyInfo type
 */
async function mapPropertyToPropertyInfo(
  property: Property & { documents?: PropertyDocument[] },
  ownerAddress?: string,
): Promise<PropertyInfo> {
  let walletAddress = ownerAddress;
  if (walletAddress === undefined) {
    const owner = await userRepository.findById(property.ownerId);
    walletAddress = owner?.walletAddress ?? '';
  }

  return {
    id: property.id,
    name: property.name,
    description: property.description,
    propertyType: property.propertyType,
    location: property.location,
    totalValue: property.totalValue, // Already a string in DB
    tokenAddress: property.tokenAddress ?? undefined,
    totalShares: property.totalShares,
    availableShares: property.availableShares,
    pricePerShare: property.pricePerShare, // Already a string in DB
    images: property.images,
    documents: (property.documents ?? []).map((doc: PropertyDocument) => ({
      id: doc.id,
      type: doc.type,
      name: doc.name,
      url: doc.url,
      uploadedAt: doc.uploadedAt.toISOString(),
      verified: doc.verified,
    })),
    verified: property.verified,
    listedAt: property.listedAt.toISOString(),
    owner: walletAddress,
  };
}

function mapShareOwnershipToShared(
  ownership: typeof shareOwnerships.$inferSelect,
  ownerAddress: string,
): SharedShareOwnership {
  return {
    propertyId: ownership.propertyId,
    owner: ownerAddress,
    shares: ownership.shares,
    purchasePrice: ownership.purchasePrice,
    purchasedAt: ownership.purchasedAt.toISOString(),
    lastDividendClaimed: ownership.lastDividendClaimed?.toISOString(),
  };
}

// Caps `page` so the computed offset ((page - 1) * limit in
// PropertyRepository.findPaginated) cannot grow unbounded. At the max
// limit of 100 this allows scanning up to 1,000,000 rows deep, far beyond
// any realistic result set for this pilot.
export const MAX_PAGE = 10_000;

/**
 * Validates pagination parameters
 */
export function validatePagination(page: unknown, limit: unknown): { page: number; limit: number } {
  const pageNum =
    typeof page === 'string' ? parseInt(page, 10) : typeof page === 'number' ? page : 1;
  const limitNum =
    typeof limit === 'string' ? parseInt(limit, 10) : typeof limit === 'number' ? limit : 10;

  return {
    page: pageNum > 0 ? Math.min(pageNum, MAX_PAGE) : 1,
    limit: limitNum > 0 && limitNum <= 100 ? limitNum : 10,
  };
}

export class PropertyController {
  /**
   * Get properties with pagination and filters
   */
  static async getProperties(query?: {
    page?: string | number;
    limit?: string | number;
    ownerId?: string;
    city?: string;
    country?: string;
    propertyType?: string;
    minPricePerShare?: string | number;
    maxPricePerShare?: string | number;
    minAvailableShares?: string | number;
    hasAvailableShares?: string | boolean;
    verified?: string | boolean;
  }): Promise<PaginatedResponse<PropertyInfo>> {
    const startTime = Date.now();
    logger.info('Fetching properties', { operation: 'READ', entity: 'property' });

    try {
      const pagination = validatePagination(query?.page, query?.limit);

      const filter: PropertyFilter = {};

      if (query?.ownerId) filter.ownerId = query.ownerId;
      if (query?.city) filter.city = query.city;
      if (query?.country) filter.country = query.country;
      if (
        query?.propertyType &&
        ['residential', 'commercial', 'industrial', 'land', 'mixed'].includes(query.propertyType)
      ) {
        filter.propertyType = query.propertyType as PropertyFilter['propertyType'];
      }
      if (query?.minPricePerShare !== undefined) {
        filter.minPricePerShare = Number(query.minPricePerShare);
      }
      if (query?.maxPricePerShare !== undefined) {
        filter.maxPricePerShare = Number(query.maxPricePerShare);
      }
      if (query?.minAvailableShares !== undefined) {
        filter.minAvailableShares = Number(query.minAvailableShares);
      }
      if (query?.hasAvailableShares === 'true' || query?.hasAvailableShares === true) {
        filter.hasAvailableShares = true;
      }
      if (query?.verified === 'true' || query?.verified === true) {
        filter.verified = true;
      }

      // Build a stable cache key from pagination + filter params
      const cacheKey =
        `${PROPERTIES_CACHE_PREFIX}` +
        `${pagination.page}:${pagination.limit}:` +
        `${filter.ownerId ?? ''}:${filter.city ?? ''}:${filter.country ?? ''}:` +
        `${filter.propertyType ?? ''}:${filter.minPricePerShare ?? ''}:` +
        `${filter.maxPricePerShare ?? ''}:${filter.minAvailableShares ?? ''}:` +
        `${filter.hasAvailableShares ?? ''}:${filter.verified ?? ''}`;

      const cached = await cacheService.get<PaginatedResponse<PropertyInfo>>(cacheKey);
      if (cached) {
        logger.info('Properties served from cache', { operation: 'READ', entity: 'property' });
        return cached;
      }

      const result: PaginatedResult<PropertyListRow> = await propertyRepository.findPaginated(
        pagination,
        Object.keys(filter).length > 0 ? filter : undefined,
      );

      const mappedProperties = await Promise.all(
        result.data.map((row) => mapPropertyToPropertyInfo(row, row.ownerWalletAddress)),
      );

      const response: PaginatedResponse<PropertyInfo> = {
        data: mappedProperties,
        pagination: result.pagination,
      };

      await cacheService.set(cacheKey, response, PROPERTIES_CACHE_TTL);

      logger.info('Properties fetched successfully', {
        operation: 'READ',
        entity: 'property',
        count: mappedProperties.length,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch properties', { error, operation: 'READ', entity: 'property' });
      throw error;
    }
  }

  /**
   * Get a single property by ID
   */
  static async getProperty(id: string): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    logger.info('Fetching property', { operation: 'READ', entity: 'property', entityId: id });

    try {
      const property = await propertyRepository.findByIdWithDocuments(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      const propertyInfo = await mapPropertyToPropertyInfo(property);

      logger.info('Property fetched successfully', {
        operation: 'READ',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to fetch property', {
        error,
        operation: 'READ',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Create a new property
   */
  static async createProperty(
    data: CreatePropertyInput,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();
    logger.info('Creating property', {
      operation: 'CREATE',
      entity: 'property',
      userId: userAddress,
    });

    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Property name is required');
      }
      if (!data.description || data.description.length < 10) {
        throw new ValidationError('Description must be at least 10 characters');
      }
      if (!data.location) {
        throw new ValidationError('Location is required');
      }
      if (data.totalShares <= 0) {
        throw new ValidationError('Total shares must be positive');
      }
      const pricePerShare = parseFloat(data.pricePerShare);
      if (isNaN(pricePerShare) || pricePerShare <= 0) {
        throw new ValidationError('Price per share must be positive');
      }
      if (!data.images || data.images.length === 0) {
        throw new ValidationError('At least one image is required');
      }

      // Get or create user by wallet address
      const user = await userRepository.getOrCreateByWallet(userAddress);

      // Create property
      const newProperty: NewProperty = {
        name: data.name,
        description: data.description,
        propertyType: data.propertyType,
        location: data.location,
        totalValue: data.totalValue, // Already a string from validation
        totalShares: data.totalShares,
        availableShares: data.totalShares, // Initially all shares are available
        pricePerShare: data.pricePerShare, // Already a string from validation
        images: data.images,
        verified: false,
        ownerId: user.id,
      };

      const property = await propertyRepository.create(newProperty);
      const propertyInfo = await mapPropertyToPropertyInfo(property, userAddress);

      await cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`);

      logger.info('Property created successfully', {
        operation: 'CREATE',
        entity: 'property',
        entityId: property.id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to create property', { error, operation: 'CREATE', entity: 'property' });
      throw error;
    }
  }

  /**
   * Update an existing property
   */
  static async updateProperty(
    id: string,
    data: UpdatePropertyInput,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required');
    }

    if (!userAddress) {
      throw new AuthenticationError('User address is required for authentication');
    }

    logger.info('Updating property', {
      operation: 'UPDATE',
      entity: 'property',
      entityId: id,
      userId: userAddress,
    });

    try {
      // Check if property exists
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      // Verify ownership
      const owner = await userRepository.findById(property.ownerId);
      if (!owner || owner.walletAddress !== userAddress) {
        throw new AuthorizationError('You do not have permission to update this property');
      }

      // A tokenized property, or one with holders, already has investors
      // relying on the price and value they bought at; let other fields
      // (name, description, non-material edits) through but not these two.
      if (
        touchesPriceOrValue(data) &&
        (isTokenized(property) || (await propertyRepository.hasShareHolders(id)))
      ) {
        throw new ConflictError(
          'Cannot change pricePerShare or totalValue on a tokenized property or one with share holders',
        );
      }

      // Build update data
      const updateData: Partial<NewProperty> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.propertyType !== undefined) updateData.propertyType = data.propertyType;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.totalValue !== undefined) updateData.totalValue = data.totalValue; // Already a string
      if (data.pricePerShare !== undefined) updateData.pricePerShare = data.pricePerShare; // Already a string
      if (data.images !== undefined) updateData.images = data.images;

      // An owner editing a material field of an already-approved listing
      // demotes it back to pending_review rather than rejecting the edit
      // outright: it reuses the existing operator review queue instead of
      // a new terminal state, and still lets the owner fix a mistake
      // (e.g. a typo in the price) without being stuck.
      const wasApproved = property.reviewStatus === 'approved';
      if (wasApproved && touchesMaterialField(data)) {
        updateData.reviewStatus = 'pending_review';
        updateData.verified = false;
      }

      const updatedProperty = await propertyRepository.update(id, updateData);

      if (!updatedProperty) {
        throw new Error('Failed to update property');
      }

      const propertyInfo = await mapPropertyToPropertyInfo(updatedProperty, userAddress);

      if (wasApproved) {
        await auditService.logAction({
          actor: userAddress,
          action: 'property.owner_update',
          entityType: 'property',
          entityId: id,
          beforeValue: reviewAuditSnapshot(property),
          afterValue: reviewAuditSnapshot(updatedProperty),
        });
      }

      await invalidatePropertyCaches();

      logger.info('Property updated successfully', {
        operation: 'UPDATE',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to update property', {
        error,
        operation: 'UPDATE',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Delete a property
   */
  static async deleteProperty(id: string, userAddress: string): Promise<{ success: boolean }> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required');
    }

    if (!userAddress) {
      throw new AuthenticationError('User address is required for authentication');
    }

    logger.info('Deleting property', {
      operation: 'DELETE',
      entity: 'property',
      entityId: id,
      userId: userAddress,
    });

    try {
      // Check if property exists
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      // Verify ownership
      const owner = await userRepository.findById(property.ownerId);
      if (!owner || owner.walletAddress !== userAddress) {
        throw new AuthorizationError('You do not have permission to delete this property');
      }

      // Deleting a tokenized property, or one with holders, would either
      // orphan the on-chain token or hit the share_ownerships foreign key
      // (which has no cascade) and surface as an unhandled 500.
      if (isTokenized(property) || (await propertyRepository.hasShareHolders(id))) {
        throw new ConflictError('Cannot delete a tokenized property or one with share holders');
      }

      // Delete property
      const deleted = await propertyRepository.delete(id);

      if (!deleted) {
        throw new Error('Failed to delete property');
      }

      await invalidatePropertyCaches();

      logger.info('Property deleted successfully', {
        operation: 'DELETE',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete property', {
        error,
        operation: 'DELETE',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Tokenize a property on the blockchain
   * Note: This feature is planned for Cycle 2
   */
  static async tokenizeProperty(
    id: string,
    _data: unknown,
    userAddress?: string,
  ): Promise<TokenizationResponse> {
    return tokenizationService.tokenizeProperty(id, userAddress);
  }

  /**
   * Step 1 of buying shares: validate the buyer, the inventory and KYC, then
   * return an unsigned `purchase_shares` transaction with the buyer as its
   * source. The buyer signs it with their wallet and submits it themselves;
   * this method signs nothing and mints nothing.
   */
  static async prepareBuyShares(
    id: string,
    data: { buyer: string; shares: number },
    authenticatedAddress: string,
  ): Promise<PrepareBuySharesResponse> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    if (!data.buyer || data.buyer.trim().length === 0) {
      throw new AuthenticationError('Buyer wallet address is required');
    }

    if (data.buyer !== authenticatedAddress) {
      throw new AuthorizationError('Authenticated wallet does not match buyer address');
    }

    if (!Number.isInteger(data.shares) || data.shares <= 0) {
      throw new ValidationError('Shares must be a positive integer', [
        { field: 'shares', message: 'Shares must be a positive integer' },
      ]);
    }

    logger.info('Share purchase preparation attempted', {
      operation: 'BUY_SHARES_PREPARE',
      entity: 'property',
      entityId: id,
      userId: data.buyer,
      shares: data.shares,
    });

    try {
      const property = await propertyRepository.findById(id);
      if (!property) {
        throw new NotFoundError('Property', id);
      }

      if (property.availableShares < data.shares) {
        throw new ValidationError('Not enough shares available', [
          { field: 'shares', message: 'Requested shares exceed available inventory' },
        ]);
      }

      if (!property.tokenAddress || property.sorobanPropertyId === null) {
        throw new ValidationError('Property must be tokenized before shares can be purchased', [
          {
            field: 'id',
            message: 'Property must be tokenized on-chain before shares can be purchased',
          },
        ]);
      }

      const owner = await userRepository.findById(property.ownerId);
      if (!owner) {
        throw new NotFoundError('Property owner', property.ownerId);
      }

      const buyer = await userRepository.getOrCreateByWallet(data.buyer);
      if (buyer.kycStatus !== 'approved') {
        const msg =
          buyer.kycStatus === 'expired'
            ? 'Your KYC verification has expired. Please re-verify before purchasing shares.'
            : 'KYC verification must be approved before purchasing shares';
        throw new AuthorizationError(msg);
      }

      const paymentToken = getPaymentTokenContractId();
      if (!paymentToken) {
        throw ApiError.internal(
          'Payment token is not configured. Set PAYMENT_TOKEN_CONTRACT_ID or the network deployment artifact.',
        );
      }

      const { xdr, contractId } = await stellarService.preparePurchaseShares({
        contractId: property.tokenAddress,
        buyer: data.buyer,
        sorobanPropertyId: property.sorobanPropertyId,
        shares: data.shares,
        paymentToken,
      });

      const response: PrepareBuySharesResponse = {
        xdr,
        contractId,
        sorobanPropertyId: String(property.sorobanPropertyId),
        shares: data.shares,
        paymentToken,
        totalAmount: formatTokenUnits(
          purchaseTotalToTokenUnits(property.pricePerShare, data.shares),
        ),
      };

      logger.info('Share purchase transaction prepared', {
        operation: 'BUY_SHARES_PREPARE',
        entity: 'property',
        entityId: id,
        userId: data.buyer,
        shares: data.shares,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      logger.error('Failed to prepare share purchase', {
        error,
        operation: 'BUY_SHARES_PREPARE',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Step 2 of buying shares: verify a buyer-signed, buyer-submitted
   * `purchase_shares` transaction on-chain, and only then record it. Nothing
   * is written unless the transaction succeeded on the configured contract,
   * came from the authenticated buyer, bought this property, and emitted a
   * matching `SharePurchase` event. Confirming an already recorded hash
   * returns the recorded result instead of counting the purchase twice.
   */
  static async confirmBuyShares(
    id: string,
    data: { txHash: string },
    authenticatedAddress: string,
  ): Promise<{ transactionHash: string; newBalance: number }> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    if (!authenticatedAddress) {
      throw new AuthenticationError('Buyer wallet address is required for authentication');
    }

    if (!/^[0-9a-fA-F]{64}$/.test(data.txHash ?? '')) {
      throw new ValidationError('Transaction hash must be a 64-character hex string', [
        { field: 'txHash', message: 'Transaction hash must be a 64-character hex string' },
      ]);
    }

    logger.info('Share purchase confirmation attempted', {
      operation: 'BUY_SHARES_CONFIRM',
      entity: 'property',
      entityId: id,
      userId: authenticatedAddress,
    });

    try {
      const property = await propertyRepository.findById(id);
      if (!property) {
        throw new NotFoundError('Property', id);
      }

      if (!property.tokenAddress || property.sorobanPropertyId === null) {
        throw new ValidationError('Property must be tokenized before shares can be purchased', [
          {
            field: 'id',
            message: 'Property must be tokenized on-chain before shares can be purchased',
          },
        ]);
      }

      const verified = await stellarService.verifyPurchaseTransaction(
        data.txHash,
        property.tokenAddress,
      );

      if (
        verified.sourceAccount !== authenticatedAddress ||
        verified.call.buyer !== authenticatedAddress
      ) {
        throw new AuthorizationError('The transaction was not signed by the authenticated buyer');
      }

      if (verified.call.propertyId !== BigInt(property.sorobanPropertyId)) {
        throw new ValidationError('Transaction purchases shares of a different property', [
          { field: 'txHash', message: 'Transaction purchases shares of a different property' },
        ]);
      }

      const shares = verified.sharePurchase.shares;
      if (shares <= BigInt(0) || verified.call.amount !== shares) {
        throw new ValidationError('Transaction amount does not match the SharePurchase event', [
          { field: 'txHash', message: 'Transaction amount does not match the SharePurchase event' },
        ]);
      }

      const expectedCost = purchaseTotalToTokenUnits(property.pricePerShare, Number(shares));
      if (verified.sharePurchase.totalCost !== expectedCost) {
        throw new ValidationError(
          'SharePurchase event total cost does not match the property price',
          [
            {
              field: 'txHash',
              message: 'SharePurchase event total cost does not match the property price',
            },
          ],
        );
      }

      if (
        verified.sharePurchase.buyer !== authenticatedAddress ||
        verified.sharePurchase.propertyId !== String(property.sorobanPropertyId)
      ) {
        throw new ValidationError('SharePurchase event does not match this property and buyer', [
          { field: 'txHash', message: 'SharePurchase event does not match this property and buyer' },
        ]);
      }

      const sharesToRecord = Number(shares);
      const buyer = await userRepository.getOrCreateByWallet(authenticatedAddress);
      const paidAmount = formatTokenUnits(verified.sharePurchase.totalCost);
      const purchasePrice = formatBigIntAsDecimalString(
        parseDecimalStringToBigInt(property.pricePerShare, PRICE_PER_SHARE_DECIMALS) * shares,
        PRICE_PER_SHARE_DECIMALS,
      );

      const result = await db.transaction(async (tx) => {
        // The unique constraint on transactions.hash is the serialization
        // point: the first confirmation of a hash inserts the row, later ones
        // observe the conflict and leave the inventory untouched.
        const [inserted] = await tx
          .insert(transactions)
          .values({
            type: 'buy_shares',
            hash: verified.txHash,
            fromUserId: buyer.id,
            toUserId: property.ownerId,
            amount: paidAmount,
            asset: verified.call.paymentToken,
            status: 'confirmed',
            metadata: {
              propertyId: property.id,
              shares: sharesToRecord,
            },
          })
          .onConflictDoNothing({ target: transactions.hash })
          .returning({ id: transactions.id });

        if (!inserted) {
          return { recorded: false as const, newBalance: 0 };
        }

        // Conditional decrement: never oversell, even when the inventory check
        // at prepare time raced with another purchase.
        const [updatedProperty] = await tx
          .update(properties)
          .set({ availableShares: sql`${properties.availableShares} - ${sharesToRecord}` })
          .where(
            and(eq(properties.id, property.id), gte(properties.availableShares, sharesToRecord)),
          )
          .returning({ id: properties.id });

        if (!updatedProperty) {
          throw new ValidationError('Not enough shares available', [
            { field: 'shares', message: 'Requested shares exceed available inventory' },
          ]);
        }

        const [existingOwnership] = await tx
          .select()
          .from(shareOwnerships)
          .where(
            and(eq(shareOwnerships.propertyId, property.id), eq(shareOwnerships.ownerId, buyer.id)),
          )
          .limit(1);

        const ownership = existingOwnership
          ? (
              await tx
                .update(shareOwnerships)
                .set({
                  shares: existingOwnership.shares + sharesToRecord,
                  purchasePrice: formatBigIntAsDecimalString(
                    parseDecimalStringToBigInt(
                      existingOwnership.purchasePrice,
                      PRICE_PER_SHARE_DECIMALS,
                    ) +
                      parseDecimalStringToBigInt(purchasePrice, PRICE_PER_SHARE_DECIMALS),
                    PRICE_PER_SHARE_DECIMALS,
                  ),
                })
                .where(eq(shareOwnerships.id, existingOwnership.id))
                .returning()
            )[0]
          : (
              await tx
                .insert(shareOwnerships)
                .values({
                  propertyId: property.id,
                  ownerId: buyer.id,
                  shares: sharesToRecord,
                  purchasePrice,
                })
                .returning()
            )[0];

        if (!ownership) {
          throw new Error('Failed to persist share ownership');
        }

        return { recorded: true as const, newBalance: ownership.shares };
      });

      if (!result.recorded) {
        return this.readRecordedPurchase(data.txHash, property.id, buyer.id);
      }

      await cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`);

      logger.info('Share purchase confirmed', {
        operation: 'BUY_SHARES_CONFIRM',
        entity: 'property',
        entityId: id,
        userId: authenticatedAddress,
        shares: sharesToRecord,
        duration: Date.now() - startTime,
      });

      return {
        transactionHash: verified.txHash,
        newBalance: result.newBalance,
      };
    } catch (error) {
      logger.error('Failed to confirm share purchase', {
        error,
        operation: 'BUY_SHARES_CONFIRM',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Returns the result already recorded for a transaction hash, so confirming
   * the same hash twice yields the same answer without counting the purchase
   * again.
   */
  private static async readRecordedPurchase(
    txHash: string,
    propertyId: string,
    buyerId: string,
  ): Promise<{ transactionHash: string; newBalance: number }> {
    const [recorded] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.hash, txHash))
      .limit(1);

    const recordedPropertyId = (recorded?.metadata as { propertyId?: string } | null)?.propertyId;
    if (recordedPropertyId && recordedPropertyId !== propertyId) {
      throw new ApiError(409, 'CONFLICT', 'Transaction hash was already recorded for another purchase');
    }

    const [ownership] = await db
      .select()
      .from(shareOwnerships)
      .where(and(eq(shareOwnerships.propertyId, propertyId), eq(shareOwnerships.ownerId, buyerId)))
      .limit(1);

    return {
      transactionHash: txHash,
      newBalance: ownership?.shares ?? 0,
    };
  }

  /**
   * Get user's share ownership for a property
   * Note: This feature is planned for Cycle 2
   */
  static async getUserShares(id: string, owner: string): Promise<SharedShareOwnership | null> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    if (!owner || owner.trim().length === 0) {
      throw new ValidationError('Owner wallet address is required', [
        { field: 'owner', message: 'Owner wallet address is required' },
      ]);
    }

    logger.info('Share ownership lookup attempted', {
      operation: 'GET_SHARES',
      entity: 'property',
      entityId: id,
      userId: owner,
    });

    try {
      const property = await propertyRepository.findById(id);
      if (!property) {
        throw new NotFoundError('Property', id);
      }

      const user = await userRepository.findByWalletAddress(owner);
      if (!user) {
        return null;
      }

      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(and(eq(shareOwnerships.propertyId, id), eq(shareOwnerships.ownerId, user.id)))
        .limit(1);

      logger.info('Share ownership lookup completed', {
        operation: 'GET_SHARES',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return ownership ? mapShareOwnershipToShared(ownership, owner) : null;
    } catch (error) {
      logger.error('Failed to fetch share ownership', {
        error,
        operation: 'GET_SHARES',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }
}
