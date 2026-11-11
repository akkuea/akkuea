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

/**
 * A confirmed transaction that invoked exactly one contract function, as
 * loaded from Soroban RPC. Callers decode `args` for their own function and
 * compare them against the database and the authenticated caller.
 */
export interface VerifiedContractCall {
  txHash: string;
  /** Source account of the transaction, which signed it. */
  sourceAccount: string;
  contractId: string;
  functionName: string;
  args: xdr.ScVal[];
  events: RpcContractEvent[];
}

/** defi-rwa lending functions a user or liquidator signs themselves. */
export type LendingContractFunction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidate';

/** The decoded arguments of a confirmed defi-rwa lending call. */
export interface VerifiedLendingCall {
  txHash: string;
  sourceAccount: string;
  contractId: string;
  functionName: LendingContractFunction;
  /** First argument: depositor, borrower or liquidator, who must sign. */
  actor: string;
  poolId: string;
  /** Amount, or `debt_to_cover` for a liquidation, in token units. */
  amount: bigint;
  /** Liquidated borrower (liquidate only). */
  borrower?: string;
  /** Collateral token and amount (borrow only). */
  collateralAsset?: string;
  collateralAmount?: bigint;
}

export interface PrepareLendingCallParams {
  contractId: string;
  /** The wallet that signs and pays for the transaction. */
  source: string;
  functionName: LendingContractFunction;
  /** Arguments in contract order, as accepted by the typed client switch. */
  args: unknown[];
}

export interface CreateLendingPoolParams {
  contractId: string;
  adminPublicKey: string;
  adminSecret: string;
  poolId: string;
  name: string;
  asset: string;
  assetAddress: string;
  /** Pool factors in contract PRECISION units (1.0 = 10^18). */
  collateralFactor: bigint;
  liquidationThreshold: bigint;
  liquidationPenalty: bigint;
  closeFactor: bigint;
  reserveFactor: number;
}

/** A deposit position as the contract returns it (amounts in token units). */
export type ChainDepositPosition = Awaited<
  ReturnType<DefiLendingContractClient['getDepositPosition']>
>['result'];

/** A borrow position as the contract returns it (amounts in token units). */
export type ChainBorrowPosition = Awaited<
  ReturnType<DefiLendingContractClient['getBorrowPosition']>
>['result'];

/**
 * Lending state read back from the contract after a confirmed action. A
 * position is `null` when the contract holds none for the user (it removes
 * fully withdrawn, repaid or liquidated positions).
 */
export interface LendingChainState {
  totalDeposits: bigint;
  totalBorrows: bigint;
  deposit: ChainDepositPosition | null;
  /** Health factor in contract PRECISION units (1.0 = 10^18). */
  borrow: (ChainBorrowPosition & { healthFactor: bigint }) | null;
}

/** Number of arguments each lending function takes on the contract. */
const LENDING_FUNCTION_ARITY: Record<LendingContractFunction, number> = {
  deposit: 3,
  withdraw: 3,
  borrow: 5,
  repay: 3,
  liquidate: 4,
};

/**
 * Contract panics a simulation can surface, mapped to the message returned to
 * the caller. Matching is case-insensitive on the panic text.
 */
const LENDING_SIMULATION_ERRORS: Array<[string, string]> = [
  ['insufficient pool liquidity', 'The pool does not have enough liquidity for this withdrawal'],
  ['insufficient liquidity', 'The pool does not have enough liquidity for this borrow'],
  ['insufficient balance', 'The amount exceeds your deposit in this pool'],
  ['borrow exceeds collateral factor limit', 'The borrow exceeds what the collateral allows'],
  ['health factor too low', 'The borrow would leave the position with too low a health factor'],
  ['position is not underwater', 'The position is not eligible for liquidation'],
  ['no deposit position', 'You have no deposit in this pool'],
  ['borrow position not found', 'There is no borrow position in this pool'],
  ['pool not found', 'The pool does not exist on-chain'],
  ['pool is not active', 'The pool is not active'],
  ['amount must be positive', 'The amount must be greater than zero'],
  ['debt to cover must be positive', 'The debt to cover must be greater than zero'],
  ['pool already exists', 'A pool with this id already exists on-chain'],
];

/** ContractError codes from the defi-rwa contract (`access/admin.rs`). */
const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  5: 'The protocol or this pool is paused',
  7: 'The amount overflows the contract balance',
  8: 'Insufficient balance',
  22: 'The collateral price is stale',
  23: 'No price is available for the collateral asset',
  24: 'The oracle returned an invalid price',
  25: 'The collateral price is below the configured floor',
  26: 'The price oracle is not configured',
};

/**
 * Turns a failed Soroban simulation into a message a user can act on. Known
 * contract panics and errors get a readable explanation; anything else keeps
 * the first line of the RPC error.
 */
export function describeSimulationError(error: string): string {
  const lower = error.toLowerCase();
  for (const [needle, message] of LENDING_SIMULATION_ERRORS) {
    if (lower.includes(needle)) {
      return message;
    }
  }
  const contractError = error.match(/Error\(Contract, #(\d+)\)/);
  if (contractError) {
    const code = Number(contractError[1]);
    return CONTRACT_ERROR_MESSAGES[code] ?? `The contract rejected the call (error ${code})`;
  }
  const firstLine = error.split('\n')[0]?.trim() ?? '';
  return firstLine ? `Simulation failed: ${firstLine.slice(0, 200)}` : 'Simulation failed';
}

/** Event name that identifies the `SharePurchase` event (snake_case topic 0). */
const SHARE_PURCHASE_EVENT = 'share_purchase';

/** Contract events as parsed by the Soroban RPC client from `getTransaction`. */
type RpcContractEvent =
  SorobanRpc.Api.GetSuccessfulTransactionResponse['events']['contractEventsXdr'][number][number];

/** The part of an AssembledTransaction a prepared lending call relies on. */
interface AssembledLendingTransaction {
  simulation?: SorobanRpc.Api.SimulateTransactionResponse;
  toXDR(): string;
}

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
    this.assertValidContractId(params.paymentToken);

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
    this.assertValidContractId(params.paymentToken);

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
    const verified = await this.verifyContractCall(txHash, expectedContractId, 'purchase_shares');

    if (verified.args.length !== 4) {
      throw ApiError.validation('purchase_shares must be called with exactly four arguments');
    }
    const [buyerArg, propertyIdArg, amountArg, paymentTokenArg] = verified.args;
    if (!buyerArg || !propertyIdArg || !amountArg || !paymentTokenArg) {
      throw ApiError.validation('purchase_shares arguments are malformed');
    }
    const call = {
      buyer: this.asNativeAddress(buyerArg),
      propertyId: this.asNativeBigInt(propertyIdArg),
      amount: this.asNativeBigInt(amountArg),
      paymentToken: this.asNativeAddress(paymentTokenArg),
    };

    const sharePurchase = this.parseSharePurchaseEvent(verified.events, expectedContractId);
    if (!sharePurchase) {
      throw ApiError.validation(
        `Transaction ${txHash} emitted no SharePurchase event for contract ${expectedContractId}`,
      );
    }

    return {
      txHash: verified.txHash,
      sourceAccount: verified.sourceAccount,
      contractId: expectedContractId,
      functionName: 'purchase_shares',
      call,
      sharePurchase,
    };
  }

  /**
   * Shared Soroban RPC verification for user-signed contract calls. Loads the
   * transaction and requires that it exists, succeeded, is not a fee bump, and
   * contains exactly one invocation of `expectedFunction` on
   * `expectedContractId`. Returns the raw arguments and contract events so
   * each flow can decode and check its own call.
   */
  async verifyContractCall(
    txHash: string,
    expectedContractId: string,
    expectedFunction: string,
  ): Promise<VerifiedContractCall> {
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

    const transaction = new Transaction(response.envelopeXdr, this.networkPassphrase);
    if (transaction.operations.length !== 1) {
      throw ApiError.validation('The transaction must contain exactly one contract invocation');
    }

    const [operation] = transaction.operations;
    if (operation?.type !== 'invokeHostFunction') {
      throw ApiError.validation('The transaction must invoke a contract');
    }

    // The SDK types the parsed operation record loosely; at runtime an
    // invokeHostFunction operation always carries the xdr host function.
    const func = (operation as unknown as { func?: xdr.HostFunction }).func;
    if (!func || func.type !== 'hostFunctionTypeInvokeContract') {
      throw ApiError.validation('The transaction must invoke a contract function');
    }

    const { contractAddress, functionName, args } = func.invokeContract;
    const contractId = Address.fromScAddress(contractAddress).toString();
    if (contractId !== expectedContractId) {
      throw ApiError.validation(
        `Transaction invokes contract ${contractId}, expected ${expectedContractId}`,
      );
    }
    if (functionName.toString() !== expectedFunction) {
      throw ApiError.validation(
        `Transaction calls ${functionName.toString()}, expected ${expectedFunction}`,
      );
    }

    return {
      txHash: response.txHash,
      sourceAccount: transaction.source,
      contractId,
      functionName: expectedFunction,
      args: [...args],
      events: this.extractContractEvents(response),
    };
  }

  /**
   * Verifies a confirmed defi-rwa lending call (deposit, withdraw, borrow,
   * repay or liquidate) and decodes its arguments. The controller compares
   * the decoded actor, pool and borrower against the request.
   */
  async verifyLendingCall(
    txHash: string,
    expectedContractId: string,
    functionName: LendingContractFunction,
  ): Promise<VerifiedLendingCall> {
    const verified = await this.verifyContractCall(txHash, expectedContractId, functionName);

    const arity = LENDING_FUNCTION_ARITY[functionName];
    if (verified.args.length !== arity || verified.args.some((arg) => !arg)) {
      throw ApiError.validation(`${functionName} must be called with exactly ${arity} arguments`);
    }
    const args = verified.args;
    const base = {
      txHash: verified.txHash,
      sourceAccount: verified.sourceAccount,
      contractId: verified.contractId,
      functionName,
      actor: this.asNativeAddress(args[0]!),
      poolId: this.asNativeString(args[1]!),
    };

    if (functionName === 'liquidate') {
      return {
        ...base,
        borrower: this.asNativeAddress(args[2]!),
        amount: this.asNativeBigInt(args[3]!),
      };
    }
    if (functionName === 'borrow') {
      return {
        ...base,
        amount: this.asNativeBigInt(args[2]!),
        collateralAsset: this.asNativeAddress(args[3]!),
        collateralAmount: this.asNativeBigInt(args[4]!),
      };
    }
    return { ...base, amount: this.asNativeBigInt(args[2]!) };
  }

  /**
   * Builds a simulated, unsigned defi-rwa lending transaction with the user's
   * wallet as its source, for the wallet to sign and submit. A failed
   * simulation (not enough liquidity, health factor too low, no position, and
   * so on) is returned as a 400 with a readable message, so nothing that
   * would fail on-chain is ever handed to the wallet.
   */
  async prepareLendingCall(
    params: PrepareLendingCallParams,
  ): Promise<{ xdr: string; contractId: string }> {
    this.assertValidContractId(params.contractId);
    this.assertValidAddress(params.source);

    let assembled: AssembledLendingTransaction;
    try {
      const built = await this.buildTypedContractTransaction(
        params.contractId,
        params.functionName,
        params.args,
        params.source,
      );
      if (!built) {
        throw new Error(`No typed client for ${params.functionName}`);
      }
      assembled = built as AssembledLendingTransaction;
    } catch (error) {
      throw ApiError.badRequest(
        describeSimulationError(this.describeError(error, 'Failed to prepare the transaction')),
      );
    }

    const simulation = assembled.simulation;
    if (simulation && SorobanRpc.Api.isSimulationError(simulation)) {
      throw ApiError.badRequest(describeSimulationError(simulation.error));
    }
    if (!simulation) {
      throw ApiError.badRequest('The transaction could not be simulated');
    }

    return { xdr: assembled.toXDR(), contractId: params.contractId };
  }

  /**
   * Creates a lending pool on-chain with an admin-signed `create_pool` call
   * and waits for it to succeed. Pool creation is an admin action, so the API
   * signs it; the database row is written by the caller only after this
   * returns.
   */
  async createLendingPool(params: CreateLendingPoolParams): Promise<{ txHash: string }> {
    this.assertValidContractId(params.contractId);
    this.assertValidAddress(params.adminPublicKey);

    let txHash: string;
    try {
      txHash = await this.callAndSubmitContract(
        params.contractId,
        'create_pool',
        [
          params.adminPublicKey,
          params.poolId,
          params.name,
          params.asset,
          params.assetAddress,
          params.collateralFactor,
          params.liquidationThreshold,
          params.liquidationPenalty,
          params.closeFactor,
          params.reserveFactor,
        ],
        params.adminSecret,
        params.adminPublicKey,
      );
    } catch (error) {
      throw new ApiError(
        502,
        'CHAIN_ERROR',
        describeSimulationError(this.describeError(error, 'Failed to create the pool on-chain')),
      );
    }

    // signAndSend can return a hash for a transaction that later failed, so
    // the pool only counts as created once RPC reports it succeeded.
    await this.verifyContractCall(txHash, params.contractId, 'create_pool');
    return { txHash };
  }

  /**
   * Reads the pool totals and the user's position back from the contract, so
   * the database stores what the chain holds instead of numbers computed in
   * JavaScript. Positions the contract no longer holds come back as `null`.
   */
  async readLendingState(
    contractId: string,
    poolId: string,
    user: string,
    position: 'deposit' | 'borrow',
  ): Promise<LendingChainState> {
    this.assertValidContractId(contractId);
    const client = this.createDefiLendingClient(contractId);

    try {
      const [totalDeposits, totalBorrows] = await Promise.all([
        this.simulatedResult(client.getTotalDeposits(poolId)),
        this.simulatedResult(client.getTotalBorrows(poolId)),
      ]);

      let deposit: ChainDepositPosition | null = null;
      let borrow: LendingChainState['borrow'] = null;
      if (position === 'deposit') {
        const pools = await this.simulatedResult(client.getUserDeposits(user));
        if (pools.includes(poolId)) {
          deposit = await this.simulatedResult(client.getDepositPosition({ user, poolId }));
        }
      } else {
        const pools = await this.simulatedResult(client.getUserBorrows(user));
        if (pools.includes(poolId)) {
          const [current, healthFactor] = await Promise.all([
            this.simulatedResult(client.getBorrowPosition({ user, poolId })),
            this.simulatedResult(client.getHealthFactor({ user, poolId })),
          ]);
          borrow = { ...current, healthFactor: this.unwrapResult(healthFactor) };
        }
      }

      return { totalDeposits, totalBorrows, deposit, borrow };
    } catch (error) {
      throw new ApiError(
        502,
        'CHAIN_READ_FAILED',
        this.describeError(error, 'Could not read the lending state from the contract'),
      );
    }
  }

  /** The simulated return value of a read-only contract call. */
  private async simulatedResult<T>(pending: Promise<{ result: T }>): Promise<T> {
    const assembled = await pending;
    return assembled.result;
  }

  /** Unwraps a contract `Result`, throwing its error. */
  private unwrapResult<T>(value: { unwrap(): T } | T): T {
    if (value && typeof value === 'object' && 'unwrap' in value) {
      return (value as { unwrap(): T }).unwrap();
    }
    return value as T;
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

  private asNativeString(value: xdr.ScVal): string {
    if (value.type !== 'scvString') {
      throw ApiError.validation('Expected a string argument');
    }
    return String(scValToNative(value));
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
          closeFactor: this.asBigInt(args[8]),
          reserveFactor: this.asNumber(args[9]),
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
      case 'liquidate':
        return lendingClient.liquidate({
          liquidator: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          borrowerAddress: this.asAddress(args[2]),
          debtToCover: this.asBigInt(args[3]),
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
