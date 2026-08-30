import { CONTRACT_IDS, API_ENDPOINTS } from "@real-estate-defi/shared";
import { Networks } from "@stellar/stellar-sdk";

/**
 * Network and contract configuration for the pilot dashboard.
 *
 * Contract IDs come from the committed deployment artifacts in
 * `apps/shared/src/contracts.<network>.json`, with an environment override so a
 * contributor can point the dashboard at a local or custom deployment without
 * editing a committed file.
 */

export type PilotNetwork = "TESTNET" | "MAINNET";

export function resolvePilotNetwork(): PilotNetwork {
  const configured = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "")
    .trim()
    .toLowerCase();
  return configured === "mainnet" || configured === "public"
    ? "MAINNET"
    : "TESTNET";
}

export function pilotNetworkPassphrase(): string {
  return resolvePilotNetwork() === "MAINNET"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

export function pilotRpcUrl(): string {
  const override = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim();
  if (override) {
    return override;
  }
  return resolvePilotNetwork() === "MAINNET"
    ? API_ENDPOINTS.SOROBAN_RPC.MAINNET
    : API_ENDPOINTS.SOROBAN_RPC.TESTNET;
}

export interface PilotContractIds {
  payoutSplit: string;
  incomeToken: string;
  whitelist: string;
}

export function pilotContractIds(): PilotContractIds {
  const network = resolvePilotNetwork();
  return {
    payoutSplit:
      process.env.NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID?.trim() ||
      CONTRACT_IDS.PILOT_PAYOUT_SPLIT[network],
    incomeToken:
      process.env.NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID?.trim() ||
      CONTRACT_IDS.PILOT_INCOME_TOKEN[network],
    whitelist:
      process.env.NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID?.trim() ||
      CONTRACT_IDS.PILOT_WHITELIST[network],
  };
}

/** Thrown when the dashboard is loaded against a network with no deployment. */
export class PilotNotDeployedError extends Error {
  constructor(missing: string[]) {
    super(
      `The pilot contracts are not deployed on this network. Missing: ${missing.join(", ")}.`,
    );
    this.name = "PilotNotDeployedError";
  }
}

export function assertPilotDeployed(ids: PilotContractIds): void {
  const missing = Object.entries(ids)
    .filter(([, id]) => !id)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new PilotNotDeployedError(missing);
  }
}

/**
 * First cycle the pilot reports on, as `YYYY-MM`.
 *
 * Cycles are enumerated from this month up to the current one rather than
 * discovered from events, because Soroban RPC only retains events for a short
 * window while contract storage keeps every cycle indefinitely.
 */
export function pilotStartCycle(): string {
  const configured = process.env.NEXT_PUBLIC_PILOT_START_CYCLE?.trim();
  return /^\d{4}-\d{2}$/.test(configured ?? "") ? configured! : "2026-01";
}

/**
 * Day of the month, in the month after the cycle, that the ally's income is
 * contractually due. Configurable because it is a term of the ally's agreement,
 * not a property of the software.
 */
export function pilotPaymentDay(): number {
  const parsed = Number.parseInt(
    process.env.NEXT_PUBLIC_PILOT_PAYMENT_DAY ?? "",
    10,
  );
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 28 ? parsed : 5;
}

/** Optional Gaussian splat URL for the pilot ally's property. */
export function pilotPropertySplatUrl(): string | null {
  return process.env.NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL?.trim() || null;
}
