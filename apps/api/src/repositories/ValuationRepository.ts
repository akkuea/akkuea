import type { ValuationRecord } from '@real-estate-defi/shared';

// In-memory store for valuation history (REQ-003)
const latestValuations = new Map<string, ValuationRecord>();
const valuationHistory = new Map<string, ValuationRecord[]>();

export class ValuationRepository {
  static save(record: ValuationRecord): ValuationRecord {
    latestValuations.set(record.propertyId, record);

    const history = valuationHistory.get(record.propertyId) ?? [];
    history.push(record);
    valuationHistory.set(record.propertyId, history);

    return record;
  }

  static findLatest(propertyId: string): ValuationRecord | undefined {
    return latestValuations.get(propertyId);
  }

  static findHistory(propertyId: string, limit?: number): ValuationRecord[] {
    const history = valuationHistory.get(propertyId) ?? [];
    const sorted = history
      .map((record, index) => ({ record, index }))
      .sort((a, b) => {
        const timeDiff =
          new Date(b.record.receivedAt).getTime() - new Date(a.record.receivedAt).getTime();
        return timeDiff !== 0 ? timeDiff : b.index - a.index;
      })
      .map(({ record }) => record);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  static findAll(): ValuationRecord[] {
    return Array.from(latestValuations.values());
  }

  static updateStatus(
    id: string,
    propertyId: string,
    status: ValuationRecord['status'],
    rejectionReason?: string,
  ): ValuationRecord | undefined {
    const history = valuationHistory.get(propertyId);
    if (!history) return undefined;

    const record = history.find((r) => r.id === id);
    if (!record) return undefined;

    record.status = status;
    if (rejectionReason) record.rejectionReason = rejectionReason;

    const latest = latestValuations.get(propertyId);
    if (latest?.id === id) {
      latestValuations.set(propertyId, record);
    }

    return record;
  }
}
