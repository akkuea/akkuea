import { apiClient } from "./client";

export type TreasuryVenueId = "defindex-blend" | "etherfuse-stablebond";

export interface TreasuryStrategy {
  address: string;
  amount: string;
  paused: boolean;
}

export interface TreasuryPosition {
  venue: TreasuryVenueId;
  label: string;
  provider: string;
  strategy: string;
  assetCode: string;
  vaultContractId: string;
  assetContractId: string;
  /** dfToken shares the treasury holds, as a decimal string. */
  shares: string;
  /** What those shares are worth right now, in the underlying asset. */
  positionValue: string;
  vaultTotalManaged: string;
  vaultIdleAmount: string;
  vaultInvestedAmount: string;
  strategies: TreasuryStrategy[];
  paused: boolean;
  fees: { vaultBps: number; protocolBps: number };
  explorer: { vault: string; asset: string; account: string | null };
  /** When the API read these numbers off chain. */
  readAt: string;
}

export interface TreasuryVenueStatus {
  venue: TreasuryVenueId;
  configured: boolean;
  label: string;
  provider: string;
  strategy: string;
}

export interface TreasuryPortfolio {
  positions: TreasuryPosition[];
  unconfigured: TreasuryVenueStatus[];
  unavailable: Array<{ venue: TreasuryVenueId; reason: string }>;
  sourceAccount: string | null;
  network: string;
}

export interface TreasuryHistoryEntry {
  id: string;
  venue: TreasuryVenueId;
  operation: "deposit" | "withdraw";
  status: "submitted" | "confirmed" | "failed";
  assetCode: string;
  amount: string | null;
  shares: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  errorName: string | null;
  errorCode: string | null;
  requestedBy: string;
  createdAt: string;
}

export interface TreasurySnapshot {
  venue: TreasuryVenueId;
  assetCode: string;
  shares: string;
  positionValue: string;
  vaultTotalManaged: string;
  capturedAt: string;
}

export interface TreasuryHistory {
  transactions: TreasuryHistoryEntry[];
  snapshots: TreasurySnapshot[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/**
 * Read-only treasury API.
 *
 * There are deliberately no deposit/withdraw calls here: those are
 * admin-triggered through the internal API key, not something the web app can
 * initiate.
 */
export const treasuryApi = {
  async getPortfolio(): Promise<TreasuryPortfolio> {
    const response =
      await apiClient.get<ApiEnvelope<TreasuryPortfolio>>("/api/v1/treasury");
    return response.data.data;
  },

  async getHistory(limit = 20): Promise<TreasuryHistory> {
    const response = await apiClient.get<ApiEnvelope<TreasuryHistory>>(
      `/api/v1/treasury/history?limit=${limit}`,
    );
    return response.data.data;
  },
};
