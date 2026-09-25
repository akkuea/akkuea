import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { DistributionSummary } from "@akkuea/shared";

/**
 * These tests mock `@akkuea/shared`'s generated contract clients at the
 * module boundary, the same way `stellar-wallets-kit.provider.test.ts`
 * mocks the wallet kit: `cosign.ts` only ever talks to the payout contract
 * through `PilotPayoutSplitClient`/`PilotIncomeTokenClient`, so controlling
 * what those return is enough to exercise every branch in this module
 * without a live RPC endpoint.
 *
 * The mock `AssembledTransaction`-like objects are plain structural fakes,
 * not real SDK instances: `decodeInvocationArgs` only ever does property
 * access on `tx.built`, never an `instanceof` check, so a plain object with
 * the right shape reconstructs the exact code path a real transaction would
 * take. What each test controls is exactly the invocation's own decoded
 * arguments, which is the point: it proves `summarizeExecuteDistribution`
 * (and its `record_evidence`/`exit` counterparts) has no parameter other
 * than the payload string to source a summary from, so whatever the mock's
 * "built invocation" says is the only thing that can appear in the result.
 */

interface MockFunc {
  inputs: { name: { toString(): string }; type: unknown }[];
}

interface MockSpec {
  getFunc(name: string): MockFunc;
  scValToNative(value: unknown): unknown;
}

interface MockAssembledTx {
  built: unknown;
  result?: unknown;
  options: { server?: unknown };
  toJson(): string;
  needsNonInvokerSigningBy(): string[];
  signAuthEntries(opts: {
    address: string;
    expiration: number | Promise<number>;
    signAuthEntry: (
      authEntryXdr: string,
      opts?: { address?: string; networkPassphrase?: string },
    ) => Promise<unknown>;
  }): Promise<void>;
  sign(): Promise<void>;
  send(): Promise<{ sendTransactionResponse?: { hash?: string } }>;
}

/** The payout contract ID every test's invocations are addressed to by
 * default, matching the mocked `CONTRACT_IDS.PILOT_PAYOUT_SPLIT` below so
 * `decodeInvocationArgs`'s contract-address check passes without every test
 * having to know about it. */
const PAYOUT_CONTRACT_ID = "CPAYOUT";

/** Builds a fake `tx.built.operations[0]`, the shape `decodeInvocationArgs`
 * reads: a `hostFunctionTypeInvokeContract` invocation whose args array is
 * already in "decoded" form, since the mock `spec.scValToNative` below is
 * the identity function. `contractAddress` defaults to the configured payout
 * contract; tests that exercise the wrong-contract check pass a different
 * one explicitly. */
function invocation(
  functionName: string,
  args: unknown[],
  contractAddress: string = PAYOUT_CONTRACT_ID,
) {
  return {
    operations: [
      {
        type: "invokeHostFunction",
        func: {
          type: "hostFunctionTypeInvokeContract",
          invokeContract: {
            contractAddress,
            functionName: { toStringStrict: () => functionName },
            args,
          },
        },
      },
    ],
  };
}

/** Default `DistributionSummary` `decodeExecuteDistributionSummary` reads
 * off `tx.result`. Values are all zero/empty since most tests only care
 * about the decoded invocation args, not this simulated result; tests that
 * do care override it explicitly. */
function distributionResult(overrides: Partial<DistributionSummary> = {}) {
  return {
    cycle_id: "2026-03",
    distributed_total: BigInt(0),
    dust: BigInt(0),
    eurc_distributed_total: BigInt(0),
    holder_amount: BigInt(0),
    holder_count: 0,
    platform_fee: BigInt(0),
    swaps_failed: 0,
    total_income: BigInt(0),
    undistributed_failed_swaps: 0,
    ...overrides,
  };
}

const SPEC_INPUTS: Record<string, string[]> = {
  execute_distribution: ["operator", "ally", "cycle_id", "min_eurc_per_usdc"],
  record_evidence: [
    "operator",
    "ally",
    "cycle_id",
    "evidence_hash",
    "evidence_link",
    "total_income",
  ],
  exit: ["operator", "ally", "reason"],
};

const mockSpec: MockSpec = {
  getFunc: (name) => ({
    inputs: (SPEC_INPUTS[name] ?? []).map((fieldName) => ({
      name: { toString: () => fieldName },
      type: undefined,
    })),
  }),
  scValToNative: (value) => value,
};

function makeTx(overrides: Partial<MockAssembledTx> = {}): MockAssembledTx {
  return {
    built: invocation("execute_distribution", [
      "GOPERATOR",
      "GALLY",
      "2026-03",
      BigInt(0),
    ]),
    result: distributionResult(),
    options: {},
    toJson: () => "reconstructed-payload-json",
    needsNonInvokerSigningBy: () => ["GALLY"],
    signAuthEntries: async () => {},
    sign: async () => {},
    send: async () => ({ sendTransactionResponse: { hash: "abcdef123456" } }),
    ...overrides,
  };
}

interface MockPayoutClient {
  is_paused: () => Promise<{ result: boolean }>;
  exit_status: () => Promise<{ result: unknown }>;
  get_evidence: () => Promise<{ result: unknown }>;
  get_currency_preference: () => Promise<{ result: { tag: string } }>;
  eurc_swap_path_status: () => Promise<{ result: unknown }>;
  execute_distribution: (args: unknown) => Promise<MockAssembledTx>;
  record_evidence: (args: unknown) => Promise<MockAssembledTx>;
  exit: (args: unknown) => Promise<MockAssembledTx>;
  fromJSON: Record<string, (json: string) => MockAssembledTx>;
  txFromJson: (json: string) => MockAssembledTx;
  spec: MockSpec;
}

function makePayoutClient(
  overrides: Partial<MockPayoutClient> = {},
): MockPayoutClient {
  const base: MockPayoutClient = {
    is_paused: async () => ({ result: false }),
    exit_status: async () => ({ result: null }),
    get_evidence: async () => ({ result: null }),
    get_currency_preference: async () => ({ result: { tag: "Usdc" } }),
    eurc_swap_path_status: async () => ({ result: null }),
    execute_distribution: async () => makeTx(),
    record_evidence: async () =>
      makeTx({
        built: invocation("record_evidence", [
          "GOPERATOR",
          "GALLY",
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
      }),
    exit: async () =>
      makeTx({
        built: invocation("exit", ["GOPERATOR", "GALLY", "winding down"]),
      }),
    fromJSON: {},
    txFromJson: () => makeTx(),
    spec: mockSpec,
  };
  const merged = { ...base, ...overrides };
  merged.fromJSON = {
    execute_distribution:
      overrides.fromJSON?.execute_distribution ?? (() => makeTx()),
    record_evidence:
      overrides.fromJSON?.record_evidence ??
      (() =>
        makeTx({
          built: invocation("record_evidence", [
            "GOPERATOR",
            "GALLY",
            "2026-03",
            new Uint8Array(32),
            "https://example.com/statement",
            BigInt(500_0000000),
          ]),
        })),
    exit:
      overrides.fromJSON?.exit ??
      (() =>
        makeTx({
          built: invocation("exit", ["GOPERATOR", "GALLY", "winding down"]),
        })),
  };
  return merged;
}

let mockPayout: MockPayoutClient = makePayoutClient();
let mockIncomeHolders: string[] = [];

mock.module("@akkuea/shared", () => ({
  buildContractClientOptions: (config: unknown) => config,
  PilotPayoutSplitClient: class {
    constructor() {
      return mockPayout as unknown as object;
    }
  },
  PilotIncomeTokenClient: class {
    holders = async () => ({ result: mockIncomeHolders });
  },
  CONTRACT_IDS: {
    PILOT_PAYOUT_SPLIT: { TESTNET: "CPAYOUT", MAINNET: "CPAYOUT" },
    PILOT_INCOME_TOKEN: { TESTNET: "CINCOME", MAINNET: "CINCOME" },
    PILOT_WHITELIST: { TESTNET: "CWHITELIST", MAINNET: "CWHITELIST" },
  },
  API_ENDPOINTS: {
    SOROBAN_RPC: {
      TESTNET: "https://testnet.example",
      MAINNET: "https://mainnet.example",
    },
  },
}));

mock.module("@stellar/stellar-sdk/rpc", () => ({
  Server: class {
    getLatestLedger = async () => ({ sequence: 1_000_000 });
  },
}));

/**
 * `decodeInvocationArgs` decodes the invocation's contract address via
 * `Address.fromScAddress(...).toString()`. The mock invocations above put a
 * plain contract-ID string directly where a real `xdr.ScAddress` would go
 * (matching `scValToNative`'s identity mock for the invocation's other
 * args), so this override just round-trips that string instead of decoding
 * real XDR. Every other export is passed through untouched: `config.ts`
 * still needs the real `Networks` from this same module.
 */
const RealStellarSdk = await import("@stellar/stellar-sdk");
mock.module("@stellar/stellar-sdk", () => ({
  ...RealStellarSdk,
  Address: {
    ...RealStellarSdk.Address,
    fromScAddress: (value: unknown) => ({ toString: () => String(value) }),
  },
}));

/**
 * `quoteEurcFloor` (in `cosign.ts`) delegates the actual live-quote call to
 * `quoteAmountOut`. Mocking only that one export, spreading everything else
 * from the real module, lets these tests control what the "live router
 * quote" returns while still exercising the real `deriveMinEurcPerUsdc` /
 * `defaultEurcSlippageBps` tolerance math, the same way `@stellar/stellar-sdk`
 * is partially mocked above.
 */
const RealSoroswapQuote = await import("../soroswapQuote");
let mockQuoteAmountOut: typeof RealSoroswapQuote.quoteAmountOut = async () =>
  BigInt(920);
mock.module("../soroswapQuote", () => ({
  ...RealSoroswapQuote,
  quoteAmountOut: (args: Parameters<typeof mockQuoteAmountOut>[0]) =>
    mockQuoteAmountOut(args),
}));

const {
  CosignError,
  prepareExecuteDistribution,
  summarizeExecuteDistribution,
  coSignAsAlly,
  finalizeAndSubmitExecuteDistribution,
  quoteEurcFloor,
  prepareRecordEvidence,
  summarizeRecordEvidence,
  coSignRecordEvidenceAsAlly,
  finalizeAndSubmitRecordEvidence,
  prepareExit,
  summarizeExit,
  coSignExitAsAlly,
  finalizeAndSubmitExit,
  summarizeCosignPayload,
  coSignPayloadAsAlly,
} = await import("../cosign");

const OPERATOR = "GOPERATOR";
const ALLY = "GALLY";

beforeEach(() => {
  mockPayout = makePayoutClient();
  mockIncomeHolders = [];
  mockQuoteAmountOut = async () => BigInt(920);
});

afterEach(() => {
  mock.restore();
});

describe("quoteEurcFloor", () => {
  it("derives the floor from a live router quote reduced by the configured slippage tolerance", async () => {
    mockPayout.eurc_swap_path_status = async () => ({
      result: {
        swap_router: "CROUTER",
        usdc_token: "CUSDC",
        eurc_token: "CEURC",
      },
    });
    mockQuoteAmountOut = async (args) => {
      expect(args).toMatchObject({
        routerAddress: "CROUTER",
        tokenIn: "CUSDC",
        tokenOut: "CEURC",
        amountIn: BigInt(1_000),
      });
      return BigInt(920);
    };

    const floor = await quoteEurcFloor({
      totalDistributableUsdc: BigInt(1_000),
      slippageBps: 100,
    });

    // Live quote of 920 EURC-stroops out for 1,000 USDC-stroops in, at a
    // 100 bps (1%) tolerance, matching `deriveMinEurcPerUsdc`'s own example.
    expect(floor).toBe(BigInt(9_108_000));
  });

  it("falls back to the configured default slippage tolerance when none is given", async () => {
    mockPayout.eurc_swap_path_status = async () => ({
      result: {
        swap_router: "CROUTER",
        usdc_token: "CUSDC",
        eurc_token: "CEURC",
      },
    });
    mockQuoteAmountOut = async () => BigInt(920);

    const floor = await quoteEurcFloor({
      totalDistributableUsdc: BigInt(1_000),
    });

    // Default tolerance is 100 bps (1%) unless overridden by
    // NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS; same result as the explicit case.
    expect(floor).toBe(BigInt(9_108_000));
  });

  it("refuses when EURC settlement is not configured on this deployment", async () => {
    mockPayout.eurc_swap_path_status = async () => ({ result: null });
    await expect(
      quoteEurcFloor({ totalDistributableUsdc: BigInt(1_000) }),
    ).rejects.toMatchObject({ reason: "quote_failed" });
  });

  it("translates a failed live quote into a CosignError instead of throwing raw", async () => {
    mockPayout.eurc_swap_path_status = async () => ({
      result: {
        swap_router: "CROUTER",
        usdc_token: "CUSDC",
        eurc_token: "CEURC",
      },
    });
    mockQuoteAmountOut = async () => {
      throw new RealSoroswapQuote.SoroswapQuoteError(
        "Soroswap router quote failed: no route",
      );
    };

    await expect(
      quoteEurcFloor({ totalDistributableUsdc: BigInt(1_000) }),
    ).rejects.toMatchObject({ reason: "quote_failed" });
  });
});

describe("prepareExecuteDistribution", () => {
  it("refuses to prepare while the contract is paused", async () => {
    mockPayout.is_paused = async () => ({ result: true });
    await expect(
      prepareExecuteDistribution({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        totalDistributableUsdc: BigInt(100),
      }),
    ).rejects.toMatchObject({ reason: "paused" });
  });

  it("refuses to prepare once the pilot has exited", async () => {
    mockPayout.exit_status = async () => ({
      result: { reason: "done", at: 1 },
    });
    await expect(
      prepareExecuteDistribution({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        totalDistributableUsdc: BigInt(100),
      }),
    ).rejects.toMatchObject({ reason: "exited" });
  });

  it("refuses a zero EURC floor while a holder prefers EURC", async () => {
    mockIncomeHolders = ["GHOLDER"];
    mockPayout.get_currency_preference = async () => ({
      result: { tag: "Eurc" },
    });
    mockPayout.eurc_swap_path_status = async () => ({ result: null });
    await expect(
      prepareExecuteDistribution({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        totalDistributableUsdc: BigInt(100),
      }),
    ).rejects.toMatchObject({ reason: "quote_failed" });
  });

  it("prepares successfully when nobody prefers EURC", async () => {
    const { payloadJson, expiresAtLedger } = await prepareExecuteDistribution({
      operator: OPERATOR,
      ally: ALLY,
      cycleId: "2026-03",
      totalDistributableUsdc: BigInt(100),
    });
    expect(payloadJson).toBe("reconstructed-payload-json");
    expect(expiresAtLedger).toBeGreaterThan(1_000_000);
  });
});

describe("summarizeExecuteDistribution", () => {
  it("decodes every field from the reconstructed invocation, not from a separate parameter", () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-07",
          BigInt(12_345),
        ]),
        needsNonInvokerSigningBy: () => [],
      });
    const summary = summarizeExecuteDistribution("some-payload");
    expect(summary.cycleId).toBe("2026-07");
    expect(summary.operator).toBe(OPERATOR);
    expect(summary.ally).toBe(ALLY);
    expect(summary.minEurcPerUsdc).toBe(BigInt(12_345));
    expect(summary.readyToFinalize).toBe(true);
  });

  it("decodes the holder/fee totals from the transaction's own simulated result, not a caller-supplied value", () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-07",
          BigInt(0),
        ]),
        result: distributionResult({
          distributed_total: BigInt(1_000_0000000),
          eurc_distributed_total: BigInt(200_0000000),
          holder_amount: BigInt(950_0000000),
          holder_count: 4,
          platform_fee: BigInt(50_0000000),
        }),
      });
    const summary = summarizeExecuteDistribution("some-payload");
    expect(summary.distributedTotal).toBe(BigInt(1_000_0000000));
    expect(summary.eurcDistributedTotal).toBe(BigInt(200_0000000));
    expect(summary.holderAmount).toBe(BigInt(950_0000000));
    expect(summary.holderCount).toBe(4);
    expect(summary.platformFee).toBe(BigInt(50_0000000));
  });

  it("refuses to summarize a payload invoking a contract other than the configured payout contract", () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation(
          "execute_distribution",
          [OPERATOR, ALLY, "2026-07", BigInt(0)],
          "CIMPOSTOR",
        ),
      });
    expect(() => summarizeExecuteDistribution("some-payload")).toThrow(
      expect.objectContaining({ reason: "wrong_contract" }),
    );
  });

  it("refuses to summarize a payload whose simulated result is missing", () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-07",
          BigInt(0),
        ]),
        result: undefined,
      });
    expect(() => summarizeExecuteDistribution("some-payload")).toThrow(
      expect.objectContaining({ reason: "not_ready_to_finalize" }),
    );
  });

  it("a different payload's mock invocation produces a different summary, proving there is no other data source", () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-01",
          BigInt(0),
        ]),
      });
    const first = summarizeExecuteDistribution("payload-a");

    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-02",
          BigInt(0),
        ]),
      });
    const second = summarizeExecuteDistribution("payload-b");

    expect(first.cycleId).toBe("2026-01");
    expect(second.cycleId).toBe("2026-02");
  });
});

describe("coSignAsAlly", () => {
  function preparedTx(stillNeeds: string[]) {
    return makeTx({
      built: invocation("execute_distribution", [
        OPERATOR,
        ALLY,
        "2026-03",
        BigInt(0),
      ]),
      needsNonInvokerSigningBy: () => stillNeeds,
    });
  }

  it("refuses when the connected wallet is not the addressed ally", async () => {
    mockPayout.fromJSON.execute_distribution = () => preparedTx([ALLY]);
    await expect(
      coSignAsAlly({
        payloadJson: "payload",
        allyAddress: "GSOMEONEELSE",
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "wrong_signer" });
  });

  it("refuses when the ally has already signed", async () => {
    mockPayout.fromJSON.execute_distribution = () => preparedTx([]);
    await expect(
      coSignAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "already_signed" });
  });

  it("signs and returns an updated payload for the correct ally", async () => {
    mockPayout.fromJSON.execute_distribution = () => preparedTx([ALLY]);
    mockPayout.get_evidence = async () => ({
      result: { status: { tag: "Approved" } },
    });
    const { payloadJson } = await coSignAsAlly({
      payloadJson: "payload",
      allyAddress: ALLY,
      signAuthEntry: async () => "signed",
    });
    expect(payloadJson).toBe("reconstructed-payload-json");
  });

  it("refuses a payload invoking a contract other than the configured payout contract", async () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation(
          "execute_distribution",
          [OPERATOR, ALLY, "2026-03", BigInt(0)],
          "CIMPOSTOR",
        ),
        needsNonInvokerSigningBy: () => [ALLY],
      });
    await expect(
      coSignAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "wrong_contract" });
  });

  it("refuses to sign once the cycle's evidence status has changed since the request was prepared", async () => {
    mockPayout.fromJSON.execute_distribution = () => preparedTx([ALLY]);
    mockPayout.get_evidence = async () => ({
      result: { status: { tag: "Submitted" } },
    });
    await expect(
      coSignAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "cycle_status_changed" });
  });

  it("translates an expired signing window into a CosignError", async () => {
    const { AssembledTransaction } =
      await import("@stellar/stellar-sdk/contract");
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
        needsNonInvokerSigningBy: () => [ALLY],
        signAuthEntries: async () => {
          throw new AssembledTransaction.Errors.ExpiredState(
            "the request has expired",
          );
        },
      });
    mockPayout.get_evidence = async () => ({
      result: { status: { tag: "Approved" } },
    });
    await expect(
      coSignAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("finalizeAndSubmitExecuteDistribution", () => {
  it("refuses when the connected wallet is not the addressed operator", async () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
        needsNonInvokerSigningBy: () => [],
      });
    await expect(
      finalizeAndSubmitExecuteDistribution({
        payloadJson: "payload",
        operatorAddress: "GSOMEONEELSE",
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "wrong_signer" });
  });

  it("refuses while the ally has not signed yet", async () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
        needsNonInvokerSigningBy: () => [ALLY],
      });
    await expect(
      finalizeAndSubmitExecuteDistribution({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "not_ready_to_finalize" });
  });

  it("signs and submits once every signature is collected", async () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
        needsNonInvokerSigningBy: () => [],
      });
    mockPayout.get_evidence = async () => ({
      result: { status: { tag: "Approved" } },
    });
    const { hash } = await finalizeAndSubmitExecuteDistribution({
      payloadJson: "payload",
      operatorAddress: OPERATOR,
      signTransaction: async (xdr: string) => xdr,
    });
    expect(hash).toBe("abcdef123456");
  });

  it("refuses to finalize once the cycle's evidence status has changed since the request was prepared", async () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
        needsNonInvokerSigningBy: () => [],
      });
    mockPayout.get_evidence = async () => ({
      result: { status: { tag: "Disputed" } },
    });
    await expect(
      finalizeAndSubmitExecuteDistribution({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "cycle_status_changed" });
  });

  it("translates an expired request into a CosignError at finalize time", async () => {
    const { AssembledTransaction } =
      await import("@stellar/stellar-sdk/contract");
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
        needsNonInvokerSigningBy: () => [],
        sign: async () => {
          throw new AssembledTransaction.Errors.ExpiredState(
            "the request has expired",
          );
        },
      });
    mockPayout.get_evidence = async () => ({
      result: { status: { tag: "Approved" } },
    });
    await expect(
      finalizeAndSubmitExecuteDistribution({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("prepareRecordEvidence", () => {
  it("refuses a zero total income", async () => {
    await expect(
      prepareRecordEvidence({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        evidenceHash: Buffer.alloc(32),
        evidenceLink: "https://example.com",
        totalIncome: BigInt(0),
      }),
    ).rejects.toMatchObject({ reason: "zero_amount" });
  });

  it("refuses an evidence hash of the wrong length", async () => {
    await expect(
      prepareRecordEvidence({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        evidenceHash: Buffer.alloc(16),
        evidenceLink: "https://example.com",
        totalIncome: BigInt(100),
      }),
    ).rejects.toMatchObject({ reason: "invalid_evidence_hash" });
  });

  it("refuses a cycle that already has an evidence record", async () => {
    mockPayout.get_evidence = async () => ({
      result: { cycle_id: "2026-03" },
    });
    await expect(
      prepareRecordEvidence({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        evidenceHash: Buffer.alloc(32),
        evidenceLink: "https://example.com",
        totalIncome: BigInt(100),
      }),
    ).rejects.toMatchObject({ reason: "already_recorded" });
  });

  it("prepares successfully with valid arguments", async () => {
    const { payloadJson } = await prepareRecordEvidence({
      operator: OPERATOR,
      ally: ALLY,
      cycleId: "2026-03",
      evidenceHash: Buffer.alloc(32),
      evidenceLink: "https://example.com",
      totalIncome: BigInt(100),
    });
    expect(payloadJson).toBe("reconstructed-payload-json");
  });
});

describe("summarizeRecordEvidence", () => {
  it("decodes the evidence hash as lowercase hex from the invocation", () => {
    const summary = summarizeRecordEvidence("payload");
    expect(summary.evidenceHash).toBe("00".repeat(32));
    expect(summary.evidenceLink).toBe("https://example.com/statement");
    expect(summary.totalIncome).toBe(BigInt(500_0000000));
  });
});

describe("coSignRecordEvidenceAsAlly", () => {
  function preparedTx(stillNeeds: string[]) {
    return makeTx({
      built: invocation("record_evidence", [
        OPERATOR,
        ALLY,
        "2026-03",
        new Uint8Array(32),
        "https://example.com/statement",
        BigInt(500_0000000),
      ]),
      needsNonInvokerSigningBy: () => stillNeeds,
    });
  }

  it("refuses to sign once evidence has already been recorded for this cycle since the request was prepared", async () => {
    mockPayout.fromJSON.record_evidence = () => preparedTx([ALLY]);
    mockPayout.get_evidence = async () => ({
      result: { cycle_id: "2026-03" },
    });
    await expect(
      coSignRecordEvidenceAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "already_recorded" });
  });

  it("translates an expired signing window into a CosignError", async () => {
    const { AssembledTransaction } =
      await import("@stellar/stellar-sdk/contract");
    mockPayout.fromJSON.record_evidence = () =>
      makeTx({
        built: invocation("record_evidence", [
          OPERATOR,
          ALLY,
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
        needsNonInvokerSigningBy: () => [ALLY],
        signAuthEntries: async () => {
          throw new AssembledTransaction.Errors.ExpiredState(
            "the request has expired",
          );
        },
      });
    await expect(
      coSignRecordEvidenceAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("finalizeAndSubmitRecordEvidence", () => {
  it("refuses to finalize once evidence has already been recorded for this cycle since the request was prepared", async () => {
    mockPayout.fromJSON.record_evidence = () =>
      makeTx({
        built: invocation("record_evidence", [
          OPERATOR,
          ALLY,
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
        needsNonInvokerSigningBy: () => [],
      });
    mockPayout.get_evidence = async () => ({
      result: { cycle_id: "2026-03" },
    });
    await expect(
      finalizeAndSubmitRecordEvidence({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "already_recorded" });
  });

  it("translates an expired request into a CosignError at finalize time", async () => {
    const { AssembledTransaction } =
      await import("@stellar/stellar-sdk/contract");
    mockPayout.fromJSON.record_evidence = () =>
      makeTx({
        built: invocation("record_evidence", [
          OPERATOR,
          ALLY,
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
        needsNonInvokerSigningBy: () => [],
        sign: async () => {
          throw new AssembledTransaction.Errors.ExpiredState(
            "the request has expired",
          );
        },
      });
    await expect(
      finalizeAndSubmitRecordEvidence({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("prepareExit", () => {
  it("refuses an empty reason", async () => {
    await expect(
      prepareExit({ operator: OPERATOR, ally: ALLY, reason: "  " }),
    ).rejects.toMatchObject({ reason: "missing_reason" });
  });

  it("refuses once the pilot has already exited", async () => {
    mockPayout.exit_status = async () => ({
      result: { reason: "done", at: 1 },
    });
    await expect(
      prepareExit({ operator: OPERATOR, ally: ALLY, reason: "winding down" }),
    ).rejects.toMatchObject({ reason: "exited" });
  });

  it("is not blocked by a paused contract, unlike the other two flows", async () => {
    mockPayout.is_paused = async () => ({ result: true });
    const { payloadJson } = await prepareExit({
      operator: OPERATOR,
      ally: ALLY,
      reason: "winding down",
    });
    expect(payloadJson).toBe("reconstructed-payload-json");
  });
});

describe("summarizeExit", () => {
  it("decodes the reason from the invocation", () => {
    const summary = summarizeExit("payload");
    expect(summary.reason).toBe("winding down");
  });
});

describe("coSignExitAsAlly", () => {
  function preparedTx(stillNeeds: string[]) {
    return makeTx({
      built: invocation("exit", [OPERATOR, ALLY, "winding down"]),
      needsNonInvokerSigningBy: () => stillNeeds,
    });
  }

  it("refuses to sign once the pilot has already exited since the request was prepared", async () => {
    mockPayout.fromJSON.exit = () => preparedTx([ALLY]);
    mockPayout.exit_status = async () => ({
      result: { reason: "done", at: 1 },
    });
    await expect(
      coSignExitAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "exited" });
  });

  it("translates an expired signing window into a CosignError", async () => {
    const { AssembledTransaction } =
      await import("@stellar/stellar-sdk/contract");
    mockPayout.fromJSON.exit = () =>
      makeTx({
        built: invocation("exit", [OPERATOR, ALLY, "winding down"]),
        needsNonInvokerSigningBy: () => [ALLY],
        signAuthEntries: async () => {
          throw new AssembledTransaction.Errors.ExpiredState(
            "the request has expired",
          );
        },
      });
    await expect(
      coSignExitAsAlly({
        payloadJson: "payload",
        allyAddress: ALLY,
        signAuthEntry: async () => "signed",
      }),
    ).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("finalizeAndSubmitExit", () => {
  it("refuses to finalize once the pilot has already exited since the request was prepared", async () => {
    mockPayout.fromJSON.exit = () =>
      makeTx({
        built: invocation("exit", [OPERATOR, ALLY, "winding down"]),
        needsNonInvokerSigningBy: () => [],
      });
    mockPayout.exit_status = async () => ({
      result: { reason: "done", at: 1 },
    });
    await expect(
      finalizeAndSubmitExit({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "exited" });
  });

  it("translates an expired request into a CosignError at finalize time", async () => {
    const { AssembledTransaction } =
      await import("@stellar/stellar-sdk/contract");
    mockPayout.fromJSON.exit = () =>
      makeTx({
        built: invocation("exit", [OPERATOR, ALLY, "winding down"]),
        needsNonInvokerSigningBy: () => [],
        sign: async () => {
          throw new AssembledTransaction.Errors.ExpiredState(
            "the request has expired",
          );
        },
      });
    await expect(
      finalizeAndSubmitExit({
        payloadJson: "payload",
        operatorAddress: OPERATOR,
        signTransaction: async (xdr: string) => xdr,
      }),
    ).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("summarizeCosignPayload / coSignPayloadAsAlly", () => {
  it("detects an execute_distribution payload from the invocation's function name", () => {
    mockPayout.txFromJson = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
      });
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [
          OPERATOR,
          ALLY,
          "2026-03",
          BigInt(0),
        ]),
      });
    const summary = summarizeCosignPayload("payload");
    expect(summary.kind).toBe("execute_distribution");
  });

  it("detects a record_evidence payload from the invocation's function name", () => {
    mockPayout.txFromJson = () =>
      makeTx({
        built: invocation("record_evidence", [
          OPERATOR,
          ALLY,
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
      });
    const summary = summarizeCosignPayload("payload");
    expect(summary.kind).toBe("record_evidence");
  });

  it("detects an exit payload from the invocation's function name", () => {
    mockPayout.txFromJson = () =>
      makeTx({
        built: invocation("exit", [OPERATOR, ALLY, "winding down"]),
      });
    const summary = summarizeCosignPayload("payload");
    expect(summary.kind).toBe("exit");
  });

  it("dispatches coSignPayloadAsAlly to the record_evidence flow", async () => {
    mockPayout.txFromJson = () =>
      makeTx({
        built: invocation("record_evidence", [
          OPERATOR,
          ALLY,
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
        needsNonInvokerSigningBy: () => [ALLY],
      });
    mockPayout.fromJSON.record_evidence = () =>
      makeTx({
        built: invocation("record_evidence", [
          OPERATOR,
          ALLY,
          "2026-03",
          new Uint8Array(32),
          "https://example.com/statement",
          BigInt(500_0000000),
        ]),
        needsNonInvokerSigningBy: () => [ALLY],
      });
    const { summary } = await coSignPayloadAsAlly({
      payloadJson: "payload",
      allyAddress: ALLY,
      signAuthEntry: async () => "signed",
    });
    expect(summary.kind).toBe("record_evidence");
  });
});

describe("CosignError", () => {
  it("carries a machine-checkable reason alongside the message", () => {
    const error = new CosignError("boom", "paused");
    expect(error.reason).toBe("paused");
    expect(error.message).toBe("boom");
    expect(error).toBeInstanceOf(Error);
  });
});
