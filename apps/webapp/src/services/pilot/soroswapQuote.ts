import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { pilotNetworkPassphrase, pilotRpcUrl } from "./config";

/**
 * Read-only Soroswap router quote used to derive `execute_distribution`'s
 * `min_eurc_per_usdc` price floor.
 *
 * This calls the same Soroswap router the contract itself swaps through
 * (`pilot-payout-split`'s `SwapRouter` storage entry, reported live by
 * `eurc_swap_path_status()`), using the router's own `router_get_amounts_out`
 * read function (github.com/soroswap/core, `contracts/router/src/lib.rs`).
 * That function performs no state change and requires no auth: it simulates
 * the exact same constant-product path the contract would swap through and
 * returns the amounts a real swap of that size would produce right now.
 *
 * A price floor derived from anything other than this live router quote
 * (a cached price, an off-chain oracle, a hand-entered number) would let the
 * pool move between quoting and executing without the UI ever knowing, which
 * is exactly the gap `min_eurc_per_usdc` exists to close. See
 * docs/strategy/decision-log.md for why Soroswap specifically.
 */

/** Soroban RPC simulation has no `require_auth`, so this address is never
 * asked to sign anything; it only needs to be a syntactically valid Stellar
 * address for the simulated invocation's `source_account`. */
const SIMULATION_SOURCE_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export class SoroswapQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SoroswapQuoteError";
  }
}

/**
 * Simulates `router_get_amounts_out(amountIn, [tokenIn, tokenOut])` against
 * the given Soroswap router and returns the quoted output amount, in the
 * output token's stroops.
 *
 * Throws `SoroswapQuoteError` if the simulation fails (no route, no
 * liquidity, an unreachable router) rather than returning a fabricated
 * value: a missing quote must block preparing a zero-floor transaction, not
 * silently produce one.
 */
export async function quoteAmountOut(args: {
  routerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  rpcUrl?: string;
  networkPassphrase?: string;
}): Promise<bigint> {
  const rpcUrlToUse = args.rpcUrl ?? pilotRpcUrl();
  const networkPassphrase = args.networkPassphrase ?? pilotNetworkPassphrase();
  const server = new rpc.Server(rpcUrlToUse, {
    allowHttp: rpcUrlToUse.startsWith("http://"),
  });

  const router = new Contract(args.routerAddress);
  const operation = router.call(
    "router_get_amounts_out",
    nativeToScVal(args.amountIn, { type: "i128" }),
    xdr.ScVal.scvVec([
      Address.fromString(args.tokenIn).toScVal(),
      Address.fromString(args.tokenOut).toScVal(),
    ]),
  );

  const account = new Account(SIMULATION_SOURCE_ACCOUNT, "0");
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new SoroswapQuoteError(
      `Soroswap router quote failed: ${simulation.error}`,
    );
  }
  if (!simulation.result?.retval) {
    throw new SoroswapQuoteError(
      "Soroswap router quote returned no result. The router may have no route for this token pair.",
    );
  }

  const amounts = scValToNative(simulation.result.retval) as bigint[];
  const amountOut = amounts[amounts.length - 1];
  if (typeof amountOut !== "bigint" || amountOut <= BigInt(0)) {
    throw new SoroswapQuoteError(
      "Soroswap router returned an empty or non-positive quote.",
    );
  }
  return amountOut;
}

/** Basis points denominator, matching the contract's own `RATE_DENOMINATOR`
 * (1e7) is a *separate* scale for the on-chain rate; this one is purely for
 * the slippage-tolerance percentage below. */
const BPS_DENOMINATOR = BigInt(10_000);

/** Contract's `RATE_DENOMINATOR`: `min_eurc_per_usdc` is a price scaled by
 * this factor (7-decimal fixed point, matching every other Stellar asset
 * amount in this codebase). Duplicated here rather than imported because the
 * generated contract bindings do not export it as a value, only as a doc
 * comment; keep in sync with `apps/contracts/contracts/pilot-payout-split/src/lib.rs`'s
 * `RATE_DENOMINATOR`. */
export const RATE_DENOMINATOR = BigInt(10_000_000);

/**
 * Derives `min_eurc_per_usdc` from a live router quote and a slippage
 * tolerance, refusing to produce a floor below what the tolerance allows.
 *
 * `slippageBps` is basis points of the quoted rate the executed rate is
 * allowed to fall short by (100 = 1%). A cycle with a 1,000 USDC-stroop
 * EURC-preference leg quoted at 920 EURC-stroops out, with a 100 bps (1%)
 * tolerance, floors at 0.9108 EURC per USDC: below that, `execute_distribution`
 * itself panics with `InvalidMinRate` (a zero floor) or the router rejects the
 * leg before moving funds (a floor the pool can no longer satisfy) rather
 * than silently paying out less than intended.
 */
export function deriveMinEurcPerUsdc(args: {
  quotedAmountIn: bigint;
  quotedAmountOut: bigint;
  slippageBps: number;
}): bigint {
  if (args.quotedAmountIn <= BigInt(0)) {
    throw new SoroswapQuoteError(
      "Cannot derive a price floor from a non-positive quoted input amount.",
    );
  }
  if (args.slippageBps < 0 || args.slippageBps >= Number(BPS_DENOMINATOR)) {
    throw new SoroswapQuoteError(
      `slippageBps must be between 0 and ${BPS_DENOMINATOR - BigInt(1)}, got ${args.slippageBps}.`,
    );
  }

  // rate = amountOut / amountIn, scaled by RATE_DENOMINATOR
  const quotedRate =
    (args.quotedAmountOut * RATE_DENOMINATOR) / args.quotedAmountIn;
  const toleranceFactor = BPS_DENOMINATOR - BigInt(args.slippageBps);
  const floor = (quotedRate * toleranceFactor) / BPS_DENOMINATOR;

  if (floor <= BigInt(0)) {
    throw new SoroswapQuoteError(
      "Derived price floor is zero or negative; refusing to prepare a zero-floor distribution.",
    );
  }
  return floor;
}

/** Default slippage tolerance applied to the live quote when preparing an
 * `execute_distribution` invocation with any EURC-preference holder.
 * Configurable via `NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS`; both parties see
 * the resulting floor on the confirmation screen before signing, so a
 * misconfigured tolerance is caught there, not just here. */
export function defaultEurcSlippageBps(): number {
  const parsed = Number.parseInt(
    process.env.NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS ?? "",
    10,
  );
  return Number.isInteger(parsed) && parsed >= 0 && parsed < 10_000
    ? parsed
    : 100; // 1%
}
