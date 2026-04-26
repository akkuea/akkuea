import {
  Account,
  Contract,
  Horizon,
  Keypair,
  Networks,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from 'stellar-sdk';
import { ApiError } from '../errors/ApiError';

export interface MintSharesParams {
  contractId: string;
  adminSecret: string;
  adminPublicKey: string;
  sorobanPropertyId: number;
  recipient: string;
  amount: number;
}

export interface MintSharesResult {
  txHash: string;
  contractId: string;
}

export class StellarService {
  private readonly server: Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(
    server?: Horizon.Server,
    networkPassphrase: string = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
  ) {
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

    this.server = server ?? new Horizon.Server(horizonUrl);
    this.networkPassphrase = networkPassphrase;
  }

  getMintingConfig(): { contractId: string; adminPublicKey: string; adminSecret: string } {
    const contractId = process.env.REAL_ESTATE_TOKEN_CONTRACT_ID;
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw ApiError.badRequest(
        'Soroban tokenization is not configured. Missing contract or admin credentials.',
      );
    }

    this.assertValidContractId(contractId);
    this.assertValidAddress(adminPublicKey);

    return { contractId, adminPublicKey, adminSecret };
  }

  async getAccountBalance(address: string): Promise<string> {
    try {
      this.assertValidAddress(address);
      const account = await this.server.accounts().accountId(address).call();
      const nativeBalance = account.balances.find(
        (balance: { asset_type: string; balance?: string }) => balance.asset_type === 'native',
      );
      return nativeBalance?.balance ?? '0';
    } catch (error) {
      throw new Error('Failed to get account balance', { cause: error });
    }
  }

  async submitTransaction(signedXdr: string): Promise<string> {
    try {
      const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, 'base64');
      const transaction = new Transaction(envelope, this.networkPassphrase);
      const result = await this.server.submitTransaction(transaction);

      if (!result.successful) {
        const details = result as { result_code?: string };
        throw new Error(details.result_code || 'Unknown transaction failure');
      }

      return result.hash;
    } catch (error) {
      throw new Error('Failed to submit transaction', { cause: error });
    }
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'error'> {
    try {
      const result = await this.server.transactions().transaction(txHash).call();
      return result.successful ? 'success' : 'error';
    } catch {
      return 'pending';
    }
  }

  async callContract(
    contractId: string,
    method: string,
    args: unknown[] = [],
    sourceAccount?: string,
  ): Promise<string> {
    if (!sourceAccount) {
      throw new Error('Source account is required for contract invocation');
    }

    try {
      this.assertValidContractId(contractId);
      this.assertValidAddress(sourceAccount);

      const accountRecord = await this.server.accounts().accountId(sourceAccount).call();
      const account = new Account(accountRecord.id, accountRecord.sequence);
      const contract = new Contract(contractId);

      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addOperation(contract.call(method, ...(args as any[])) as any)
        .setTimeout(30)
        .build();

      return transaction.toXDR();
    } catch (error) {
      throw new Error('Failed to call contract', { cause: error });
    }
  }

  async callAndSubmitContract(
    contractId: string,
    method: string,
    args: unknown[],
    signerSecret: string,
    sourceAccount: string,
  ): Promise<string> {
    const unsignedXdr = await this.callContract(contractId, method, args, sourceAccount);
    const transaction = TransactionBuilder.fromXDR(unsignedXdr, this.networkPassphrase);
    const signer = Keypair.fromSecret(signerSecret);
    transaction.sign(signer);
    return this.submitTransaction(transaction.toXDR());
  }

  async mintPropertyShares(params: MintSharesParams): Promise<MintSharesResult> {
    if (params.amount <= 0) {
      throw ApiError.badRequest('Tokenization amount must be greater than zero');
    }

    this.assertValidAddress(params.adminPublicKey);
    this.assertValidAddress(params.recipient);
    this.assertValidContractId(params.contractId);

    let signedXdr: string;

    try {
      const unsignedXdr = await this.callContract(
        params.contractId,
        'mint_shares',
        [params.adminPublicKey, params.sorobanPropertyId, params.recipient, params.amount],
        params.adminPublicKey,
      );

      const transaction = TransactionBuilder.fromXDR(unsignedXdr, this.networkPassphrase);
      const signer = Keypair.fromSecret(params.adminSecret);
      transaction.sign(signer);
      signedXdr = transaction.toXDR();
    } catch (error) {
      throw ApiError.internal(
        error instanceof Error ? error.message : 'Failed to prepare Soroban transaction',
      );
    }

    try {
      const txHash = await this.submitTransaction(signedXdr);
      return {
        txHash,
        contractId: params.contractId,
      };
    } catch (error) {
      throw ApiError.internal(
        error instanceof Error ? error.message : 'Failed to submit Soroban transaction',
      );
    }
  }

  createKeypair(): { publicKey: string; secretKey: string } {
    const keypair = Keypair.random();

    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  validateAddress(address: string): boolean {
    return StrKey.isValidEd25519PublicKey(address);
  }

  assertValidAddress(address: string): void {
    if (!this.validateAddress(address)) {
      throw ApiError.badRequest('Invalid Stellar address format');
    }
  }

  validateContractId(contractId: string): boolean {
    return /^C[A-Z2-7]{55}$/.test(contractId);
  }

  assertValidContractId(contractId: string): void {
    if (!this.validateContractId(contractId)) {
      throw ApiError.badRequest('Invalid Soroban contract ID format');
    }
  }
}

export const stellarService = new StellarService();
