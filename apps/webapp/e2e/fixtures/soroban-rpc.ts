import type { Page, Route } from "@playwright/test";
import {
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  xdr,
  Networks,
} from "@stellar/stellar-sdk";
import type { PilotEvidenceStatusTag } from "@akkuea/shared";

/**
 * Realistic XDR and JSON-RPC mocking for Soroban RPC at the browser network layer.
 *
 * Simulates Soroban RPC responses for contract reads (get_evidence, is_paused,
 * balance, total_supply, decimals, symbol, is_approved) and writes
 * (submit_evidence, start_review, review_evidence, flag_dispute,
 * execute_distribution) generated directly from the typed client specs.
 */

export interface ScenarioCycleState {
  cycleId: string;
  evidenceHashHex?: string;
  evidenceLink?: string;
  totalIncome?: bigint;
  status?: PilotEvidenceStatusTag;
  recordedAt?: number;
  submittedAt?: number;
  reviewedAt?: number;
  reviewReason?: string;
  distributed?: boolean;
  distributedAt?: number;
}

export interface ScenarioHoldingsState {
  balance: bigint;
  totalSupply: bigint;
  decimals: number;
  symbol: string;
  whitelisted: boolean;
}

export interface DecodedContractCall {
  contractId: string;
  functionName: string;
  rawArgs: xdr.ScVal[];
  args: Record<string, unknown>;
}

type ContractCallLike = {
  contractAddress:
    | (() => {
        arm?(): string;
        type?: string;
        contractId?(): Buffer;
        value?: Uint8Array;
      })
    | {
        arm?(): string;
        type?: string;
        contractId?(): Buffer;
        value?: Uint8Array;
      };
  functionName: (() => { toString(): string }) | { toString(): string };
  args: (() => xdr.ScVal[]) | xdr.ScVal[];
};

type HostFunctionLike = {
  arm?(): string;
  invokeContract?(): ContractCallLike;
  type?: string;
  value?: ContractCallLike;
};

type TransactionLike = {
  operations: Array<{
    type: string;
    func?: HostFunctionLike;
  }>;
};

function contractCallFromHost(host: HostFunctionLike): ContractCallLike | null {
  if (host.arm?.() === "invokeContract" && host.invokeContract) {
    return host.invokeContract();
  }
  if (host.type === "hostFunctionTypeInvokeContract" && host.value) {
    return host.value;
  }
  return null;
}

function normalizeContractCall(call: ContractCallLike): {
  address: {
    arm?(): string;
    type?: string;
    contractId?(): Buffer;
    value?: Uint8Array;
  };
  functionName: string;
  args: xdr.ScVal[];
} {
  const address =
    typeof call.contractAddress === "function"
      ? call.contractAddress()
      : call.contractAddress;
  const functionName =
    typeof call.functionName === "function"
      ? call.functionName().toString()
      : call.functionName.toString();
  const args = typeof call.args === "function" ? call.args() : call.args;
  return { address, functionName, args };
}

type LowLevelTransactionLike = {
  operations(): Array<{
    body(): {
      arm(): string;
      invokeHostFunctionOp(): { hostFunction(): HostFunctionLike };
    };
  }>;
};

type EnvelopeLike = {
  switch?(): string;
  v0?(): { tx(): LowLevelTransactionLike };
  v1?(): { tx(): LowLevelTransactionLike };
  tx?(): LowLevelTransactionLike;
  value?(): { tx(): LowLevelTransactionLike };
};

/**
 * Creates a minimal valid base64-encoded SorobanTransactionData XDR.
 */
function createDummyTransactionData(): string {
  // This opaque placeholder is only used in mocked simulation responses. The
  // installed SDK exposes the corresponding XDR constructors as abstract
  // interfaces, so constructing the object here is not type-safe.
  return "AAAAAgAAAAAAAAAAAAAAAQAAAAAAAAAA";
}

const DEFAULT_TX_DATA = createDummyTransactionData();

/**
 * Converts a JS value into an ScVal for Soroban RPC simulation returns.
 */
export function encodeScVal(value: unknown): xdr.ScVal {
  if (value === undefined || value === null) {
    return xdr.ScVal.scvVoid();
  }
  if (typeof value === "boolean") {
    return xdr.ScVal.scvBool(value);
  }
  if (typeof value === "string") {
    return xdr.ScVal.scvString(value);
  }
  if (typeof value === "number") {
    return xdr.ScVal.scvU32(value);
  }
  if (typeof value === "bigint") {
    return nativeToScVal(value, { type: "i128" });
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return xdr.ScVal.scvBytes(Buffer.from(value));
  }
  if (Array.isArray(value)) {
    return xdr.ScVal.scvVec(value.map(encodeScVal));
  }
  if (typeof value === "object") {
    // Check if it's already an ScVal
    if (
      "arm" in (value as object) &&
      typeof (value as { toXDR?: unknown }).toXDR === "function"
    ) {
      return value as xdr.ScVal;
    }
    const entries: xdr.ScMapEntry[] = Object.entries(value).map(([k, v]) => {
      return new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(k),
        val: encodeScVal(v),
      });
    });
    return xdr.ScVal.scvMap(entries);
  }
  return xdr.ScVal.scvVoid();
}

/**
 * Encodes a PilotEvidenceRecord into Soroban ScVal map format.
 */
export function encodeEvidenceRecordScVal(
  record: ScenarioCycleState | undefined,
): xdr.ScVal {
  if (!record || !record.status) {
    return xdr.ScVal.scvVoid();
  }

  const hashBuffer = record.evidenceHashHex
    ? Buffer.from(record.evidenceHashHex.replace(/^0x/, ""), "hex")
    : Buffer.alloc(32);

  const statusEnumVal = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(record.status)]);

  const mapEntries: xdr.ScMapEntry[] = [
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("cycle_id"),
      val: xdr.ScVal.scvString(record.cycleId),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("evidence_hash"),
      val: xdr.ScVal.scvBytes(hashBuffer),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("evidence_link"),
      val: xdr.ScVal.scvString(record.evidenceLink ?? ""),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("total_income"),
      val: nativeToScVal(record.totalIncome ?? BigInt(0), { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("status"),
      val: statusEnumVal,
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("recorded_at"),
      val: nativeToScVal(
        BigInt(record.recordedAt ?? Math.floor(Date.now() / 1000)),
        { type: "u64" },
      ),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("submitted_at"),
      val: nativeToScVal(
        BigInt(record.submittedAt ?? Math.floor(Date.now() / 1000)),
        { type: "u64" },
      ),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("reviewed_at"),
      val: nativeToScVal(BigInt(record.reviewedAt ?? 0), { type: "u64" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("review_reason"),
      val: xdr.ScVal.scvString(record.reviewReason ?? ""),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("distributed"),
      val: xdr.ScVal.scvBool(Boolean(record.distributed)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("distributed_at"),
      val: nativeToScVal(BigInt(record.distributedAt ?? 0), { type: "u64" }),
    }),
  ];

  return xdr.ScVal.scvMap(mapEntries);
}

/**
 * Decodes a contract call from an XDR transaction envelope string.
 */
export function decodeContractInvocation(
  envelopeXdr: string,
  passphrase = Networks.TESTNET,
): DecodedContractCall | null {
  try {
    const tx = TransactionBuilder.fromXDR(
      envelopeXdr,
      passphrase,
    ) as unknown as TransactionLike;
    const operations = tx.operations;
    for (const op of operations) {
      if (op.type === "invokeHostFunction") {
        const hostFunc = op.func;
        if (hostFunc) {
          const rawContractCall = contractCallFromHost(hostFunc);
          if (!rawContractCall) continue;
          const contractCall = normalizeContractCall(rawContractCall);
          const contractAddress = contractCall.address;
          const functionName = contractCall.functionName;
          const rawArgs = contractCall.args;

          let contractId = "";
          try {
            if (contractAddress.arm?.() === "contractId") {
              contractId = contractAddress.contractId?.().toString("hex") ?? "";
            } else if (contractAddress.type === "scAddressTypeContract") {
              const value = contractAddress.value;
              contractId = value ? Buffer.from(value).toString("hex") : "";
            }
          } catch {
            contractId = "unknown";
          }

          const args: Record<string, unknown> = {};
          rawArgs.forEach((arg: xdr.ScVal, index: number) => {
            try {
              args[`arg_${index}`] = scValToNative(arg);
            } catch {
              args[`arg_${index}`] = arg;
            }
          });

          return { contractId, functionName, rawArgs, args };
        }
      }
    }
  } catch {
    // Try low level XDR parse if TransactionBuilder.fromXDR failed
    try {
      const envelope = xdr.TransactionEnvelope.fromXDR(
        envelopeXdr,
        "base64",
      ) as unknown as EnvelopeLike;
      const tx =
        envelope.switch?.() === "v0"
          ? envelope.v0?.()?.tx()
          : (envelope.v1?.()?.tx() ??
            envelope.tx?.() ??
            envelope.value?.()?.tx());
      if (!tx) return null;
      const operations = tx.operations();
      for (const op of operations) {
        const body = op.body();
        if (body.arm() === "invokeHostFunctionOp") {
          const hostFunc = body.invokeHostFunctionOp().hostFunction();
          const rawContractCall = contractCallFromHost(hostFunc);
          if (rawContractCall) {
            const contractCall = normalizeContractCall(rawContractCall);
            const functionName = contractCall.functionName;
            const rawArgs = contractCall.args;
            return {
              contractId: "mock-contract",
              functionName,
              rawArgs,
              args: {},
            };
          }
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Scenario builder for Pilot RPC states.
 */
export class PilotRpcScenario {
  private cycles: Map<string, ScenarioCycleState> = new Map();
  private isPaused = false;
  private holdingsState: ScenarioHoldingsState = {
    balance: BigInt(250_0000000),
    totalSupply: BigInt(1_000_0000000),
    decimals: 7,
    symbol: "AKIN",
    whitelisted: true,
  };
  private submittedTransactions: Array<{ method: string; args: unknown }> = [];

  constructor() {
    this.cycles = new Map();
  }

  setPaused(paused: boolean): this {
    this.isPaused = paused;
    return this;
  }

  setHoldings(holdings: Partial<ScenarioHoldingsState>): this {
    this.holdingsState = { ...this.holdingsState, ...holdings };
    return this;
  }

  setCycle(state: ScenarioCycleState): this {
    this.cycles.set(state.cycleId, { ...state });
    return this;
  }

  getCycle(cycleId: string): ScenarioCycleState | undefined {
    return this.cycles.get(cycleId);
  }

  getCycles(): ScenarioCycleState[] {
    return Array.from(this.cycles.values());
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getHoldings(): ScenarioHoldingsState {
    return this.holdingsState;
  }

  getSubmittedTransactions() {
    return this.submittedTransactions;
  }

  /**
   * Helper to fluently configure a cycle.
   */
  cycle(cycleId: string) {
    return {
      none: (): PilotRpcScenario => {
        this.cycles.delete(cycleId);
        return this;
      },
      submitted: (
        totalIncome = BigInt(12_400_0000000),
        evidenceLink = "https://statement.example.com/2026-03.pdf",
        evidenceHashHex = "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "Submitted",
          totalIncome,
          evidenceLink,
          evidenceHashHex,
          submittedAt: Math.floor(Date.now() / 1000) - 86400,
          recordedAt: Math.floor(Date.now() / 1000) - 86400,
          reviewedAt: 0,
          reviewReason: "",
          distributed: false,
          distributedAt: 0,
        });
      },
      underReview: (
        totalIncome = BigInt(12_400_0000000),
        evidenceLink = "https://statement.example.com/2026-03.pdf",
        evidenceHashHex = "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "UnderReview",
          totalIncome,
          evidenceLink,
          evidenceHashHex,
          submittedAt: Math.floor(Date.now() / 1000) - 86400 * 2,
          recordedAt: Math.floor(Date.now() / 1000) - 86400 * 2,
          reviewedAt: 0,
          reviewReason: "",
          distributed: false,
          distributedAt: 0,
        });
      },
      approved: (
        totalIncome = BigInt(12_400_0000000),
        evidenceLink = "https://statement.example.com/2026-03.pdf",
        evidenceHashHex = "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "Approved",
          totalIncome,
          evidenceLink,
          evidenceHashHex,
          submittedAt: Math.floor(Date.now() / 1000) - 86400 * 3,
          recordedAt: Math.floor(Date.now() / 1000) - 86400 * 3,
          reviewedAt: Math.floor(Date.now() / 1000) - 86400,
          reviewReason: "",
          distributed: false,
          distributedAt: 0,
        });
      },
      rejected: (
        reason = "The statement covers three weeks, not the full month.",
        totalIncome = BigInt(12_400_0000000),
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "Rejected",
          totalIncome,
          evidenceLink: "https://statement.example.com/rejected.pdf",
          evidenceHashHex:
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
          submittedAt: Math.floor(Date.now() / 1000) - 86400 * 3,
          recordedAt: Math.floor(Date.now() / 1000) - 86400 * 3,
          reviewedAt: Math.floor(Date.now() / 1000) - 86400,
          reviewReason: reason,
          distributed: false,
          distributedAt: 0,
        });
      },
      disputed: (
        reason = "Bank statement total mismatch with property report",
        totalIncome = BigInt(12_400_0000000),
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "Disputed",
          totalIncome,
          evidenceLink: "https://statement.example.com/disputed.pdf",
          evidenceHashHex:
            "1111111111111111111111111111111111111111111111111111111111111111",
          submittedAt: Math.floor(Date.now() / 1000) - 86400 * 5,
          recordedAt: Math.floor(Date.now() / 1000) - 86400 * 5,
          reviewedAt: Math.floor(Date.now() / 1000) - 86400 * 2,
          reviewReason: reason,
          distributed: false,
          distributedAt: 0,
        });
      },
      distributedOnTime: (
        totalIncome = BigInt(11_750_0000000),
        distributedAt = 1770249600, // Feb 5, 2026
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "Approved",
          totalIncome,
          evidenceLink: `https://statement.example.com/${cycleId}.pdf`,
          evidenceHashHex:
            "2222222222222222222222222222222222222222222222222222222222222222",
          submittedAt: distributedAt - 86400 * 2,
          recordedAt: distributedAt - 86400 * 2,
          reviewedAt: distributedAt - 86400,
          reviewReason: "",
          distributed: true,
          distributedAt,
        });
      },
      distributedLate: (
        totalIncome = BigInt(11_750_0000000),
        distributedAt = 1773014400, // March 9, 2026 (late for Feb cycle due Feb 5)
      ): PilotRpcScenario => {
        return this.setCycle({
          cycleId,
          status: "Approved",
          totalIncome,
          evidenceLink: `https://statement.example.com/${cycleId}.pdf`,
          evidenceHashHex:
            "3333333333333333333333333333333333333333333333333333333333333333",
          submittedAt: distributedAt - 86400 * 2,
          recordedAt: distributedAt - 86400 * 2,
          reviewedAt: distributedAt - 86400,
          reviewReason: "",
          distributed: true,
          distributedAt,
        });
      },
    };
  }

  /**
   * Responds to a simulation call based on decoded invocation or function name.
   */
  answerSimulation(call: DecodedContractCall | null): xdr.ScVal {
    if (!call) {
      return xdr.ScVal.scvVoid();
    }

    const { functionName, rawArgs } = call;

    if (functionName === "is_paused") {
      return xdr.ScVal.scvBool(this.isPaused);
    }

    if (functionName === "get_evidence") {
      let cycleId = "";
      try {
        if (rawArgs.length > 0) {
          const native = scValToNative(rawArgs[0]);
          cycleId = typeof native === "string" ? native : String(native ?? "");
        }
      } catch {
        cycleId = "";
      }
      const record = this.cycles.get(cycleId);
      return encodeEvidenceRecordScVal(record);
    }

    if (functionName === "balance") {
      return nativeToScVal(this.holdingsState.balance, { type: "i128" });
    }

    if (functionName === "total_supply") {
      return nativeToScVal(this.holdingsState.totalSupply, { type: "i128" });
    }

    if (functionName === "decimals") {
      return xdr.ScVal.scvU32(this.holdingsState.decimals);
    }

    if (functionName === "symbol") {
      return xdr.ScVal.scvString(this.holdingsState.symbol);
    }

    if (functionName === "is_approved") {
      return xdr.ScVal.scvBool(this.holdingsState.whitelisted);
    }

    // Write functions return void on simulation success
    return xdr.ScVal.scvVoid();
  }

  /**
   * Handles a transaction submission, mutating scenario state accordingly.
   */
  handleSendTransaction(envelopeXdr: string): string {
    const txHash = `mock_tx_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;
    const call = decodeContractInvocation(envelopeXdr);
    if (!call) {
      return txHash;
    }

    this.submittedTransactions.push({
      method: call.functionName,
      args: call.args,
    });

    const { functionName, rawArgs } = call;

    if (functionName === "submit_evidence") {
      try {
        const cycleId = scValToNative(rawArgs[1]) as string;
        const hashBuf = scValToNative(rawArgs[2]) as Buffer;
        const link = scValToNative(rawArgs[3]) as string;
        const totalIncome = scValToNative(rawArgs[4]) as bigint;
        this.setCycle({
          cycleId,
          status: "Submitted",
          totalIncome:
            typeof totalIncome === "bigint"
              ? totalIncome
              : BigInt(totalIncome ?? 0),
          evidenceLink: link,
          evidenceHashHex: Buffer.from(hashBuf).toString("hex"),
          submittedAt: Math.floor(Date.now() / 1000),
          recordedAt: Math.floor(Date.now() / 1000),
          reviewedAt: 0,
          reviewReason: "",
          distributed: false,
          distributedAt: 0,
        });
      } catch {
        // Fallback if arg parsing fails
      }
    } else if (functionName === "start_review") {
      try {
        const cycleId = scValToNative(rawArgs[1]) as string;
        const existing = this.cycles.get(cycleId);
        if (existing) {
          existing.status = "UnderReview";
        }
      } catch {
        // Ignored
      }
    } else if (functionName === "review_evidence") {
      try {
        const cycleId = scValToNative(rawArgs[1]) as string;
        const approved = Boolean(scValToNative(rawArgs[2]));
        const reason = (scValToNative(rawArgs[3]) as string) ?? "";
        const existing = this.cycles.get(cycleId);
        if (existing) {
          existing.status = approved ? "Approved" : "Rejected";
          existing.reviewReason = reason;
          existing.reviewedAt = Math.floor(Date.now() / 1000);
        }
      } catch {
        // Ignored
      }
    } else if (functionName === "flag_dispute") {
      try {
        const cycleId = scValToNative(rawArgs[1]) as string;
        const reason = (scValToNative(rawArgs[2]) as string) ?? "";
        const existing = this.cycles.get(cycleId);
        if (existing) {
          existing.status = "Disputed";
          existing.reviewReason = reason;
          existing.reviewedAt = Math.floor(Date.now() / 1000);
        }
      } catch {
        // Ignored
      }
    } else if (functionName === "execute_distribution") {
      try {
        const cycleId = scValToNative(rawArgs[2]) as string;
        const existing = this.cycles.get(cycleId);
        if (existing) {
          existing.distributed = true;
          existing.distributedAt = Math.floor(Date.now() / 1000);
        }
      } catch {
        // Ignored
      }
    }

    return txHash;
  }
}

/** Pre-built standard scenarios. */
export const scenarios = {
  defaultPilot: (): PilotRpcScenario => {
    return new PilotRpcScenario()
      .cycle("2026-01")
      .distributedOnTime(BigInt(11_750_0000000), 1770249600)
      .cycle("2026-02")
      .distributedLate(BigInt(11_750_0000000), 1773014400)
      .cycle("2026-03")
      .submitted(BigInt(12_400_0000000));
  },
  escalated: (): PilotRpcScenario => {
    return new PilotRpcScenario()
      .cycle("2026-01")
      .distributedOnTime()
      .cycle("2026-02")
      .none()
      .cycle("2026-03")
      .none();
  },
  paused: (): PilotRpcScenario => {
    return new PilotRpcScenario().setPaused(true).cycle("2026-03").submitted();
  },
  empty: (): PilotRpcScenario => {
    return new PilotRpcScenario();
  },
};

/**
 * Registers network routing in Playwright to mock Soroban RPC JSON-RPC endpoints.
 */
export async function mockPilotRpc(
  page: Page,
  scenario: PilotRpcScenario,
): Promise<PilotRpcScenario> {
  await page.route(
    (url) =>
      url.hostname.includes("stellar.org") ||
      url.pathname.includes("/rpc") ||
      url.pathname.includes("soroban") ||
      url.port === "3101",
    async (route: Route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        if (
          request.method() === "GET" &&
          request.url().includes("/accounts/")
        ) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: request.url().split("/accounts/")[1]?.split("?")[0] ?? "",
              sequence: "1",
              balances: [{ asset_type: "native", balance: "1000" }],
            }),
          });
          return;
        }
        await route.continue();
        return;
      }

      let body: {
        id?: string | number;
        method?: string;
        params?: Record<string, unknown>;
      };
      try {
        body = request.postDataJSON();
      } catch {
        await route.continue();
        return;
      }

      const id = body.id ?? 1;
      const method = body.method;

      if (method === "simulateTransaction") {
        const txXdr = (body.params?.transaction as string) ?? "";
        const call = decodeContractInvocation(txXdr);
        const scVal = scenario.answerSimulation(call);
        const retvalBase64 = scVal.toXDR("base64");

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              latestLedger: 12345,
              minResourceFee: "100",
              transactionData: DEFAULT_TX_DATA,
              events: [],
              results: [
                {
                  auth: [],
                  xdr: retvalBase64,
                  retval: retvalBase64,
                },
              ],
              retval: retvalBase64,
              cost: {
                cpuInsns: "100000",
                memBytes: "10000",
              },
            },
          }),
        });
        return;
      }

      if (method === "sendTransaction") {
        const txXdr = (body.params?.transaction as string) ?? "";
        const hash = scenario.handleSendTransaction(txXdr);

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              status: "PENDING",
              hash,
              latestLedger: 12345,
              latestLedgerCloseTime: Math.floor(Date.now() / 1000),
            },
          }),
        });
        return;
      }

      if (method === "getTransaction") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              status: "SUCCESS",
              latestLedger: 12345,
              latestLedgerCloseTime: Math.floor(Date.now() / 1000),
              resultXdr: xdr.ScVal.scvVoid().toXDR("base64"),
              resultMetaXdr: "AAAAAA==",
            },
          }),
        });
        return;
      }

      if (method === "getAccount") {
        const address = String(body.params?.address ?? "");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              id: address,
              sequenceNumber: "1",
              balances: [],
              signers: [],
              flags: [],
              pagingToken: "1",
            },
          }),
        });
        return;
      }
      if (method === "getLatestLedger") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              id: "0000000000003039",
              sequence: 12345,
              protocolVersion: 22,
            },
          }),
        });
        return;
      }

      if (method === "getHealth") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { status: "healthy" },
          }),
        });
        return;
      }

      if (method === "getNetwork") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              passphrase: Networks.TESTNET,
              protocolVersion: 22,
            },
          }),
        });
        return;
      }

      // Default empty success for other JSON-RPC calls
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {},
        }),
      });
    },
  );

  return scenario;
}
