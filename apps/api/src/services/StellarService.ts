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
import { getDefiRwaContractId, getRealEstateTokenContractId } from '../config/contracts';

function toOperation(op: ReturnType<Contract['call']>): xdr.Operation {
  // The Stellar SDK types are correct here - single cast with comment
  return op as unknown as xdr.Operation;
}

function isSuccessfulTransactionResponse(
  response: SorobanRpc.Api.GetTransactionResponse,
): response is SorobanRpc.Api.GetSuccessfulTransactionResponse {
  return String(response.status) === 'SUCCESS';
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

export type LendingAction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidate';

export interface ConfirmedContractCall {
  response: SorobanRpc.Api.GetSuccessfulTransactionResponse;
  txHash: string;
  sourceAccount: string;
  contractId: string;
  functionName: string;
  args: xdr.ScVal[];
}

export interface CreateLendingPoolOnChainParams {
  contractId?: string;
  poolId: string;
  name: string;
  asset: string;
  assetAddress: string;
  collateralFactor: bigint;
  liquidationThreshold: bigint;
  liquidationPenalty: bigint;
  closeFactor: bigint;
  reserveFactor: number;
}

export type PrepareLendingActionParams =
  | {
      contractId: string;
      action: 'deposit' | 'withdraw' | 'repay';
      actor: string;
      poolId: string;
      amount: bigint;
    }
  | {
      contractId: string;
      action: 'borrow';
      actor: string;
      poolId: string;
      amount: bigint;
      collateralAsset: string;
      collateralAmount: bigint;
    }
  | {
      contractId: string;
      action: 'liquidate';
      actor: string;
      poolId: string;
      borrowerAddress: string;
      debtToCover: bigint;
    };

export type VerifiedLendingCall =
  | {
      kind: 'deposit' | 'withdraw' | 'repay';
      actor: string;
      poolId: string;
      amount: bigint;
    }
  | {
      kind: 'borrow';
      actor: string;
      poolId: string;
      amount: bigint;
      collateralAsset: string;
      collateralAmount: bigint;
    }
  | {
      kind: 'liquidate';
      actor: string;
      poolId: string;
      borrowerAddress: string;
      debtToCover: bigint;
    };

export interface VerifiedLendingTransaction {
  txHash: string;
  sourceAccount: string;
  contractId: string;
  functionName: LendingAction;
  call: VerifiedLendingCall;
}

export interface OnChainDepositSnapshot {
  amount: bigint;
  shares: bigint;
  depositedAt: bigint;
}

export interface OnChainBorrowSnapshot {
  principal: bigint;
  collateralAmount: bigint;
  collateralAsset: string;
  borrowedAt: bigint;
  healthFactor: bigint | null;
}

export interface OnChainLendingStateSnapshot {
  totalDeposits: bigint;
  totalBorrows: bigint;
  depositPosition: OnChainDepositSnapshot | null;
  borrowPosition: OnChainBorrowSnapshot | null;
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
   * Shared RPC verification helper for prepare/confirm flows (buy-shares and
   * lending): loads the transaction from Soroban RPC, requires `SUCCESS` (not
   * `NOT_FOUND` or `FAILED`), rejects fee-bump envelopes and multi-op
   * transactions, and checks the single contract invocation against
   * `expectedContractId` and `expectedFunction`.
   */
  async fetchConfirmedContractCall(
    txHash: string,
    expectedContractId: string,
    expectedFunction: string,
  ): Promise<ConfirmedContractCall> {
    if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
      throw ApiError.badRequest('Transaction hash must be a 64-character hex string');
    }
    this.assertValidContractId(expectedContractId);

    const response = await this.getSorobanRpcServer().getTransaction(txHash);
    if (String(response.status) === 'NOT_FOUND') {
      throw ApiError.notFound(`Transaction ${txHash} was not found on Soroban RPC`);
    }
    if (!isSuccessfulTransactionResponse(response)) {
      throw ApiError.validation(`Transaction ${txHash} did not succeed on-chain`);
    }
    if (response.feeBump) {
      throw ApiError.validation(
        `Transaction ${txHash} is a fee bump; only single transactions can be confirmed`,
      );
    }

    const transaction = new Transaction(response.envelopeXdr, this.networkPassphrase);
    if (transaction.operations.length !== 1) {
      throw ApiError.validation(
        'A confirmed contract transaction must contain exactly one operation',
      );
    }

    const [operation] = transaction.operations;
    if (operation?.type !== 'invokeHostFunction') {
      throw ApiError.validation('Transaction must invoke a Soroban contract function');
    }

    // The SDK types the parsed operation record loosely; at runtime an
    // invokeHostFunction operation always carries the xdr host function.
    const func = (operation as unknown as { func?: xdr.HostFunction }).func;
    if (!func || func.type !== 'hostFunctionTypeInvokeContract') {
      throw ApiError.validation('Transaction must invoke a Soroban contract function');
    }

    const { contractAddress, functionName, args } = func.invokeContract;
    const contractId = Address.fromScAddress(contractAddress).toString();
    if (contractId !== expectedContractId) {
      throw ApiError.validation(
        `Transaction invokes contract ${contractId}, expected ${expectedContractId}`,
      );
    }
    const invokedName = functionName.toString();
    if (invokedName !== expectedFunction) {
      throw ApiError.validation(`Transaction calls ${invokedName}, expected ${expectedFunction}`);
    }

    return {
      response,
      txHash: response.txHash,
      sourceAccount: transaction.source,
      contractId,
      functionName: invokedName,
      args: [...args],
    };
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
    const confirmed = await this.fetchConfirmedContractCall(
      txHash,
      expectedContractId,
      'purchase_shares',
    );
    const call = this.parsePurchaseCallArgs(confirmed.args);
    const sharePurchase = this.parseSharePurchaseEvent(
      this.extractContractEvents(confirmed.response),
      expectedContractId,
    );
    if (!sharePurchase) {
      throw ApiError.validation(
        `Transaction ${txHash} emitted no SharePurchase event for contract ${expectedContractId}`,
      );
    }

    return {
      txHash: confirmed.txHash,
      sourceAccount: confirmed.sourceAccount,
      contractId: expectedContractId,
      functionName: 'purchase_shares',
      call,
      sharePurchase,
    };
  }

  /**
   * Decodes the four arguments of a `purchase_shares` invocation.
   */
  private parsePurchaseCallArgs(args: xdr.ScVal[]): VerifiedPurchaseTransaction['call'] {
    if (args.length !== 4) {
      throw ApiError.validation('purchase_shares must be called with exactly four arguments');
    }
    const [buyerArg, propertyIdArg, amountArg, paymentTokenArg] = args;
    if (!buyerArg || !propertyIdArg || !amountArg || !paymentTokenArg) {
      throw ApiError.validation('purchase_shares arguments are malformed');
    }

    return {
      buyer: this.asNativeAddress(buyerArg),
      propertyId: this.asNativeBigInt(propertyIdArg),
      amount: this.asNativeBigInt(amountArg),
      paymentToken: this.asNativeAddress(paymentTokenArg),
    };
  }

  getLendingAdminConfig(overrideContractId?: string): {
    contractId: string;
    adminPublicKey: string;
    adminSecret: string;
  } {
    const contractId = overrideContractId ?? getDefiRwaContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw ApiError.badRequest(
        'Soroban lending admin is not configured. Missing contract or admin credentials.',
      );
    }

    this.assertValidContractId(contractId);
    this.assertValidAddress(adminPublicKey);

    return { contractId, adminPublicKey, adminSecret };
  }

  /**
   * Creates a lending pool on the `defi-rwa` contract signed by the configured
   * Stellar admin key. Throws before returning if simulation or submission fails.
   */
  async createLendingPool(params: CreateLendingPoolOnChainParams): Promise<{
    txHash: string;
    contractId: string;
    contractPoolId: string;
  }> {
    const { contractId, adminPublicKey, adminSecret } = this.getLendingAdminConfig(
      params.contractId,
    );
    this.assertValidAssetAddress(params.assetAddress);

    try {
      const client = this.createDefiLendingClient(contractId, adminPublicKey, adminSecret);
      const assembled = await client.createPool({
        admin: adminPublicKey,
        poolId: params.poolId,
        name: params.name,
        asset: params.asset,
        assetAddress: params.assetAddress,
        collateralFactor: params.collateralFactor,
        liquidationThreshold: params.liquidationThreshold,
        liquidationPenalty: params.liquidationPenalty,
        closeFactor: params.closeFactor,
        reserveFactor: params.reserveFactor,
      });
      this.assertAssembledSimulationSucceeded(assembled);
      const sentTransaction = await assembled.signAndSend();

      return {
        txHash: this.getSentTransactionHash(sentTransaction),
        contractId,
        contractPoolId: params.poolId,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.badRequest(
        this.describeError(error, 'Failed to create lending pool on-chain'),
      );
    }
  }

  /**
   * Builds and simulates an unsigned `defi-rwa` lending transaction (`deposit`,
   * `withdraw`, `borrow`, `repay`, or `liquidate`) with the caller's wallet as
   * transaction source. Simulation failures surface as 400 Bad Request errors.
   */
  async prepareLendingAction(
    params: PrepareLendingActionParams,
  ): Promise<{ xdr: string; contractId: string }> {
    this.assertValidContractId(params.contractId);
    this.assertValidAddress(params.actor);

    let callArgs: unknown[];
    switch (params.action) {
      case 'deposit':
      case 'withdraw':
      case 'repay':
        if (params.amount <= 0n) {
          throw ApiError.badRequest('Amount must be greater than zero');
        }
        callArgs = [params.actor, params.poolId, params.amount];
        break;
      case 'borrow':
        if (params.amount <= 0n || params.collateralAmount <= 0n) {
          throw ApiError.badRequest(
            'Borrow amount and collateral amount must be greater than zero',
          );
        }
        this.assertValidAssetAddress(params.collateralAsset);
        callArgs = [
          params.actor,
          params.poolId,
          params.amount,
          params.collateralAsset,
          params.collateralAmount,
        ];
        break;
      case 'liquidate':
        if (params.debtToCover <= 0n) {
          throw ApiError.badRequest('Debt to cover must be greater than zero');
        }
        this.assertValidAddress(params.borrowerAddress);
        callArgs = [params.actor, params.poolId, params.borrowerAddress, params.debtToCover];
        break;
    }

    try {
      const assembled = await this.buildTypedContractTransaction(
        params.contractId,
        params.action,
        callArgs,
        params.actor,
      );
      if (!assembled) {
        throw new Error(`Unsupported lending action ${params.action}`);
      }
      this.assertAssembledSimulationSucceeded(assembled);
      return {
        xdr: assembled.toXDR(),
        contractId: params.contractId,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.badRequest(
        this.describeError(error, `Failed to prepare ${params.action} transaction`),
      );
    }
  }

  /**
   * Verifies a submitted `defi-rwa` lending transaction via Soroban RPC and
   * decodes its typed arguments.
   */
  async verifyLendingTransaction(
    txHash: string,
    expectedContractId: string,
    expectedAction: LendingAction,
  ): Promise<VerifiedLendingTransaction> {
    const confirmed = await this.fetchConfirmedContractCall(
      txHash,
      expectedContractId,
      expectedAction,
    );

    const call = this.parseLendingCallArgs(expectedAction, confirmed.args);

    return {
      txHash: confirmed.txHash,
      sourceAccount: confirmed.sourceAccount,
      contractId: expectedContractId,
      functionName: expectedAction,
      call,
    };
  }

  /**
   * Reads the post-transaction pool totals and user position directly from the
   * `defi-rwa` contract so Postgres caches chain state instead of computing a
   * second ledger in JavaScript.
   */
  async readLendingStateFromChain(params: {
    contractId: string;
    contractPoolId: string;
    userWallet: string;
    kind: 'deposit' | 'borrow';
    readerPublicKey?: string;
  }): Promise<OnChainLendingStateSnapshot> {
    this.assertValidContractId(params.contractId);
    this.assertValidAddress(params.userWallet);
    const reader = params.readerPublicKey ?? params.userWallet;
    this.assertValidAddress(reader);

    const client = this.createDefiLendingClient(params.contractId, reader);

    const totalDepositsTx = await client.getTotalDeposits(params.contractPoolId);
    this.assertAssembledSimulationSucceeded(totalDepositsTx);
    const totalBorrowsTx = await client.getTotalBorrows(params.contractPoolId);
    this.assertAssembledSimulationSucceeded(totalBorrowsTx);

    const totalDeposits = BigInt(totalDepositsTx.result);
    const totalBorrows = BigInt(totalBorrowsTx.result);

    let depositPosition: OnChainDepositSnapshot | null = null;
    let borrowPosition: OnChainBorrowSnapshot | null = null;

    if (params.kind === 'deposit') {
      try {
        const depositTx = await client.getDepositPosition({
          user: params.userWallet,
          poolId: params.contractPoolId,
        });
        this.assertAssembledSimulationSucceeded(depositTx);
        const pos = depositTx.result;
        if (pos && BigInt(pos.amount) > 0n) {
          depositPosition = {
            amount: BigInt(pos.amount),
            shares: BigInt(pos.shares),
            depositedAt: BigInt(pos.deposited_at),
          };
        }
      } catch {
        // Full withdrawal removes the deposit position key in defi-rwa storage.
        depositPosition = null;
      }
    } else {
      try {
        const borrowTx = await client.getBorrowPosition({
          user: params.userWallet,
          poolId: params.contractPoolId,
        });
        this.assertAssembledSimulationSucceeded(borrowTx);
        const pos = borrowTx.result;
        if (pos && BigInt(pos.principal) > 0n) {
          let healthFactor: bigint | null = null;
          try {
            const hfTx = await client.getHealthFactor({
              user: params.userWallet,
              poolId: params.contractPoolId,
            });
            this.assertAssembledSimulationSucceeded(hfTx);
            const hfResult = hfTx.result as unknown as {
              isOk?: () => boolean;
              unwrap?: () => bigint;
            };
            if (typeof hfResult?.isOk === 'function' && hfResult.isOk() && hfResult.unwrap) {
              healthFactor = BigInt(hfResult.unwrap());
            } else if (typeof hfTx.result === 'bigint') {
              healthFactor = hfTx.result;
            }
          } catch {
            healthFactor = null;
          }

          borrowPosition = {
            principal: BigInt(pos.principal),
            collateralAmount: BigInt(pos.collateral_amount),
            collateralAsset: pos.collateral_asset,
            borrowedAt: BigInt(pos.borrowed_at),
            healthFactor,
          };
        }
      } catch {
        // Full repayment or full liquidation removes the borrow position key in defi-rwa storage.
        borrowPosition = null;
      }
    }

    return {
      totalDeposits,
      totalBorrows,
      depositPosition,
      borrowPosition,
    };
  }

  private parseLendingCallArgs(action: LendingAction, args: xdr.ScVal[]): VerifiedLendingCall {
    switch (action) {
      case 'deposit':
      case 'withdraw':
      case 'repay': {
        if (args.length !== 3) {
          throw ApiError.validation(`${action} must be called with exactly three arguments`);
        }
        const [actorArg, poolIdArg, amountArg] = args;
        if (!actorArg || !poolIdArg || !amountArg) {
          throw ApiError.validation(`${action} arguments are malformed`);
        }
        return {
          kind: action,
          actor: this.asNativeAddress(actorArg),
          poolId: this.asNativeString(poolIdArg),
          amount: this.asNativeBigInt(amountArg),
        };
      }
      case 'borrow': {
        if (args.length !== 5) {
          throw ApiError.validation('borrow must be called with exactly five arguments');
        }
        const [actorArg, poolIdArg, amountArg, collateralAssetArg, collateralAmountArg] = args;
        if (!actorArg || !poolIdArg || !amountArg || !collateralAssetArg || !collateralAmountArg) {
          throw ApiError.validation('borrow arguments are malformed');
        }
        return {
          kind: 'borrow',
          actor: this.asNativeAddress(actorArg),
          poolId: this.asNativeString(poolIdArg),
          amount: this.asNativeBigInt(amountArg),
          collateralAsset: this.asNativeAddress(collateralAssetArg),
          collateralAmount: this.asNativeBigInt(collateralAmountArg),
        };
      }
      case 'liquidate': {
        if (args.length !== 4) {
          throw ApiError.validation('liquidate must be called with exactly four arguments');
        }
        const [liquidatorArg, poolIdArg, borrowerArg, debtToCoverArg] = args;
        if (!liquidatorArg || !poolIdArg || !borrowerArg || !debtToCoverArg) {
          throw ApiError.validation('liquidate arguments are malformed');
        }
        return {
          kind: 'liquidate',
          actor: this.asNativeAddress(liquidatorArg),
          poolId: this.asNativeString(poolIdArg),
          borrowerAddress: this.asNativeAddress(borrowerArg),
          debtToCover: this.asNativeBigInt(debtToCoverArg),
        };
      }
    }
  }

  private assertAssembledSimulationSucceeded(assembled: {
    simulation?: unknown;
    result?: unknown;
  }): void {
    const simulation = assembled.simulation;
    if (
      simulation &&
      typeof simulation === 'object' &&
      'error' in simulation &&
      typeof (simulation as { error?: unknown }).error === 'string' &&
      (simulation as { error: string }).error.length > 0
    ) {
      throw ApiError.badRequest(
        (simulation as { error: string }).error || 'Transaction simulation failed',
      );
    }

    let simulatedResult: unknown;
    try {
      simulatedResult = assembled.result;
    } catch (error) {
      throw ApiError.badRequest(this.describeError(error, 'Transaction simulation failed'));
    }

    const maybeResult = simulatedResult as {
      isErr?: () => boolean;
      unwrapErr?: () => unknown;
    } | null;
    if (maybeResult && typeof maybeResult.isErr === 'function' && maybeResult.isErr()) {
      const errDetail =
        typeof maybeResult.unwrapErr === 'function' ? maybeResult.unwrapErr() : undefined;
      const errMessage =
        errDetail && typeof errDetail === 'object' && 'message' in errDetail
          ? String((errDetail as { message: unknown }).message)
          : String(errDetail ?? 'Contract returned an error');
      throw ApiError.badRequest(`Contract simulation error: ${errMessage}`);
    }
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
    const native = scValToNative(value);
    if (typeof native !== 'string') {
      throw ApiError.validation('Expected a string argument');
    }
    return native;
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

  assertValidAssetAddress(address: string): void {
    if (!this.validateAddress(address) && !this.validateContractId(address)) {
      throw ApiError.badRequest('Invalid Stellar or Soroban asset address format');
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
      case 'create_pool': {
        const hasCloseFactor = args.length >= 10;
        return lendingClient.createPool({
          admin: this.asAddress(args[0]),
          poolId: this.asString(args[1]),
          name: this.asString(args[2]),
          asset: this.asString(args[3]),
          assetAddress: this.asAddress(args[4]),
          collateralFactor: this.asBigInt(args[5]),
          liquidationThreshold: this.asBigInt(args[6]),
          liquidationPenalty: this.asBigInt(args[7]),
          closeFactor: hasCloseFactor ? this.asBigInt(args[8]) : 500_000_000_000_000_000n,
          reserveFactor: this.asNumber(hasCloseFactor ? args[9] : args[8]),
        });
      }
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
