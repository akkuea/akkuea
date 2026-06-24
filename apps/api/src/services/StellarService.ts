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
} from '@stellar/stellar-sdk';
import {
  createNodeContractSigner,
  DefiLendingContractClient,
  RealEstateTokenContractClient,
} from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
import { getRealEstateTokenContractId } from '../config/contracts';

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
  private readonly sorobanRpcUrl: string;

  constructor(
    server?: Horizon.Server,
    networkPassphrase: string = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
  ) {
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.sorobanRpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

    this.server = server ?? new Horizon.Server(horizonUrl);
    this.networkPassphrase = networkPassphrase;
  }

  getMintingConfig(): { contractId: string; adminPublicKey: string; adminSecret: string } {
    const contractId = getRealEstateTokenContractId();
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

      const typedTransaction = await this.buildTypedContractTransaction(
        contractId,
        method,
        args,
        sourceAccount,
      );
      if (typedTransaction) {
        return typedTransaction.toXDR();
      }

      return this.callContractLegacy(contractId, method, args, sourceAccount);
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
    const typedTransaction = await this.buildTypedContractTransaction(
      contractId,
      method,
      args,
      sourceAccount,
      signerSecret,
    );
    if (typedTransaction) {
      const sentTransaction = await typedTransaction.signAndSend();
      return this.getSentTransactionHash(sentTransaction);
    }

    const unsignedXdr = await this.callContractLegacy(contractId, method, args, sourceAccount);
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

    try {
      const client = this.createRealEstateClient(
        params.contractId,
        params.adminPublicKey,
        params.adminSecret,
      );
      const transaction = await client.mintShares({
        admin: params.adminPublicKey,
        propertyId: BigInt(params.sorobanPropertyId),
        recipient: params.recipient,
        amount: BigInt(params.amount),
      });
      const sentTransaction = await transaction.signAndSend();

      return {
        txHash: this.getSentTransactionHash(sentTransaction),
        contractId: params.contractId,
      };
    } catch (error) {
      throw ApiError.internal(
        error instanceof Error ? error.message : 'Failed to prepare Soroban transaction',
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

  private async callContractLegacy(
    contractId: string,
    method: string,
    args: unknown[],
    sourceAccount: string,
  ): Promise<string> {
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
  }

  private createRealEstateClient(
    contractId: string,
    publicKey?: string,
    signerSecret?: string,
  ): RealEstateTokenContractClient {
    return RealEstateTokenContractClient.fromConfig(
      this.getSorobanClientConfig(contractId, publicKey, signerSecret),
    );
  }

  private createDefiLendingClient(
    contractId: string,
    publicKey?: string,
    signerSecret?: string,
  ): DefiLendingContractClient {
    return DefiLendingContractClient.fromConfig(
      this.getSorobanClientConfig(contractId, publicKey, signerSecret),
    );
  }

  private getSorobanClientConfig(contractId: string, publicKey?: string, signerSecret?: string) {
    if (!signerSecret) {
      return {
        contractId,
        networkPassphrase: this.networkPassphrase,
        rpcUrl: this.sorobanRpcUrl,
        publicKey,
      };
    }

    const signer = createNodeContractSigner(signerSecret, this.networkPassphrase);
    if (publicKey && signer.publicKey !== publicKey) {
      throw new Error('Signer secret does not match the provided source account');
    }

    return {
      contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.sorobanRpcUrl,
      publicKey: signer.publicKey,
      signTransaction: signer.signTransaction,
    };
  }

  private async buildTypedContractTransaction(
    contractId: string,
    method: string,
    args: unknown[],
    sourceAccount: string,
    signerSecret?: string,
  ) {
    const tokenClient = this.createRealEstateClient(contractId, sourceAccount, signerSecret);
    const lendingClient = this.createDefiLendingClient(contractId, sourceAccount, signerSecret);

    switch (method) {
      case 'mint_shares':
        return tokenClient.mintShares({
          admin: this.asAddress(args[0]),
          propertyId: this.asBigInt(args[1]),
          recipient: this.asAddress(args[2]),
          amount: this.asBigInt(args[3]),
        });
      case 'burn_shares':
        return tokenClient.burnShares({
          owner: this.asAddress(args[0]),
          propertyId: this.asBigInt(args[1]),
          amount: this.asBigInt(args[2]),
        });
      case 'get_balance':
        return tokenClient.getBalance({
          propertyId: this.asBigInt(args[0]),
          owner: this.asAddress(args[1]),
        });
      case 'get_total_shares':
        return tokenClient.getTotalShares(this.asBigInt(args[0]));
      case 'transfer_shares':
        return tokenClient.transferShares({
          from: this.asAddress(args[0]),
          to: this.asAddress(args[1]),
          propertyId: this.asBigInt(args[2]),
          amount: this.asBigInt(args[3]),
        });
      case 'approve':
        return tokenClient.approve({
          owner: this.asAddress(args[0]),
          spender: this.asAddress(args[1]),
          propertyId: this.asBigInt(args[2]),
          amount: this.asBigInt(args[3]),
        });
      case 'transfer_from':
        return tokenClient.transferFrom({
          spender: this.asAddress(args[0]),
          from: this.asAddress(args[1]),
          to: this.asAddress(args[2]),
          propertyId: this.asBigInt(args[3]),
          amount: this.asBigInt(args[4]),
        });
      case 'purchase_shares':
        return tokenClient.purchaseShares({
          buyer: this.asAddress(args[0]),
          propertyId: this.asBigInt(args[1]),
          amount: this.asBigInt(args[2]),
          paymentToken: this.asAddress(args[3]),
        });
      case 'create_pool':
        return lendingClient.createPool({
          admin: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          name: this.asString(args[2]),
          asset: this.asString(args[3]),
          assetAddress: this.asAddress(args[4]),
          collateralFactor: this.asBigInt(args[5]),
          liquidationThreshold: this.asBigInt(args[6]),
          liquidationPenalty: this.asBigInt(args[7]),
          reserveFactor: this.asNumber(args[8]),
        });
      case 'deposit':
        return lendingClient.deposit({
          actor: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          amount: this.asBigInt(args[2]),
        });
      case 'withdraw':
        return lendingClient.withdraw({
          actor: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          amount: this.asBigInt(args[2]),
        });
      case 'borrow':
        return lendingClient.borrow({
          actor: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          amount: this.asBigInt(args[2]),
          collateralAsset: this.asAddress(args[3]),
          collateralAmount: this.asBigInt(args[4]),
        });
      case 'repay':
        return lendingClient.repay({
          actor: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          amount: this.asBigInt(args[2]),
        });
      case 'accrue_interest':
        return lendingClient.accrueInterest(this.asString(args[0]));
      case 'get_pool':
        return lendingClient.getPool(this.asString(args[0]));
      case 'get_user_deposits':
        return lendingClient.getUserDeposits(this.asAddress(args[0]));
      case 'get_total_deposits':
        return lendingClient.getTotalDeposits(this.asString(args[0]));
      case 'get_total_borrows':
        return lendingClient.getTotalBorrows(this.asString(args[0]));
      case 'get_user_borrows':
        return lendingClient.getUserBorrows(this.asAddress(args[0]));
      case 'get_interest_index':
        return lendingClient.getInterestIndex(this.asString(args[0]));
      case 'get_deposit_position':
        return lendingClient.getDepositPosition({
          user: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
        });
      case 'get_borrow_position':
        return lendingClient.getBorrowPosition({
          user: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
        });
      case 'set_oracle':
        return lendingClient.setOracle(this.asAddress(args[0]), this.asAddress(args[1]));
      case 'set_oracle_config':
        return lendingClient.setOracleConfig(
          this.asAddress(args[0]),
          this.asBigInt(args[1]),
          this.asBigInt(args[2]),
        );
      case 'get_oracle_config':
        return lendingClient.getOracleConfig();
      default:
        return null;
    }
  }

  private asAddress(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Expected Stellar address string');
    }

    return value;
  }

  private asString(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Expected string argument');
    }

    return value;
  }

  private asBigInt(value: unknown): bigint {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      return BigInt(value);
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      return BigInt(value);
    }

    throw new Error('Expected integer-compatible Soroban argument');
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      return Number.parseInt(value, 10);
    }

    throw new Error('Expected numeric argument');
  }

  private getSentTransactionHash(sentTransaction: {
    sendTransactionResponse?: { hash?: string };
    getTransactionResponse?: { txHash?: string };
  }): string {
    const hash =
      sentTransaction.sendTransactionResponse?.hash ??
      sentTransaction.getTransactionResponse?.txHash;

    if (!hash) {
      throw new Error('Unable to determine submitted Soroban transaction hash');
    }

    return hash;
  }
}

export const stellarService = new StellarService();
