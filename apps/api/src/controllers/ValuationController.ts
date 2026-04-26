import type {
  RealEstateValuationPayload,
  ValuationRecord,
  ContractValuationPayload,
} from '@real-estate-defi/shared';
import { OracleService } from '../services/OracleService';

export class ValuationController {
  static async ingestValuation(
    body: RealEstateValuationPayload,
  ): Promise<{ success: true; record: ValuationRecord; warnings: string[] }> {
    try {
      const { record, warnings } = OracleService.ingestValuation(body);
      return { success: true, record, warnings };
    } catch (error) {
      throw new Error(`Failed to ingest valuation: ${error}`);
    }
  }

  static async getLatestValuation(
    propertyId: string,
  ): Promise<{ success: true; record: ValuationRecord }> {
    try {
      const record = OracleService.getLatestValuation(propertyId);
      return { success: true, record };
    } catch (error) {
      throw new Error(`Failed to fetch valuation: ${error}`);
    }
  }

  static async getValuationHistory(
    propertyId: string,
    limit?: number,
  ): Promise<{ success: true; history: ValuationRecord[]; total: number }> {
    try {
      const history = OracleService.getValuationHistory(propertyId, limit);
      return { success: true, history, total: history.length };
    } catch (error) {
      throw new Error(`Failed to fetch valuation history: ${error}`);
    }
  }

  static async getContractPayload(
    propertyId: string,
  ): Promise<{ success: true; payload: ContractValuationPayload }> {
    try {
      const payload = OracleService.buildContractPayload(propertyId);
      return { success: true, payload };
    } catch (error) {
      throw new Error(`Failed to build contract payload: ${error}`);
    }
  }

  static async flagForManualReview(
    id: string,
    propertyId: string,
    reason: string,
  ): Promise<{ success: true; record: ValuationRecord }> {
    try {
      const record = OracleService.flagForManualReview(id, propertyId, reason);
      return { success: true, record };
    } catch (error) {
      throw new Error(`Failed to flag valuation for review: ${error}`);
    }
  }

  static async submitManualOverride(
    body: RealEstateValuationPayload & { overrideReason: string },
  ): Promise<{ success: true; record: ValuationRecord }> {
    try {
      const record = OracleService.submitManualOverride(body);
      return { success: true, record };
    } catch (error) {
      throw new Error(`Failed to submit manual override: ${error}`);
    }
  }
}
