// Contract IDs are loaded from per-network JSON deployment artifacts rather than
// hard-coded here. These files are updated by the deploy pipeline (see
// docs/contracts/deployment.md), not by the build, so application code can stay
// untouched when contracts are (re)deployed.
import testnetContracts from "../contracts.testnet.json";
import mainnetContracts from "../contracts.mainnet.json";

export const STELLAR_NETWORKS = {
  MAINNET: "public",
  TESTNET: "testnet",
  FUTURENET: "futurenet",
  STANDALONE: "standalone",
} as const;

/**
 * Soroban contract IDs per network, derived from the `contracts.<network>.json`
 * deployment artifacts. An empty string means the contract has not been deployed
 * to that network yet.
 */
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: testnetContracts.contracts.REAL_ESTATE_TOKEN,
    MAINNET: mainnetContracts.contracts.REAL_ESTATE_TOKEN,
  },
  DEFI_LENDING: {
    TESTNET: testnetContracts.contracts.DEFI_LENDING,
    MAINNET: mainnetContracts.contracts.DEFI_LENDING,
  },
} as const;

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
