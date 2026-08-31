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

export interface EvidenceLookupResult {
  /** Whether `record_evidence` has been recorded on-chain for this cycle. */
  present: boolean;
  /** Unix timestamp (seconds) the evidence was recorded, if present. */
  recordedAt?: number;
}

export interface PilotPayoutEvidenceReaderConfig {
  contractId: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  server?: InstanceType<typeof SorobanRpc.Server>;
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
 * There is no generated TypeScript client for `pilot-payout-split` yet
 * (that lands with C7-004), and the contract does not expose a "list all
 * recorded cycles" method - only `get_evidence(cycle_id)` for a specific,
 * known cycle. This reader therefore simulates a `get_evidence` call per
 * expected cycle ID via `simulateTransaction`, following the same
 * `SorobanRpc.Server` convention already used in `routes/ledger.ts`.
 *
 * The call is read-only and never submitted on-chain, so the simulation's
 * source account does not need to exist or hold funds; a throwaway keypair
 * is generated once per reader instance.
 */
export class PilotPayoutEvidenceReader {
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly server: InstanceType<typeof SorobanRpc.Server>;
  private readonly simulationSourceAccount: string;

  constructor(config: PilotPayoutEvidenceReaderConfig) {
    this.contractId = config.contractId;
    this.networkPassphrase =
      config.networkPassphrase ?? process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
    this.server =
      config.server ??
      new SorobanRpc.Server(
        config.rpcUrl ?? process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
      );
    this.simulationSourceAccount = Keypair.random().publicKey();
  }

  async hasEvidence(cycleId: string): Promise<EvidenceLookupResult> {
    const contract = new Contract(this.contractId);
    const account = new Account(this.simulationSourceAccount, '0');

    const transaction = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_evidence', nativeToScVal(cycleId, { type: 'string' })))
      .setTimeout(30)
      .build();

    const simulation = await this.server.simulateTransaction(transaction);

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
}
