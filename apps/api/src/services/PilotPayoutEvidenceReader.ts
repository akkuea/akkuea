import {
  rpc as SorobanRpc,
  Contract,
  Account,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Networks,
} from '@stellar/stellar-sdk';
import { simulateTransactionWithRetry, RpcAllEndpointsFailedError } from '@akkuea/shared';
import type { RpcRetryConfig } from '@akkuea/shared';

export interface EvidenceLookupResult {
  present: boolean;
  recordedAt?: number;
}

export interface PilotPayoutEvidenceReaderConfig {
  contractId: string;
  rpcUrl?: string;
  rpcUrls?: string[];
  networkPassphrase?: string;
  server?: InstanceType<typeof SorobanRpc.Server>;
  retryConfig?: RpcRetryConfig;
}

interface DecodedEvidenceRecord {
  cycle_id?: string;
  evidence_hash?: unknown;
  evidence_link?: string;
  total_income?: number | bigint;
  recorded_at?: number | bigint;
  distributed?: boolean;
}

/**
 * Read-only Soroban RPC client for `pilot-payout-split`'s evidence history.
 *
 * Uses bounded exponential-backoff retry across multiple RPC endpoints
 * for transient errors (timeouts, 429, 5xx). Deterministic contract
 * errors are never retried. RPC failures throw, so callers can
 * distinguish "could not check" from "no evidence recorded".
 */
export class PilotPayoutEvidenceReader {
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly server: InstanceType<typeof SorobanRpc.Server>;
  private readonly simulationSourceAccount: string;
  private readonly retryConfig: RpcRetryConfig;
  private readonly rpcUrls: string[];

  constructor(config: PilotPayoutEvidenceReaderConfig) {
    this.contractId = config.contractId;
    this.networkPassphrase =
      config.networkPassphrase ?? process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
    this.retryConfig = config.retryConfig ?? { maxRetries: 3, retryBaseDelayMs: 2_000, maxRetryMs: 30_000, callTimeoutMs: 30_000 };
    this.rpcUrls = config.rpcUrls ?? [];
    this.server =
      config.server ??
      new SorobanRpc.Server(
        config.rpcUrl ?? process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
      );
    this.simulationSourceAccount = Keypair.random().publicKey();
  }

  async hasEvidence(cycleId: string): Promise<EvidenceLookupResult> {
    const tx = this.buildTransaction(cycleId);

    let simulation: ReturnType<InstanceType<typeof SorobanRpc.Server>['simulateTransaction']>;
    try {
      const result = await simulateTransactionWithRetry(
        tx,
        {
          endpoints: this.rpcUrls.length > 0 ? this.rpcUrls : undefined,
          ...this.retryConfig,
        },
      );
      simulation = result;
    } catch (err) {
      if (err instanceof RpcAllEndpointsFailedError) {
        throw new Error(
          `RPC unavailable for cycle "${cycleId}": could not verify evidence`,
          { cause: err },
        );
      }
      throw err;
    }

    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new Error(
        `pilot-payout-split.get_evidence simulation failed for cycle "${cycleId}": ${simulation.error}`,
      );
    }

    const retval = simulation.result?.retval;
    if (!retval) {
      return { present: false };
    }

    const decoded = scValToNative(retval) as DecodedEvidenceRecord | null | undefined;
    if (decoded === null || decoded === undefined) {
      return { present: false };
    }

    return {
      present: true,
      recordedAt: decoded.recorded_at !== undefined ? Number(decoded.recorded_at) : undefined,
    };
  }

  private buildTransaction(cycleId: string) {
    const contract = new Contract(this.contractId);
    const account = new Account(this.simulationSourceAccount, '0');

    return new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_evidence', nativeToScVal(cycleId, { type: 'string' })))
      .setTimeout(30)
      .build();
  }
}
