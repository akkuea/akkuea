import {
  Account,
  Address,
  Contract,
  Horizon,
  Keypair,
  Networks,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  rpc as SorobanRpc,
  scValToNative,
} from '@stellar/stellar-sdk';
import {
  createNodeContractSigner,
  DefiLendingContractClient,
  RealEstateTokenContractClient,
} from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
import { getRealEstateTokenContractId } from '../config/contracts';

function toOperation(op: ReturnType<Contract['call']>): xdr.Operation {
  // The Stellar SDK types are correct here - single cast with comment
  return op as unknown as xdr.Operation;
}

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

export interface ListPropertySharesParams {
  contractId: string;
  adminPublicKey: string;
  adminSecret: string;
  sorobanPropertyId: number;
  owner: string;
  /** Price per share in payment token units (7 decimals). */
  pricePerShareUnits: bigint;
  sharesForSale: number;
  /** Address of the token buyers must pay with (the configured payment token). */
  paymentToken: string;
}

export interface PreparePurchaseSharesParams {
  contractId: string;
  buyer: string;
  sorobanPropertyId: number;
  shares: number;
  paymentToken: string;
}

/** The `SharePurchase` event the contract emits on a successful purchase. */
export interface SharePurchaseEvent {
  propertyId: string;
  buyer: string;
  shares: bigint;
  totalCost: bigint;
}

/** Everything confirmed about a submitted `purchase_shares` transaction. */
export interface VerifiedPurchaseTransaction {
  txHash: string;
  /** Source account of the transaction, which must be the buyer. */
  sourceAccount: string;
  contractId: string;
  functionName: string;
  call: {
    buyer: string;
    propertyId: bigint;
    amount: bigint;
    paymentToken: string;
  };
  sharePurchase: SharePurchaseEvent;
}

/** Event name that identifies the `SharePurchase` event (snake_case topic 0). */
const SHARE_PURCHASE_EVENT = 'share_purchase';

/** Contract events as parsed by the Soroban RPC client from `getTransaction`. */
type RpcContractEvent =
  SorobanRpc.Api.GetSuccessfulTransactionResponse['events']['contractEventsXdr'][number][number];

export class StellarService {
  private readonly server: Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sorobanRpcUrl: string;
  private sorobanRpcServer: InstanceType<typeof SorobanRpc.Server> | null = null;

  constructor(
    server?: Horizon.Server,
    networkPassphrase: string = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
    sorobanRpcServer?: InstanceType<typeof SorobanRpc.Server>,
  ) {
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.sorobanRpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

    this.server = server ?? new Horizon.Server(horizonUrl);
    this.networkPassphrase = networkPassphrase;
    this.sorobanRpcServer = sorobanRpcServer ?? null;
  }

  /** Lazily built Soroban RPC client, used to verify submitted purchases. */
  private getSorobanRpcServer(): InstanceType<typeof SorobanRpc.Server> {
    if (!this.sorobanRpcServer) {
      this.sorobanRpcServer = new SorobanRpc.Server(this.sorobanRpcUrl, {
        allowHttp: this.sorobanRpcUrl.startsWith('http://'),
      });
    }
    return this.sorobanRpcServer;
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

  /**
   * Lists a property for sale on-chain with an admin-signed `list_property`
   * call. This replaces the old "mint the full supply to the owner" step: the
   * contract records the price, the share inventory and the accepted payment
   * token, and buyers pay for their shares through `purchase_shares`.
   */
  async listPropertyShares(params: ListPropertySharesParams): Promise<MintSharesResult> {
    this.assertValidContractId(params.contractId);
    this.assertValidAddress(params.adminPublicKey);
    this.assertValidAddress(params.owner);
    this.assertValidAddress(params.paymentToken);

    if (params.pricePerShareUnits <= BigInt(0)) {
      throw ApiError.badRequest('Price per share must be greater than zero');
    }
    if (!Number.isInteger(params.sharesForSale) || params.sharesForSale <= 0) {
      throw ApiError.badRequest('Shares for sale must be a positive integer');
    }

    try {
      const txHash = await this.callAndSubmitContract(
        params.contractId,
        'list_property',
        [
          nativeToScVal(params.adminPublicKey, { type: 'address' }),
          nativeToScVal(BigInt(params.sorobanPropertyId), { type: 'u64' }),
          nativeToScVal(params.owner, { type: 'address' }),
          nativeToScVal(params.pricePerShareUnits, { type: 'i128' }),
          nativeToScVal(BigInt(params.sharesForSale), { type: 'u64' }),
          nativeToScVal(params.paymentToken, { type: 'address' }),
        ],
        params.adminSecret,
        params.adminPublicKey,
      );

      return { txHash, contractId: params.contractId };
    } catch (error) {
      throw ApiError.internal(
        this.describeError(error, 'Failed to list the property for sale on-chain'),
      );
    }
  }

  /**
   * Builds a simulated, unsigned `purchase_shares` transaction with the buyer
   * as its source. The buyer signs it with their wallet and submits it; the API
   * never signs purchases itself.
   */
  async preparePurchaseShares(
    params: PreparePurchaseSharesParams,
  ): Promise<{ xdr: string; contractId: string }> {
    this.assertValidContractId(params.contractId);
    this.assertValidAddress(params.buyer);
    this.assertValidAddress(params.paymentToken);

    if (!Number.isInteger(params.shares) || params.shares <= 0) {
      throw ApiError.badRequest('Shares must be a positive integer');
    }

    try {
      const unsignedXdr = await this.callContract(
        params.contractId,
        'purchase_shares',
        [
          params.buyer,
          BigInt(params.sorobanPropertyId),
          BigInt(params.shares),
          params.paymentToken,
        ],
        params.buyer,
      );

      return { xdr: unsignedXdr, contractId: params.contractId };
    } catch (error) {
      throw ApiError.badRequest(
        this.describeError(error, 'Failed to prepare the purchase transaction'),
      );
    }
  }

  /**
   * Loads a submitted transaction from Soroban RPC and verifies everything the
   * API can check structurally: it exists, it succeeded, it is not a fee bump,
   * it invokes `purchase_shares` on the expected contract with well-formed
   * arguments, and it emitted a `SharePurchase` event. Checks that need the
   * database or the authenticated caller (right buyer, right property, right
   * amount) belong to the controller, which compares against this result.
   */
  async verifyPurchaseTransaction(
    txHash: string,
    expectedContractId: string,
  ): Promise<VerifiedPurchaseTransaction> {
    if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
      throw ApiError.badRequest('Transaction hash must be a 64-character hex string');
    }
    this.assertValidContractId(expectedContractId);

    const response = await this.getSorobanRpcServer().getTransaction(txHash);
    if (response.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      throw ApiError.notFound(`Transaction ${txHash} was not found on Soroban RPC`);
    }
    if (response.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      throw ApiError.validation(`Transaction ${txHash} did not succeed on-chain`);
    }
    if (response.feeBump) {
      throw ApiError.validation(
        `Transaction ${txHash} is a fee bump; only single transactions can be confirmed`,
      );
    }

    const { sourceAccount, call } = this.parsePurchaseCall(
      response.envelopeXdr,
      expectedContractId,
    );
    const sharePurchase = this.parseSharePurchaseEvent(
      this.extractContractEvents(response),
      expectedContractId,
    );
    if (!sharePurchase) {
      throw ApiError.validation(
        `Transaction ${txHash} emitted no SharePurchase event for contract ${expectedContractId}`,
      );
    }

    return {
      txHash: response.txHash,
      sourceAccount,
      contractId: expectedContractId,
      functionName: 'purchase_shares',
      call,
      sharePurchase,
    };
  }

  /**
   * Decodes the single `purchase_shares` invocation a confirmed transaction
   * must contain. Anything else (no invoke operation, several operations, a
   * different contract or function, malformed arguments) is rejected.
   */
  private parsePurchaseCall(
    envelope: xdr.TransactionEnvelope,
    expectedContractId: string,
  ): { sourceAccount: string; call: VerifiedPurchaseTransaction['call'] } {
    const transaction = new Transaction(envelope, this.networkPassphrase);
    if (transaction.operations.length !== 1) {
      throw ApiError.validation(
        'A share purchase transaction must contain exactly one contract invocation',
      );
    }

    const [operation] = transaction.operations;
    if (operation?.type !== 'invokeHostFunction') {
      throw ApiError.validation(
        'A share purchase transaction must invoke the tokenization contract',
      );
    }

    // The SDK types the parsed operation record loosely; at runtime an
    // invokeHostFunction operation always carries the xdr host function.
    const func = (operation as unknown as { func?: xdr.HostFunction }).func;
    if (!func || func.type !== 'hostFunctionTypeInvokeContract') {
      throw ApiError.validation('A share purchase transaction must invoke a contract function');
    }

    const { contractAddress, functionName, args } = func.invokeContract;
    const contractId = Address.fromScAddress(contractAddress).toString();
    if (contractId !== expectedContractId) {
      throw ApiError.validation(
        `Transaction invokes contract ${contractId}, expected ${expectedContractId}`,
      );
    }
    if (functionName.toString() !== 'purchase_shares') {
      throw ApiError.validation(
        `Transaction calls ${functionName.toString()}, expected purchase_shares`,
      );
    }
    if (args.length !== 4) {
      throw ApiError.validation('purchase_shares must be called with exactly four arguments');
    }
    const [buyerArg, propertyIdArg, amountArg, paymentTokenArg] = args;
    if (!buyerArg || !propertyIdArg || !amountArg || !paymentTokenArg) {
      throw ApiError.validation('purchase_shares arguments are malformed');
    }

    return {
      sourceAccount: transaction.source,
      call: {
        buyer: this.asNativeAddress(buyerArg),
        propertyId: this.asNativeBigInt(propertyIdArg),
        amount: this.asNativeBigInt(amountArg),
        paymentToken: this.asNativeAddress(paymentTokenArg),
      },
    };
  }

  /**
   * Picks the `SharePurchase` event out of a transaction's contract events,
   * decoded into the fields the controller verifies against the database.
   */
  private parseSharePurchaseEvent(
    events: RpcContractEvent[],
    expectedContractId: string,
  ): SharePurchaseEvent | null {
    for (const event of events) {
      const eventContractId = event.contractId
        ? Address.contract(event.contractId.toBytes()).toString()
        : null;
      if (eventContractId !== expectedContractId) {
        continue;
      }
      if (event.body.type !== 'v0') {
        continue;
      }
      const [topic] = event.body.v0.topics;
      if (topic?.type !== 'scvSymbol' || topic.value !== SHARE_PURCHASE_EVENT) {
        continue;
      }
      if (event.body.v0.data.type !== 'scvMap') {
        continue;
      }

      const data = scValToNative(event.body.v0.data) as Record<string, unknown>;
      return {
        propertyId: String(data.property_id),
        buyer: String(data.buyer),
        shares: this.asEventAmount(data.shares),
        totalCost: this.asEventAmount(data.total_cost),
      };
    }

    return null;
  }

  /** Contract events of a successful transaction, from RPC or its meta. */
  private extractContractEvents(
    response: SorobanRpc.Api.GetSuccessfulTransactionResponse,
  ): RpcContractEvent[] {
    const fromRpc = (response.events?.contractEventsXdr ?? []).flat();
    if (fromRpc.length > 0) {
      return fromRpc;
    }

    // Older RPC servers do not return `events`; fall back to the meta so
    // confirmation still works against them.
    const meta = response.resultMetaXdr;
    if (meta.type === 'v3' && meta.v3.sorobanMeta) {
      return [...meta.v3.sorobanMeta.events];
    }
    if (meta.type === 'v4') {
      return meta.v4.events.map((event) => event.event);
    }
    return [];
  }

  private asNativeAddress(value: xdr.ScVal): string {
    if (value.type !== 'scvAddress') {
      throw ApiError.validation('Expected a Stellar address argument');
    }
    return Address.fromScAddress(value.address).toString();
  }

  private asNativeBigInt(value: xdr.ScVal): bigint {
    const native = scValToNative(value);
    if (typeof native === 'bigint') {
      return native;
    }
    if (typeof native === 'number' && Number.isInteger(native)) {
      return BigInt(native);
    }
    throw ApiError.validation('Expected an integer argument');
  }

  private asEventAmount(value: unknown): bigint {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
      return BigInt(value);
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      return BigInt(value);
    }
    throw ApiError.validation('SharePurchase event is missing an integer amount');
  }

  /** Prefers the underlying cause's message over the generic wrapper. */
  private describeError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      if (error.cause instanceof Error) {
        return `${fallback}: ${error.cause.message}`;
      }
      return error.message;
    }
    return fallback;
  }

  async submitWhitelistApprove(
    contractId: string,
    adminPublicKey: string,
    adminSecret: string,
    walletAddress: string,
  ): Promise<string> {
    this.assertValidContractId(contractId);
    this.assertValidAddress(adminPublicKey);
    this.assertValidAddress(walletAddress);

    const adminScVal = nativeToScVal(adminPublicKey, { type: 'address' });
    const walletScVal = nativeToScVal(walletAddress, { type: 'address' });

    const unsignedXdr = await this.callContractLegacy(
      contractId,
      'approve',
      [adminScVal, walletScVal],
      adminPublicKey,
    );
    const transaction = TransactionBuilder.fromXDR(unsignedXdr, this.networkPassphrase);
    const signer = Keypair.fromSecret(adminSecret);
    transaction.sign(signer);
    return this.submitTransaction(transaction.toXDR());
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
      .addOperation(toOperation(contract.call(method, ...(args as xdr.ScVal[]))))
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
      // SEP-41 token transfer allowance, not the pilot-whitelist approve.
      // Pilot-whitelist approvals bypass this switch and use the legacy XDR path.
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
