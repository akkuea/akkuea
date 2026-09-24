import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

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

/** Builds a fake `tx.built.operations[0]`, the shape `decodeInvocationArgs`
 * reads: a `hostFunctionTypeInvokeContract` invocation whose args array is
 * already in "decoded" form, since the mock `spec.scValToNative` below is
 * the identity function. */
function invocation(functionName: string, args: unknown[]) {
  return {
    operations: [
      {
        type: "invokeHostFunction",
        func: {
          type: "hostFunctionTypeInvokeContract",
          invokeContract: {
            functionName: { toStringStrict: () => functionName },
            args,
          },
        },
      },
    ],
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
      0n,
    ]),
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
          500_0000000n,
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
    execute_distribution: overrides.fromJSON?.execute_distribution ?? (() => makeTx()),
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
            500_0000000n,
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
    SOROBAN_RPC: { TESTNET: "https://testnet.example", MAINNET: "https://mainnet.example" },
  },
}));

mock.module("@stellar/stellar-sdk/rpc", () => ({
  Server: class {
    getLatestLedger = async () => ({ sequence: 1_000_000 });
  },
}));

const {
  CosignError,
  prepareExecuteDistribution,
  summarizeExecuteDistribution,
  coSignAsAlly,
  finalizeAndSubmitExecuteDistribution,
  prepareRecordEvidence,
  summarizeRecordEvidence,
  prepareExit,
  summarizeExit,
  summarizeCosignPayload,
  coSignPayloadAsAlly,
} = await import("../cosign");

const OPERATOR = "GOPERATOR";
const ALLY = "GALLY";

beforeEach(() => {
  mockPayout = makePayoutClient();
  mockIncomeHolders = [];
});

afterEach(() => {
  mock.restore();
});

describe("prepareExecuteDistribution", () => {
  it("refuses to prepare while the contract is paused", async () => {
    mockPayout.is_paused = async () => ({ result: true });
    await expect(
      prepareExecuteDistribution({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        totalDistributableUsdc: 100n,
      }),
    ).rejects.toMatchObject({ reason: "paused" });
  });

  it("refuses to prepare once the pilot has exited", async () => {
    mockPayout.exit_status = async () => ({ result: { reason: "done", at: 1 } });
    await expect(
      prepareExecuteDistribution({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        totalDistributableUsdc: 100n,
      }),
    ).rejects.toMatchObject({ reason: "exited" });
  });

  it("refuses a zero EURC floor while a holder prefers EURC", async () => {
    mockIncomeHolders = ["GHOLDER"];
    mockPayout.get_currency_preference = async () => ({ result: { tag: "Eurc" } });
    mockPayout.eurc_swap_path_status = async () => ({ result: null });
    await expect(
      prepareExecuteDistribution({
        operator: OPERATOR,
        ally: ALLY,
        cycleId: "2026-03",
        totalDistributableUsdc: 100n,
      }),
    ).rejects.toMatchObject({ reason: "quote_failed" });
  });

  it("prepares successfully when nobody prefers EURC", async () => {
    const { payloadJson, expiresAtLedger } = await prepareExecuteDistribution({
      operator: OPERATOR,
      ally: ALLY,
      cycleId: "2026-03",
      totalDistributableUsdc: 100n,
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
          12_345n,
        ]),
        needsNonInvokerSigningBy: () => [],
      });
    const summary = summarizeExecuteDistribution("some-payload");
    expect(summary.cycleId).toBe("2026-07");
    expect(summary.operator).toBe(OPERATOR);
    expect(summary.ally).toBe(ALLY);
    expect(summary.minEurcPerUsdc).toBe(12_345n);
    expect(summary.readyToFinalize).toBe(true);
  });

  it("a different payload's mock invocation produces a different summary, proving there is no other data source", () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-01", 0n]),
      });
    const first = summarizeExecuteDistribution("payload-a");

    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-02", 0n]),
      });
    const second = summarizeExecuteDistribution("payload-b");

    expect(first.cycleId).toBe("2026-01");
    expect(second.cycleId).toBe("2026-02");
  });
});

describe("coSignAsAlly", () => {
  function preparedTx(stillNeeds: string[]) {
    return makeTx({
      built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-03", 0n]),
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
    const { payloadJson } = await coSignAsAlly({
      payloadJson: "payload",
      allyAddress: ALLY,
      signAuthEntry: async () => "signed",
    });
    expect(payloadJson).toBe("reconstructed-payload-json");
  });
});

describe("finalizeAndSubmitExecuteDistribution", () => {
  it("refuses when the connected wallet is not the addressed operator", async () => {
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-03", 0n]),
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
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-03", 0n]),
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
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-03", 0n]),
        needsNonInvokerSigningBy: () => [],
      });
    const { hash } = await finalizeAndSubmitExecuteDistribution({
      payloadJson: "payload",
      operatorAddress: OPERATOR,
      signTransaction: async (xdr: string) => xdr,
    });
    expect(hash).toBe("abcdef123456");
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
        totalIncome: 0n,
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
        totalIncome: 100n,
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
        totalIncome: 100n,
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
      totalIncome: 100n,
    });
    expect(payloadJson).toBe("reconstructed-payload-json");
  });
});

describe("summarizeRecordEvidence", () => {
  it("decodes the evidence hash as lowercase hex from the invocation", () => {
    const summary = summarizeRecordEvidence("payload");
    expect(summary.evidenceHash).toBe("00".repeat(32));
    expect(summary.evidenceLink).toBe("https://example.com/statement");
    expect(summary.totalIncome).toBe(500_0000000n);
  });
});

describe("prepareExit", () => {
  it("refuses an empty reason", async () => {
    await expect(
      prepareExit({ operator: OPERATOR, ally: ALLY, reason: "  " }),
    ).rejects.toMatchObject({ reason: "missing_reason" });
  });

  it("refuses once the pilot has already exited", async () => {
    mockPayout.exit_status = async () => ({ result: { reason: "done", at: 1 } });
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

describe("summarizeCosignPayload / coSignPayloadAsAlly", () => {
  it("detects an execute_distribution payload from the invocation's function name", () => {
    mockPayout.txFromJson = () =>
      makeTx({
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-03", 0n]),
      });
    mockPayout.fromJSON.execute_distribution = () =>
      makeTx({
        built: invocation("execute_distribution", [OPERATOR, ALLY, "2026-03", 0n]),
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
          500_0000000n,
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
          500_0000000n,
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
          500_0000000n,
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
