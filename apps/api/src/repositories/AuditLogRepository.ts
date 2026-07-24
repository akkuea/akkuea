import { and, desc, gte, lte, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { auditLog, type AuditLog, type NewAuditLog } from '../db/schema';

export interface AuditLogFilter {
  actor?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AuditLogRepository {
  async create(data: NewAuditLog): Promise<AuditLog> {
    const results = await db.insert(auditLog).values(data).returning();
    return results[0];
  }

  async findPaginated(filter: AuditLogFilter): Promise<PaginatedAuditLogs> {
    const { page, limit } = filter;
    const offset = (page - 1) * limit;

    const conditions = this.buildFilterConditions(filter);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const data = await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt))
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

  private buildFilterConditions(filter: AuditLogFilter): SQL[] {
    const conditions: SQL[] = [];

    if (filter.actor) {
      conditions.push(eq(auditLog.actor, filter.actor));
    }

    if (filter.action) {
      conditions.push(eq(auditLog.action, filter.action));
    }

    if (filter.startDate) {
      conditions.push(gte(auditLog.createdAt, new Date(filter.startDate)));
    }

    if (filter.endDate) {
      conditions.push(lte(auditLog.createdAt, new Date(filter.endDate)));
    }

    return conditions;
  }
}

export const auditLogRepository = new AuditLogRepository();
