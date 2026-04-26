import type {
  RealEstateValuationPayload,
  ValuationRecord,
  ContractValuationPayload,
} from '@real-estate-defi/shared';
import { ValidationService } from '@real-estate-defi/shared';
import { ValuationRepository } from '../repositories/ValuationRepository';

const FRESHNESS_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRICE_MIN = 1;
const PRICE_MAX = 1_000_000_000;

function generateId(): string {
  return `val_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function hashSource(sourceId: string): string {
  // Deterministic hex representation of sourceId for contract consumption (REQ-007)
  let hash = 0;
  for (let i = 0; i < sourceId.length; i++) {
    hash = (hash * 31 + sourceId.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export class OracleService {
  // REQ-002: Validate freshness, source identity, and price bounds
  static validatePayload(payload: Partial<RealEstateValuationPayload>): {
    isValid: boolean;
    errors: string[];
  } {
    return ValidationService.validateValuationPayload(
      payload,
      FRESHNESS_MAX_AGE_MS,
      PRICE_MIN,
      PRICE_MAX,
    );
  }

  // REQ-001, REQ-002, REQ-003, REQ-006: Ingest and store a valuation
  static ingestValuation(payload: RealEstateValuationPayload): {
    record: ValuationRecord;
    warnings: string[];
  } {
    const { isValid, errors } = this.validatePayload(payload);

    if (!isValid) {
      const record: ValuationRecord = {
        ...payload,
        id: generateId(),
        status: 'rejected',
        receivedAt: new Date(),
        rejectionReason: errors.join('; '),
      };
      ValuationRepository.save(record);
      throw new Error(`Valuation rejected: ${errors.join('; ')}`);
    }

    const warnings: string[] = [];
    const age = Date.now() - new Date(payload.timestamp).getTime();
    if (age > FRESHNESS_MAX_AGE_MS * 0.75) {
      warnings.push('Valuation is approaching staleness threshold');
    }

    const record: ValuationRecord = {
      ...payload,
      id: generateId(),
      status: 'active',
      receivedAt: new Date(),
    };

    ValuationRepository.save(record);
    return { record, warnings };
  }

  // REQ-004: Get latest valuation for a property
  static getLatestValuation(propertyId: string): ValuationRecord {
    const record = ValuationRepository.findLatest(propertyId);
    if (!record) {
      throw new Error(`No valuation found for property: ${propertyId}`);
    }
    return record;
  }

  // REQ-004: Get valuation history for a property
  static getValuationHistory(propertyId: string, limit?: number): ValuationRecord[] {
    return ValuationRepository.findHistory(propertyId, limit);
  }

  // REQ-005: Flag a valuation for manual review
  static flagForManualReview(id: string, propertyId: string, reason: string): ValuationRecord {
    const updated = ValuationRepository.updateStatus(id, propertyId, 'manual_review', reason);
    if (!updated) {
      throw new Error(`Valuation ${id} not found for property ${propertyId}`);
    }
    return updated;
  }

  // REQ-005: Submit a manual override valuation
  static submitManualOverride(
    payload: RealEstateValuationPayload & { overrideReason: string },
  ): ValuationRecord {
    const record: ValuationRecord = {
      ...payload,
      id: generateId(),
      methodology: 'manual',
      status: 'active',
      receivedAt: new Date(),
    };
    ValuationRepository.save(record);
    return record;
  }

  // REQ-007: Build contract-ready payload from latest valuation
  static buildContractPayload(propertyId: string): ContractValuationPayload {
    const record = this.getLatestValuation(propertyId);

    if (record.status !== 'active') {
      throw new Error(`Cannot build contract payload: valuation status is '${record.status}'`);
    }

    return {
      propertyId: record.propertyId,
      priceMicroUsd: Math.round(record.price * 1_000_000),
      timestamp: Math.floor(new Date(record.timestamp).getTime() / 1000),
      sourceHash: hashSource(record.sourceId),
      confidence: record.confidence,
    };
  }
}
