/**
 * soroban-tx.ts
 *
 * Builds unsigned Soroban transaction XDR strings ready for wallet signing.
 *
 * Flow for every action:
 *   1. Fetch the source account from the Soroban RPC (sequence number).
 *   2. Build a TransactionBuilder with the contract call operation.
 *   3. simulateTransaction to obtain the resource fee + Soroban footprint.
 *   4. assembleTransaction to attach the simulation data.
 *   5. Return the assembled, unsigned XDR (base64) for the wallet to sign.
 *
 * After signing, callers must submit via submitSorobanTx() and then poll
 * getTransactionStatus() until the transaction is confirmed or failed.
 */

import {
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  xdr,
} from "@stellar/stellar-sdk";
import gameContractsTestnet from "@akkuea/shared/game-contracts.testnet.json";

// ── Network constants ────────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  gameContractsTestnet.rpcUrl ??
  "https://soroban-testnet.stellar.org";

// ── Contract addresses ───────────────────────────────────────────────────────
//
// Every ID below falls back to the real, deployed game contracts recorded in
// game-contracts.testnet.json (see docs/deployment/deploy-game-contracts.md).
// An env var override lets a reviewer point the app at their own deploy
// without editing this file.

/**
 * The game's property NFT contract.
 * Treasury purchases and NFT transfers go through this contract.
 */
export const PROPERTY_NFT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_PROPERTY_NFT_CONTRACT_ID ??
  gameContractsTestnet.contracts.GAME_PROPERTY_NFT.contractId;

/**
 * The game engine contract, used for improve and claim_rental.
 */
export const GAME_ENGINE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID ??
  gameContractsTestnet.contracts.GAME_ENGINE.contractId;

/**
 * The marketplace contract for player-to-player purchases.
 */
export const MARKETPLACE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID ??
  gameContractsTestnet.contracts.GAME_MARKETPLACE.contractId;

/**
 * The LAND utility token contract, used for the onboarding faucet claim and
 * balance reads.
 */
export const LAND_TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_LAND_TOKEN_CONTRACT_ID ??
  gameContractsTestnet.contracts.GAME_LAND_TOKEN.contractId;

/**
 * The Stellar account that owns every unclaimed tile on-chain. Defaults to
 * the address that deployed and initialized the game contracts (see
 * `deployedBy` in game-contracts.testnet.json) - by convention the same key
 * also holds the treasury role unless a separate treasury was passed to the
 * deploy script.
 */
export const TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? gameContractsTestnet.deployedBy;

// ── Shared RPC server singleton ──────────────────────────────────────────────

let _server: SorobanRpc.Server | null = null;

export function getSorobanServer(): SorobanRpc.Server {
  if (!_server) {
    _server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
  }
  return _server;
}

// ── Property ID helpers ──────────────────────────────────────────────────────

/**
 * Convert a GameProperty.id (e.g. "prop-3-7") to the u32 index used on-chain.
 * Layout: row * 20 + col  →  matches the 20×20 grid.
 *
 * If the id is already a plain number string (e.g. "42") it is used directly.
 */
export function propertyIdToU32(propertyId: string): number {
  // Numeric string - use as-is
  if (/^\d+$/.test(propertyId)) {
    return parseInt(propertyId, 10);
  }

  // "prop-<row>-<col>" format
  const parts = propertyId.split("-");
  if (parts.length === 3 && parts[0] === "prop") {
    const row = parseInt(parts[1], 10);
    const col = parseInt(parts[2], 10);
    if (!isNaN(row) && !isNaN(col)) {
      return row * 20 + col;
    }
  }

  throw new Error(
    `Cannot convert property id "${propertyId}" to a u32 contract argument.`,
  );
}

// ── Core transaction builder ─────────────────────────────────────────────────

interface BuildTxOptions {
  /** Stellar account that will be the transaction source and sign it. */
  sourceAddress: string;
  /** Contract to call. */
  contractId: string;
  /** On-chain function name (snake_case, matching the Rust #[contractimpl]). */
  functionName: string;
  /** Ordered list of ScVal arguments. Build with nativeToScVal / xdr.ScVal helpers. */
  args: xdr.ScVal[];
  /** Fee in stroops. Defaults to 500 000 (0.05 XLM) to cover Soroban resource fees. */
  fee?: string;
  /** Transaction timeout in seconds. Defaults to 60. */
  timeoutSecs?: number;
}

/**
 * Build a simulated + assembled Soroban transaction XDR (base64, unsigned).
 *
 * Throws if simulation fails (e.g. contract error, insufficient funds).
 */
export async function buildSorobanTx(opts: BuildTxOptions): Promise<string> {
  const {
    sourceAddress,
    contractId,
    functionName,
    args,
    fee = "500000",
    timeoutSecs = 60,
  } = opts;

  const server = getSorobanServer();

  // 1. Fetch account (need current sequence number)
  const account = await server.getAccount(sourceAddress);

  // 2. Build unsigned transaction
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(timeoutSecs)
    .build();

  // 3. Simulate to get resource fee + auth footprint
  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(
      `Soroban simulation failed for ${functionName}: ${simResult.error}`,
    );
  }

  if (SorobanRpc.Api.isSimulationRestore(simResult)) {
    throw new Error(
      `Soroban simulation requires ledger restore before ${functionName} can be called. ` +
        `Please restore expired ledger entries and retry.`,
    );
  }

  // 4. Assemble - injects soroban data + resource fee bump.
  // assembleTransaction returns a TransactionBuilder; build() yields the tx.
  const assembled = SorobanRpc.assembleTransaction(tx, simResult).build();
  return assembled.toXDR();
}

// ── Action-specific XDR builders ─────────────────────────────────────────────

/**
 * Build XDR for: GamePropertyNft.transfer(treasury, buyer, property_id)
 *
 * "Buy from Treasury" is modelled as a direct NFT transfer from the treasury
 * address to the buyer. The treasury must authorise the transfer, so in
 * practice this transaction requires a treasury co-signature (or a
 * server-side treasury account signs automatically). For the client-side
 * demo this builds the buyer-initiated envelope; the server/treasury
 * co-signature can be added via an auth entry or a separate signing route.
 *
 * @param buyerAddress  Stellar address of the player buying the property.
 * @param propertyId    GameProperty.id string (e.g. "prop-3-7").
 * @param treasuryAddress  The treasury account that currently holds the NFT.
 */
export async function buildBuyFromTreasuryXdr(
  buyerAddress: string,
  propertyId: string,
  treasuryAddress: string,
): Promise<string> {
  const u32Id = propertyIdToU32(propertyId);

  return buildSorobanTx({
    sourceAddress: buyerAddress,
    contractId: PROPERTY_NFT_CONTRACT_ID,
    functionName: "transfer",
    args: [
      // from: treasury
      nativeToScVal(treasuryAddress, { type: "address" }),
      // to: buyer
      nativeToScVal(buyerAddress, { type: "address" }),
      // property_id: u32
      nativeToScVal(u32Id, { type: "u32" }),
    ],
  });
}

/**
 * Build XDR for: GameMarketplace.buy(buyer, property_id)
 *
 * Buys a player-listed property from the marketplace escrow.
 *
 * @param buyerAddress  Stellar address of the buyer.
 * @param propertyId    GameProperty.id string.
 */
export async function buildBuyFromPlayerXdr(
  buyerAddress: string,
  propertyId: string,
): Promise<string> {
  const u32Id = propertyIdToU32(propertyId);

  return buildSorobanTx({
    sourceAddress: buyerAddress,
    contractId: MARKETPLACE_CONTRACT_ID,
    functionName: "buy",
    args: [
      // buyer: Address
      nativeToScVal(buyerAddress, { type: "address" }),
      // property_id: u32
      nativeToScVal(u32Id, { type: "u32" }),
    ],
  });
}

/**
 * Build XDR for: GameEngine.improve(caller, property_id)
 *
 * Upgrades a property to the next building level.
 * Deducts LAND tokens from the caller (requires prior approval).
 *
 * @param callerAddress  Owner's Stellar address.
 * @param propertyId     GameProperty.id string.
 */
export async function buildImprovePropertyXdr(
  callerAddress: string,
  propertyId: string,
): Promise<string> {
  const u32Id = propertyIdToU32(propertyId);

  return buildSorobanTx({
    sourceAddress: callerAddress,
    contractId: GAME_ENGINE_CONTRACT_ID,
    functionName: "improve",
    args: [
      // caller: Address
      nativeToScVal(callerAddress, { type: "address" }),
      // property_id: u32
      nativeToScVal(u32Id, { type: "u32" }),
    ],
  });
}

/**
 * Build XDR for: GamePropertyNft.approve(owner, spender, property_id)
 *
 * The marketplace contract's `list` calls `transfer_from` to take custody of
 * the NFT, so the seller must approve the marketplace contract as spender
 * before listing. Must be signed and confirmed before buildListForSaleXdr.
 *
 * @param ownerAddress  Seller's Stellar address (current owner of the tile).
 * @param propertyId    GameProperty.id string.
 */
export async function buildApproveMarketplaceXdr(
  ownerAddress: string,
  propertyId: string,
): Promise<string> {
  const u32Id = propertyIdToU32(propertyId);

  return buildSorobanTx({
    sourceAddress: ownerAddress,
    contractId: PROPERTY_NFT_CONTRACT_ID,
    functionName: "approve",
    args: [
      // owner: Address
      nativeToScVal(ownerAddress, { type: "address" }),
      // spender: Address (the marketplace contract itself)
      nativeToScVal(MARKETPLACE_CONTRACT_ID, { type: "address" }),
      // property_id: u32
      nativeToScVal(u32Id, { type: "u32" }),
    ],
  });
}

/**
 * Build XDR for: GameMarketplace.list(seller, property_id, price)
 *
 * Lists a property for sale on the marketplace at the given price (in LAND).
 * The seller must already have approved the marketplace as spender via
 * buildApproveMarketplaceXdr - the marketplace's `list` immediately calls
 * `transfer_from` to escrow the NFT.
 *
 * @param sellerAddress  Owner's Stellar address.
 * @param propertyId     GameProperty.id string.
 * @param priceInLand    Listing price in LAND tokens (whole units, converted to i128 stroops: × 10^7).
 */
export async function buildListForSaleXdr(
  sellerAddress: string,
  propertyId: string,
  priceInLand: number,
): Promise<string> {
  const u32Id = propertyIdToU32(propertyId);
  // LAND token uses 7 decimal places (like Stellar native); convert whole units → stroops
  const priceStroops = BigInt(Math.round(priceInLand * 1e7));

  return buildSorobanTx({
    sourceAddress: sellerAddress,
    contractId: MARKETPLACE_CONTRACT_ID,
    functionName: "list",
    args: [
      // seller: Address
      nativeToScVal(sellerAddress, { type: "address" }),
      // property_id: u32
      nativeToScVal(u32Id, { type: "u32" }),
      // price: i128
      nativeToScVal(priceStroops, { type: "i128" }),
    ],
  });
}

/**
 * Build XDR for: GameEngine.claim_rental(caller, property_id)
 *
 * Claims accrued rental income for an owned property.
 *
 * @param callerAddress  Owner's Stellar address.
 * @param propertyId     GameProperty.id string.
 */
export async function buildClaimIncomeXdr(
  callerAddress: string,
  propertyId: string,
): Promise<string> {
  const u32Id = propertyIdToU32(propertyId);

  return buildSorobanTx({
    sourceAddress: callerAddress,
    contractId: GAME_ENGINE_CONTRACT_ID,
    functionName: "claim_rental",
    args: [
      // caller: Address
      nativeToScVal(callerAddress, { type: "address" }),
      // property_id: u32
      nativeToScVal(u32Id, { type: "u32" }),
    ],
  });
}

/**
 * Build XDR for: GameLandToken.faucet(recipient)
 *
 * Claims the one-time testnet faucet grant of LAND tokens. Used by the
 * onboarding "Claim your starter LAND" step. Only callable when the token
 * contract was initialized with `is_testnet = true`.
 *
 * @param recipientAddress  Stellar address to receive the faucet grant.
 */
export async function buildFaucetClaimXdr(
  recipientAddress: string,
): Promise<string> {
  return buildSorobanTx({
    sourceAddress: recipientAddress,
    contractId: LAND_TOKEN_CONTRACT_ID,
    functionName: "faucet",
    args: [
      // recipient: Address
      nativeToScVal(recipientAddress, { type: "address" }),
    ],
  });
}

// ── Balance fetching ────────────────────────────────────────────────────────────

/**
 * Fetch the LAND token balance for a given Stellar address via a Soroban
 * simulated call to `balance_of` on the LAND token contract.
 *
 * Returns the raw balance as a decimal string (7-decimal LAND units, i.e.
 * stroops). Throws if the simulation fails or no return value is returned.
 */
export async function fetchLandBalance(address: string): Promise<string> {
  const server = getSorobanServer();
  const contract = new Contract(LAND_TOKEN_CONTRACT_ID);

  const source = await server.getAccount(address);

  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("balance_of", nativeToScVal(address, { type: "address" })),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`LAND balance check failed: ${sim.error}`);
  }

  if (SorobanRpc.Api.isSimulationRestore(sim)) {
    throw new Error(
      "LAND token contract data expired. Please restore and retry.",
    );
  }

  if (!sim.result?.retval) {
    throw new Error("No return value from balance_of");
  }

  return sim.result.retval.i128()?.toString() ?? "0";
}

// ── Transaction submission & polling ─────────────────────────────────────────

export type TxStatus = "pending" | "success" | "failed" | "not_found";

/**
 * Submit a signed XDR to the Soroban RPC and return the transaction hash.
 *
 * @param signedXdr  Base64 XDR returned by the wallet after signing.
 */
export async function submitSorobanTx(signedXdr: string): Promise<string> {
  const server = getSorobanServer();

  // Reconstruct a Transaction from the signed envelope XDR
  const { Transaction } = await import("@stellar/stellar-sdk");
  const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, "base64");
  const signedTx = new Transaction(envelope, NETWORK_PASSPHRASE);

  const result = await server.sendTransaction(signedTx);

  // sendTransaction returns immediately with PENDING or ERROR
  if (result.status === "ERROR") {
    const errXdr = result.errorResult?.toXDR("base64") ?? "unknown";
    throw new Error(`Transaction submission rejected by node: ${errXdr}`);
  }

  return result.hash;
}

/**
 * Poll getTransaction until the tx moves out of NOT_FOUND / pending.
 *
 * @param hash          Transaction hash from submitSorobanTx.
 * @param maxAttempts   Number of polling attempts (default 20).
 * @param intervalMs    Delay between polls in milliseconds (default 3000).
 */
export async function waitForSorobanTx(
  hash: string,
  maxAttempts = 20,
  intervalMs = 3000,
): Promise<TxStatus> {
  const server = getSorobanServer();

  for (let i = 0; i < maxAttempts; i++) {
    const result = await server.getTransaction(hash);

    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return "success";
    }
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      const resultXdr = result.resultXdr?.toXDR("base64") ?? "unknown";
      throw new Error(`Transaction failed on-chain. Result XDR: ${resultXdr}`);
    }

    // NOT_FOUND → still in mempool, keep polling
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return "pending"; // Timed out but not definitively failed
}
