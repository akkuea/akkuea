// Removed unused imports

export const STELLAR_NETWORKS = {
  MAINNET: "public",
  TESTNET: "testnet",
  FUTURENET: "futurenet",
  STANDALONE: "standalone",
} as const;

/**
 * Deployed Soroban contract addresses.
 *
 * After deploying a contract, populate the corresponding ID here.
 * Use `getContractId()` at runtime — it throws a clear error if the
 * address has not been set yet, instead of silently passing an empty string.
 */
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: "", // TODO: populate after testnet deployment
    MAINNET: "", // TODO: populate after mainnet deployment
  },
  DEFI_LENDING: {
    TESTNET: "", // TODO: populate after testnet deployment
    MAINNET: "", // TODO: populate after mainnet deployment
  },
} as const;

type ContractName = keyof typeof CONTRACT_IDS;
type NetworkName = keyof (typeof CONTRACT_IDS)[ContractName];

/**
 * Safely retrieve a deployed contract address.
 *
 * @throws {Error} if the contract ID has not been configured yet.
 *
 * @example
 * ```ts
 * const id = getContractId("REAL_ESTATE_TOKEN", "TESTNET");
 * ```
 */
export function getContractId(
  contract: ContractName,
  network: NetworkName,
): string {
  const id = CONTRACT_IDS[contract]?.[network];
  if (!id) {
    throw new Error(
      `Contract "${contract}" has no deployed address for "${network}". ` +
        `Deploy the contract and add its ID to CONTRACT_IDS in apps/shared/src/constants/index.ts`,
    );
  }
  return id;
}

export const ASSETS = {
  XLM: {
    code: "XLM",
    issuer: undefined,
    type: "native",
  },
  USDC: {
    code: "USDC",
    issuer: "GA5ZSEJYBEOJ58MWPSPMXSVPZJVHIHAIPSZI7ZS2UXUJRZ4MZEGERUAU",
    type: "token",
  },
  PYUSD: {
    code: "PYUSD",
    issuer: "GDFAJYOEBP74G2MLGPJGXHDQRGO6EFBTOKY3SLGJPXQHOHY4QHVRDYOL",
    type: "token",
  },
} as const;

export const TRANSACTION_TYPES = {
  SHARE_PURCHASE: "share_purchase",
  DEPOSIT: "deposit",
  BORROW: "borrow",
  REPAYMENT: "repayment",
  WITHDRAWAL: "withdrawal",
} as const;

export const KYC_STATUSES = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export const PROPERTY_METADATA_FIELDS = {
  ADDRESS: "address",
  CITY: "city",
  COUNTRY: "country",
  PROPERTY_TYPE: "property_type",
  SQUARE_FOOTAGE: "square_footage",
  YEAR_BUILT: "year_built",
  ZONING: "zoning",
  LEGAL_ID: "legal_id",
} as const;

export const LENDING_DEFAULTS = {
  BASE_RATE: 500, // 5% (in basis points)
  COLLATERAL_FACTOR: 7500, // 75% (in basis points)
  LIQUIDATION_THRESHOLD: 8000, // 80% (in basis points)
  MIN_DEPOSIT: 10000000, // 10 USDC (in smallest units)
  MIN_COLLATERAL_SHARES: 1,
} as const;

export const GAS_FEES = {
  DEFAULT_FEE: "100", // stroops
  HIGH_FEE: "500",
  MAX_FEE: "10000",
} as const;

export const API_ENDPOINTS = {
  HORIZON: {
    MAINNET: "https://horizon.stellar.org",
    TESTNET: "https://horizon-testnet.stellar.org",
  },
  SOROBAN_RPC: {
    MAINNET: "https://rpc.mainnet.stellar.org",
    TESTNET: "https://soroban-testnet.stellar.org",
  },
} as const;
