import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { Networks } from "@stellar/stellar-sdk";

/**
 * `writes.ts` only ever talks to the payout contract through
 * `PilotPayoutSplitClient`, so these tests replace that class (and
 * `buildContractClientOptions`, to capture what the client is built with) at
 * the module boundary. Nothing here touches the network.
 *
 * `bun test` keeps a `mock.module` in effect for the rest of the process, so
 * the real module is spread in and only what these tests control is replaced;
 * the module as it was before this file is put back in `afterAll`.
 */

interface MockTx {
  signAndSend: () => Promise<{
    sendTransactionResponse?: { hash?: string } | null;
  }>;
}

type PayoutCall = (args: Record<string, unknown>) => Promise<MockTx>;

/** Every contract method the write layer calls, recorded as it is invoked. */
let mockPayout: Record<string, ReturnType<typeof mock<PayoutCall>>>;
let clientOptions: Array<{
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  publicKey: string;
  signTransaction: (
    xdr: string,
  ) => Promise<{ signedTxXdr: string; signerAddress: string }>;
}>;
let sendResponse: { hash?: string } | null | undefined;

/**
 * The committed contract ids. `bun test` copies the object a `mock.module`
 * factory returns once, so this one object is mutated in place rather than
 * swapped, and `config.ts` reads the current values on every call.
 */
const CONTRACT_IDS = {
  PILOT_PAYOUT_SPLIT: { TESTNET: "", MAINNET: "" },
  PILOT_INCOME_TOKEN: { TESTNET: "", MAINNET: "" },
  PILOT_WHITELIST: { TESTNET: "", MAINNET: "" },
};

function setContractIds(ids: { payout: string; token: string; list: string }) {
  for (const network of ["TESTNET", "MAINNET"] as const) {
    CONTRACT_IDS.PILOT_PAYOUT_SPLIT[network] = ids.payout;
    CONTRACT_IDS.PILOT_INCOME_TOKEN[network] = ids.token;
    CONTRACT_IDS.PILOT_WHITELIST[network] = ids.list;
  }
}

const DEPLOYED = { payout: "CPAYOUT", token: "CINCOME", list: "CWHITELIST" };
const NOT_DEPLOYED = { payout: "", token: "", list: "" };

function makePayoutClient() {
  const method = () =>
    mock<PayoutCall>(async () => ({
      signAndSend: async () => ({ sendTransactionResponse: sendResponse }),
    }));
  return {
    submit_evidence: method(),
    start_review: method(),
    review_evidence: method(),
    flag_dispute: method(),
    set_currency_preference: method(),
    claim_withheld: method(),
  };
}

const RealShared = await import("@akkuea/shared");
mock.module("@akkuea/shared", () => ({
  ...RealShared,
  buildContractClientOptions: (config: (typeof clientOptions)[number]) => {
    clientOptions.push(config);
    return config;
  },
  PilotPayoutSplitClient: class {
    constructor() {
      return mockPayout as unknown as object;
    }
  },
  CONTRACT_IDS,
  API_ENDPOINTS: {
    SOROBAN_RPC: {
      TESTNET: "https://testnet.example",
      MAINNET: "https://mainnet.example",
    },
  },
}));

// A cache-busting query string loads the module afresh, so it binds to the
// mocked client even if another test file imported it earlier.
const writesSpecifier: string = "../writes.ts?fresh-import";
const {
  submitEvidence,
  startReview,
  reviewEvidence,
  flagDispute,
  setCurrencyPreference,
  claimWithheld,
}: typeof import("../writes") = await import(writesSpecifier);

const ALLY = "GALLY";
const OPERATOR = "GOPERATOR";
const HOLDER = "GHOLDER";
const HASH = "a".repeat(64);

/** Environment variables that steer `config.ts`; restored after each test. */
const ENV_KEYS = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_SOROBAN_RPC_URL",
  "NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID",
  "NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID",
  "NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID",
] as const;
const savedEnv: Record<string, string | undefined> = {};

const signXdr = mock<(xdr: string, passphrase: string) => Promise<string>>(
  async (xdr) => `signed:${xdr}`,
);

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  setContractIds(DEPLOYED);
  mockPayout = makePayoutClient();
  clientOptions = [];
  sendResponse = { hash: HASH };
  signXdr.mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

afterAll(() => {
  mock.module("@akkuea/shared", () => RealShared);
});

describe("argument mapping", () => {
  it("submitEvidence maps camelCase arguments to the snake_case contract arguments", async () => {
    const evidenceHash = Buffer.alloc(32, 7);

    const result = await submitEvidence(
      {
        ally: ALLY,
        cycleId: "2026-03",
        evidenceHash,
        evidenceLink: "https://example.org/evidence.pdf",
        totalIncome: BigInt(1_250_000_000),
      },
      signXdr,
    );

    expect(mockPayout.submit_evidence).toHaveBeenCalledTimes(1);
    expect(mockPayout.submit_evidence.mock.calls[0][0]).toEqual({
      ally: ALLY,
      cycle_id: "2026-03",
      evidence_hash: evidenceHash,
      evidence_link: "https://example.org/evidence.pdf",
      total_income: BigInt(1_250_000_000),
    });
    expect(result).toEqual({ hash: HASH });
  });

  it("startReview sends the operator and the cycle id", async () => {
    const result = await startReview(OPERATOR, "2026-03", signXdr);

    expect(mockPayout.start_review.mock.calls[0][0]).toEqual({
      operator: OPERATOR,
      cycle_id: "2026-03",
    });
    expect(result).toEqual({ hash: HASH });
  });

  it("reviewEvidence sends the decision and the reason", async () => {
    await reviewEvidence(
      {
        operator: OPERATOR,
        cycleId: "2026-03",
        approved: false,
        reason: "The statement is missing page 2",
      },
      signXdr,
    );

    expect(mockPayout.review_evidence.mock.calls[0][0]).toEqual({
      operator: OPERATOR,
      cycle_id: "2026-03",
      approved: false,
      reason: "The statement is missing page 2",
    });
  });

  it("reviewEvidence passes an approval through unchanged", async () => {
    await reviewEvidence(
      { operator: OPERATOR, cycleId: "2026-04", approved: true, reason: "" },
      signXdr,
    );

    expect(mockPayout.review_evidence.mock.calls[0][0]).toEqual({
      operator: OPERATOR,
      cycle_id: "2026-04",
      approved: true,
      reason: "",
    });
  });

  it("flagDispute sends the caller, the cycle id and the reason", async () => {
    await flagDispute(
      { caller: OPERATOR, cycleId: "2026-03", reason: "Income does not match" },
      signXdr,
    );

    expect(mockPayout.flag_dispute.mock.calls[0][0]).toEqual({
      caller: OPERATOR,
      cycle_id: "2026-03",
      reason: "Income does not match",
    });
  });

  it("claimWithheld sends only the holder", async () => {
    const result = await claimWithheld(HOLDER, signXdr);

    expect(mockPayout.claim_withheld.mock.calls[0][0]).toEqual({
      holder: HOLDER,
    });
    expect(result).toEqual({ hash: HASH });
  });

  it("each write builds the client for the account that signs it", async () => {
    await submitEvidence(
      {
        ally: ALLY,
        cycleId: "2026-03",
        evidenceHash: Buffer.alloc(32),
        evidenceLink: "x",
        totalIncome: BigInt(1),
      },
      signXdr,
    );
    await startReview(OPERATOR, "2026-03", signXdr);
    await reviewEvidence(
      { operator: OPERATOR, cycleId: "2026-03", approved: true, reason: "" },
      signXdr,
    );
    await flagDispute(
      { caller: OPERATOR, cycleId: "2026-03", reason: "r" },
      signXdr,
    );
    await setCurrencyPreference({ holder: HOLDER, currency: "usdc" }, signXdr);
    await claimWithheld(HOLDER, signXdr);

    expect(clientOptions.map((options) => options.publicKey)).toEqual([
      ALLY,
      OPERATOR,
      OPERATOR,
      OPERATOR,
      HOLDER,
      HOLDER,
    ]);
  });
});

describe("setCurrencyPreference", () => {
  it('sends { tag: "Eurc" } for "eurc"', async () => {
    await setCurrencyPreference({ holder: HOLDER, currency: "eurc" }, signXdr);

    const sent = mockPayout.set_currency_preference.mock.calls[0][0];
    expect(sent.holder).toBe(HOLDER);
    expect(sent.currency).toEqual({ tag: "Eurc" });
  });

  it('sends { tag: "Usdc" } for "usdc"', async () => {
    await setCurrencyPreference({ holder: HOLDER, currency: "usdc" }, signXdr);

    const sent = mockPayout.set_currency_preference.mock.calls[0][0];
    expect(sent.holder).toBe(HOLDER);
    expect(sent.currency).toEqual({ tag: "Usdc" });
  });
});

describe("signing adapter", () => {
  it("passes the testnet passphrase to the wallet and returns the signed XDR", async () => {
    await claimWithheld(HOLDER, signXdr);

    const options = clientOptions[0];
    expect(options.networkPassphrase).toBe(Networks.TESTNET);

    const signed = await options.signTransaction("UNSIGNED_XDR");

    expect(signXdr).toHaveBeenCalledTimes(1);
    expect(signXdr).toHaveBeenCalledWith("UNSIGNED_XDR", Networks.TESTNET);
    expect(signed).toEqual({
      signedTxXdr: "signed:UNSIGNED_XDR",
      signerAddress: HOLDER,
    });
  });

  it("passes the public network passphrase when the dashboard is on mainnet", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

    await claimWithheld(HOLDER, signXdr);
    await clientOptions[0].signTransaction("UNSIGNED_XDR");

    expect(clientOptions[0].networkPassphrase).toBe(Networks.PUBLIC);
    expect(signXdr).toHaveBeenCalledWith("UNSIGNED_XDR", Networks.PUBLIC);
  });

  it("does not ask the wallet to sign until the client does", async () => {
    await claimWithheld(HOLDER, signXdr);

    expect(signXdr).not.toHaveBeenCalled();
  });

  it("builds the client for the configured payout contract and RPC", async () => {
    await claimWithheld(HOLDER, signXdr);

    expect(clientOptions[0].contractId).toBe("CPAYOUT");
    expect(clientOptions[0].rpcUrl).toBe("https://testnet.example");
  });

  it("uses a contract id and RPC URL from the environment over the committed ones", async () => {
    process.env.NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID = "COVERRIDE";
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://rpc.local";

    await claimWithheld(HOLDER, signXdr);

    expect(clientOptions[0].contractId).toBe("COVERRIDE");
    expect(clientOptions[0].rpcUrl).toBe("https://rpc.local");
  });
});

describe("when the pilot contracts are not deployed", () => {
  const notDeployed = /pilot contracts are not deployed.*payoutSplit/;

  beforeEach(() => {
    setContractIds(NOT_DEPLOYED);
  });

  const writes: Array<[string, () => Promise<unknown>]> = [
    [
      "submitEvidence",
      () =>
        submitEvidence(
          {
            ally: ALLY,
            cycleId: "2026-03",
            evidenceHash: Buffer.alloc(32),
            evidenceLink: "x",
            totalIncome: BigInt(1),
          },
          signXdr,
        ),
    ],
    ["startReview", () => startReview(OPERATOR, "2026-03", signXdr)],
    [
      "reviewEvidence",
      () =>
        reviewEvidence(
          {
            operator: OPERATOR,
            cycleId: "2026-03",
            approved: true,
            reason: "",
          },
          signXdr,
        ),
    ],
    [
      "flagDispute",
      () =>
        flagDispute(
          { caller: OPERATOR, cycleId: "2026-03", reason: "r" },
          signXdr,
        ),
    ],
    [
      "setCurrencyPreference",
      () =>
        setCurrencyPreference({ holder: HOLDER, currency: "eurc" }, signXdr),
    ],
    ["claimWithheld", () => claimWithheld(HOLDER, signXdr)],
  ];

  for (const [name, call] of writes) {
    it(`${name} throws a clear error and builds no transaction`, async () => {
      await expect(call()).rejects.toThrow(notDeployed);

      expect(clientOptions).toHaveLength(0);
      for (const fn of Object.values(mockPayout)) {
        expect(fn).not.toHaveBeenCalled();
      }
    });
  }

  it("names every missing contract in the message", async () => {
    await expect(claimWithheld(HOLDER, signXdr)).rejects.toThrow(
      /payoutSplit, incomeToken, whitelist/,
    );
  });

  it("is a PilotNotDeployedError", async () => {
    const { PilotNotDeployedError } = await import("../config");

    await expect(claimWithheld(HOLDER, signXdr)).rejects.toBeInstanceOf(
      PilotNotDeployedError,
    );
  });
});

describe("a send response without a transaction hash", () => {
  const noHash = /returned no transaction hash/;

  it("is an error for a response with an empty hash", async () => {
    sendResponse = { hash: "" };

    await expect(claimWithheld(HOLDER, signXdr)).rejects.toThrow(noHash);
  });

  it("is an error for a response object with no hash field", async () => {
    sendResponse = {};

    await expect(startReview(OPERATOR, "2026-03", signXdr)).rejects.toThrow(
      noHash,
    );
  });

  it("is an error when there is no send response at all", async () => {
    sendResponse = undefined;

    await expect(
      flagDispute(
        { caller: OPERATOR, cycleId: "2026-03", reason: "r" },
        signXdr,
      ),
    ).rejects.toThrow(noHash);

    sendResponse = null;

    await expect(
      setCurrencyPreference({ holder: HOLDER, currency: "usdc" }, signXdr),
    ).rejects.toThrow(noHash);
  });

  it("never resolves to a result with an empty hash", async () => {
    sendResponse = {};

    const outcome = await claimWithheld(HOLDER, signXdr).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );

    expect(outcome).not.toHaveProperty("result");
    expect(outcome).toHaveProperty("error");
  });
});

describe("failures from the contract client", () => {
  it("propagates a rejection from the wallet or network unchanged", async () => {
    const failure = new Error("User declined to sign");
    mockPayout.claim_withheld = mock<PayoutCall>(async () => ({
      signAndSend: async () => {
        throw failure;
      },
    }));

    await expect(claimWithheld(HOLDER, signXdr)).rejects.toBe(failure);
  });

  it("propagates a rejection from building the transaction", async () => {
    const failure = new Error("simulation failed");
    mockPayout.start_review = mock<PayoutCall>(async () => {
      throw failure;
    });

    await expect(startReview(OPERATOR, "2026-03", signXdr)).rejects.toBe(
      failure,
    );
  });
});
