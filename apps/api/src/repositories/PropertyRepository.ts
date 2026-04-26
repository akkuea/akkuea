import { eq, and, gte, lte, gt, sql, inArray, getTableColumns, type SQL } from 'drizzle-orm';
import { db } from '../db';
import {
  properties,
  propertyDocuments,
  users,
  type Property,
  type NewProperty,
  type PropertyDocument,
  type NewPropertyDocument,
} from '../db/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Filter options for querying properties
 */
export type PropertyReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'on_hold';

export interface PropertyFilter {
  ownerId?: string;
  city?: string;
  country?: string;
  propertyType?: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  minPricePerShare?: number;
  maxPricePerShare?: number;
  minAvailableShares?: number;
  hasAvailableShares?: boolean;
  verified?: boolean;
  reviewStatuses?: PropertyReviewStatus[];
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Property row from paginated list queries with owner joined from `users` (avoids N+1). */
export type PropertyListRow = Property & {
  ownerWalletAddress: string;
  ownerKycStatus: (typeof users.$inferSelect)['kycStatus'];
  ownerKycTier: (typeof users.$inferSelect)['kycTier'];
};

export class PropertyRepository extends BaseRepository<typeof properties, Property, NewProperty> {
  constructor() {
    super(properties);
  }

  /**
   * Find property by ID with documents
   */
  async findByIdWithDocuments(
    id: string,
  ): Promise<(Property & { documents: PropertyDocument[] }) | undefined> {
    const property = await this.findById(id);
    if (!property) return undefined;

    const documents = await db
      .select()
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, id));

    return { ...property, documents };
  }

  /**
   * Find properties by owner ID
   */
  async findByOwner(ownerId: string): Promise<Property[]> {
    return db.select().from(properties).where(eq(properties.ownerId, ownerId));
  }

  /**
   * Find properties with filters
   */
  async findWithFilters(filter: PropertyFilter): Promise<Property[]> {
    const conditions = this.buildFilterConditions(filter);

    if (conditions.length === 0) {
      return this.findAll();
    }

    return db
      .select()
      .from(properties)
      .where(and(...conditions));
  }

  /**
   * Find properties with pagination and filters
   */
  async findPaginated(
    options: PaginationOptions,
    filter?: PropertyFilter,
  ): Promise<PaginatedResult<PropertyListRow>> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions = filter ? this.buildFilterConditions(filter) : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const data = await db
      .select({
        ...getTableColumns(properties),
        ownerWalletAddress: users.walletAddress,
        ownerKycStatus: users.kycStatus,
        ownerKycTier: users.kycTier,
      })
      .from(properties)
      .innerJoin(users, eq(properties.ownerId, users.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if property exists
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.findById(id);
    return !!result;
  }

  /**
   * Update available shares (e.g., after a purchase)
   */
  async updateAvailableShares(
    id: string,
    newAvailableShares: number,
  ): Promise<Property | undefined> {
    if (newAvailableShares < 0) {
      throw new Error('Available shares cannot be negative');
    }

    const results = await db
      .update(properties)
      .set({ availableShares: newAvailableShares })
      .where(eq(properties.id, id))
      .returning();

    return results[0];
  }

  /**
   * Set token address after tokenization
   */
  async setTokenAddress(id: string, tokenAddress: string): Promise<Property | undefined> {
    const results = await db
      .update(properties)
      .set({ tokenAddress })
      .where(eq(properties.id, id))
      .returning();

    return results[0];
  }

  /**
   * Allocate the next on-chain property ID from the database sequence.
   * Gaps are acceptable if a blockchain transaction fails after allocation.
   */
  async allocateSorobanPropertyId(): Promise<number> {
    const [result] = await db.execute<{ soroban_property_id: number }>(
      sql`SELECT nextval('properties_soroban_property_id_seq')::bigint AS soroban_property_id`,
    );

    if (!result?.soroban_property_id) {
      throw new Error('Failed to allocate Soroban property ID');
    }

    return Number(result.soroban_property_id);
  }

  /**
   * Persist tokenization details after a successful blockchain transaction.
   */
  async setTokenizationResult(
    id: string,
    data: { tokenAddress: string; sorobanPropertyId: number },
  ): Promise<Property | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return db.transaction(async (tx: any) => {
      const [property] = await tx.select().from(properties).where(eq(properties.id, id)).limit(1);

      if (!property) {
        return undefined;
      }

      if (property.tokenAddress || property.sorobanPropertyId !== null) {
        return property;
      }

      const results = await tx
        .update(properties)
        .set({
          tokenAddress: data.tokenAddress,
          sorobanPropertyId: data.sorobanPropertyId,
        })
        .where(eq(properties.id, id))
        .returning();

      return results[0];
    });
  }

  /**
   * Document counts per property (for operations queue summaries)
   */
  async countDocumentsByPropertyIds(propertyIds: string[]): Promise<Record<string, number>> {
    if (propertyIds.length === 0) {
      return {};
    }

    const rows = await db
      .select({
        propertyId: propertyDocuments.propertyId,
        count: sql<number>`count(*)::int`,
      })
      .from(propertyDocuments)
      .where(inArray(propertyDocuments.propertyId, propertyIds))
      .groupBy(propertyDocuments.propertyId);

    return Object.fromEntries(
      rows.map((r: { propertyId: string; count: number }) => [r.propertyId, r.count]),
    );
  }

  /**
   * Verify a property
   */
  async verify(id: string): Promise<Property | undefined> {
    const results = await db
      .update(properties)
      .set({ verified: true, reviewStatus: 'approved' })
      .where(eq(properties.id, id))
      .returning();

    return results[0];
  }

  /**
   * Get count of properties matching filter
   */
  async countWithFilter(filter?: PropertyFilter): Promise<number> {
    const conditions = filter ? this.buildFilterConditions(filter) : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(whereClause);

    return result[0]?.count ?? 0;
  }

  /**
   * Add a document to a property
   */
  async addDocument(document: NewPropertyDocument): Promise<PropertyDocument> {
    const results = await db.insert(propertyDocuments).values(document).returning();

    const result = results[0];
    if (!result) {
      throw new Error('Failed to create document');
    }
    return result;
  }

  /**
   * Get documents for a property
   */
  async getDocuments(propertyId: string): Promise<PropertyDocument[]> {
    return db.select().from(propertyDocuments).where(eq(propertyDocuments.propertyId, propertyId));
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    const results = await db
      .delete(propertyDocuments)
      .where(eq(propertyDocuments.id, documentId))
      .returning();

    return results.length > 0;
  }

  /**
   * Verify a document
   */
  async verifyDocument(documentId: string): Promise<PropertyDocument | undefined> {
    const results = await db
      .update(propertyDocuments)
      .set({ verified: true })
      .where(eq(propertyDocuments.id, documentId))
      .returning();

    return results[0];
  }

  /**
   * Build SQL conditions from filter object
   */
  private buildFilterConditions(filter: PropertyFilter): SQL[] {
    const conditions: SQL[] = [];

    if (filter.ownerId) {
      conditions.push(eq(properties.ownerId, filter.ownerId));
    }

    if (filter.propertyType) {
      conditions.push(eq(properties.propertyType, filter.propertyType));
    }

    if (filter.verified !== undefined) {
      conditions.push(eq(properties.verified, filter.verified));
    }

    if (filter.reviewStatuses && filter.reviewStatuses.length > 0) {
      conditions.push(inArray(properties.reviewStatus, filter.reviewStatuses));
    }

    if (filter.minPricePerShare !== undefined) {
      conditions.push(gte(properties.pricePerShare, filter.minPricePerShare.toString()));
    }

    if (filter.maxPricePerShare !== undefined) {
      conditions.push(lte(properties.pricePerShare, filter.maxPricePerShare.toString()));
    }

    if (filter.minAvailableShares !== undefined) {
      conditions.push(gte(properties.availableShares, filter.minAvailableShares));
    }

    if (filter.hasAvailableShares) {
      conditions.push(gt(properties.availableShares, 0));
    }

    // JSON field filtering for location
    if (filter.city) {
      conditions.push(sql`${properties.location}->>'city' = ${filter.city}`);
    }

    if (filter.country) {
      conditions.push(sql`${properties.location}->>'country' = ${filter.country}`);
    }

    return conditions;
  }
}

// Export singleton instance
export const propertyRepository = new PropertyRepository();
