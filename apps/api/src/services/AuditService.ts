import { AuditLogRepository, type AuditLogFilter, type PaginatedAuditLogs } from '../repositories/AuditLogRepository';
import { auditLogRepository as defaultRepository } from '../repositories/AuditLogRepository';

export interface AuditLogActionInput {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  constructor(private repository: AuditLogRepository = defaultRepository) {}

  async logAction(input: AuditLogActionInput): Promise<void> {
    await this.repository.create({
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      metadata: input.metadata ?? null,
    });
  }

  async getAuditLogs(filters: AuditLogFilter): Promise<PaginatedAuditLogs> {
    return this.repository.findPaginated(filters);
  }
}

export const auditService = new AuditService();
