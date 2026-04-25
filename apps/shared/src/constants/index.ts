// Removed unused imports

export const STELLAR_NETWORKS = {
  MAINNET: "public",
  TESTNET: "testnet",
  FUTURENET: "futurenet",
  STANDALONE: "standalone",
} as const;

/**
 * Contract IDs are loaded from environment variables.
 *
 * These values must be obtained from actual Stellar Testnet/Mainnet deployments.
 * To deploy contracts:
 *
 * 1. Build contracts:
 *    cd apps/contracts
 *    cargo build --target wasm32-unknown-unknown --release
 *
 * 2. Deploy to Stellar Testnet:
 *    stellar contract deploy \\
 *      --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \\
 *      --source-account $(stellar keys address) \\
 *      --network testnet
 *
 * 3. Save the returned contract ID to .env.local or production secrets manager:
 *    REAL_ESTATE_TOKEN_CONTRACT_ID=CXXXXX...
 *    DEFI_LENDING_CONTRACT_ID=CXXXXX...
 *
 * See: docs/deployment/deploy-contracts.md
 */
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID || "",
    MAINNET: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID_MAINNET || "",
  },
  DEFI_LENDING: {
    TESTNET: process.env.DEFI_LENDING_CONTRACT_ID || "",
    MAINNET: process.env.DEFI_LENDING_CONTRACT_ID_MAINNET || "",
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
