import { scValToNative } from "@stellar/stellar-sdk";
import type {
  Currency,
  PilotPayoutSplitClientInterface,
} from "./payout-split.js";

/**
 * Reading a cycle's durable settlement records.
 *
 * The contract writes these when a distribution executes, on the cycle's own
 * evidence entry, so they survive the RPC event retention window. Everything
 * here reads stored state: an amount shown to an investor is the amount the
 * contract actually transferred, never a client-side recomputation.
 *
 * Kept beside the generated client rather than inside it, so regenerating the
 * bindings does not overwrite this.
 */

/** Settlement currency as plain strings, for application code. */
export type PilotSettlementCurrency = "usdc" | "eurc";

/** A cycle's persisted payout summary, normalized for application code. */
export interface PilotDistributionSummary {
  cycleId: string;
  /** Reported income for the cycle, in USDC stroops. */
  totalIncome: bigint;
  platformFee: bigint;
  holderAmount: bigint;
  holderCount: number;
  /** Sum of pro-rata shares actually delivered, in USDC stroops. */
  distributedTotal: bigint;
  dust: bigint;
  /** EURC actually received across successful swap legs. */
  eurcDistributedTotal: bigint;
  swapsFailed: number;
  /** USDC withheld for holders whose swap legs failed, in USDC stroops. */
  undistributedFailedSwaps: bigint;
}

/**
 * What one holder actually received for a cycle.
 *
 * `amount` is denominated in `currency`, so a EURC holder sees the EURC they
 * were paid while `usdcShare` records the pre-swap share. A `withheld` record
 * delivered nothing and its USDC is reserved on-chain for `claim_withheld`.
 */
export interface PilotHolderSettlement {
  holder: string;
  cycleId: string;
  currency: PilotSettlementCurrency;
  amount: bigint;
  usdcShare: bigint;
  withheld: boolean;
}

/** Shape the generic ScVal converter produces for a stored summary. */
interface RawDistributionSummary {
  cycle_id: string;
  total_income: bigint;
  platform_fee: bigint;
  holder_amount: bigint;
  holder_count: number;
  distributed_total: bigint;
  dust: bigint;
  eurc_distributed_total: bigint;
  swaps_failed: number;
  undistributed_failed_swaps: bigint;
}

/** Shape the generic ScVal converter produces for a stored settlement. */
interface RawHolderSettlement {
  holder: string;
  cycle_id: string;
  currency: ["Usdc"] | ["Eurc"];
  amount: bigint;
  usdc_share: bigint;
  withheld: boolean;
}

function toCurrency(raw: ["Usdc"] | ["Eurc"]): PilotSettlementCurrency {
  return raw[0] === "Eurc" ? "eurc" : "usdc";
}

function normalizeSummary(
  raw: RawDistributionSummary,
): PilotDistributionSummary {
  return {
    cycleId: raw.cycle_id,
    totalIncome: raw.total_income,
    platformFee: raw.platform_fee,
    holderAmount: raw.holder_amount,
    holderCount: Number(raw.holder_count),
    distributedTotal: raw.distributed_total,
    dust: raw.dust,
    eurcDistributedTotal: raw.eurc_distributed_total,
    swapsFailed: Number(raw.swaps_failed),
    undistributedFailedSwaps: raw.undistributed_failed_swaps,
  };
}

function normalizeSettlement(raw: RawHolderSettlement): PilotHolderSettlement {
  return {
    holder: raw.holder,
    cycleId: raw.cycle_id,
    currency: toCurrency(raw.currency),
    amount: raw.amount,
    usdcShare: raw.usdc_share,
    withheld: raw.withheld,
  };
}

/**
 * Reads a cycle's persisted distribution summary, or undefined when the cycle
 * has not distributed.
 *
 * Decoded with the generic ScVal converter rather than the generated client's
 * typed `result`, because the pinned @stellar/stellar-sdk cannot decode an
 * option wrapping a struct through the typed path (the same reason
 * `readEvidence` does this). See `evidence.ts`.
 */
export async function readDistributionSummary(
  client: PilotPayoutSplitClientInterface,
  cycleId: string,
): Promise<PilotDistributionSummary | undefined> {
  const tx = await client.get_distribution_summary({ cycle_id: cycleId });
  const retval = tx.simulationData?.result?.retval;
  if (!retval) {
    return undefined;
  }
  const raw = scValToNative(retval) as
    RawDistributionSummary | null | undefined;
  return raw ? normalizeSummary(raw) : undefined;
}

/** Reads one holder's persisted settlement outcome for a cycle. */
export async function readHolderSettlement(
  client: PilotPayoutSplitClientInterface,
  cycleId: string,
  holder: string,
): Promise<PilotHolderSettlement | undefined> {
  const tx = await client.get_holder_settlement({
    cycle_id: cycleId,
    holder,
  });
  const retval = tx.simulationData?.result?.retval;
  if (!retval) {
    return undefined;
  }
  const raw = scValToNative(retval) as RawHolderSettlement | null | undefined;
  return raw ? normalizeSettlement(raw) : undefined;
}

/** USDC reserved for a holder after a failed EURC swap leg, in stroops. */
export async function readWithheldBalance(
  client: PilotPayoutSplitClientInterface,
  holder: string,
): Promise<bigint> {
  const tx = await client.get_withheld_balance({ holder });
  return tx.result;
}

/** Total USDC reserved for every holder across all cycles, in stroops. */
export async function readTotalWithheld(
  client: PilotPayoutSplitClientInterface,
): Promise<bigint> {
  const tx = await client.total_withheld_balance();
  return tx.result;
}

/** A holder's settlement-currency preference. */
export async function readCurrencyPreference(
  client: PilotPayoutSplitClientInterface,
  holder: string,
): Promise<PilotSettlementCurrency> {
  const tx = await client.get_currency_preference({ holder });
  // The typed result decodes a single enum, unlike the struct-wrapping options
  // above, so it arrives as the generated tagged union rather than a raw array.
  const currency: Currency = tx.result;
  return currency.tag === "Eurc" ? "eurc" : "usdc";
}

/** The terminal exit record, or undefined while the pilot is active. */
export interface PilotExitRecord {
  reason: string;
  /** Unix seconds. */
  at: number;
}

interface RawExitRecord {
  reason: string;
  at: bigint;
}

/**
 * Reads the terminal exit record. Uses the raw retval for the same
 * option-wrapping-struct reason as `readDistributionSummary`.
 */
export async function readExitStatus(
  client: PilotPayoutSplitClientInterface,
): Promise<PilotExitRecord | undefined> {
  const tx = await client.exit_status();
  const retval = tx.simulationData?.result?.retval;
  if (!retval) {
    return undefined;
  }
  const raw = scValToNative(retval) as RawExitRecord | null | undefined;
  if (!raw) {
    return undefined;
  }
  return { reason: raw.reason, at: Number(raw.at) };
}
