/**
 * Test factories — `create<Type>(overrides?)` functions that return
 * schema-compliant objects with realistic defaults.
 */
import type {
  User,
  KycDocument,
  PropertyLocation,
  PropertyInfo,
  LendingPool,
  DepositPosition,
  BorrowPosition,
  Transaction,
  OraclePrice,
} from "../schemas";
import {
  VALID_STELLAR_ADDRESS,
  VALID_STELLAR_ADDRESS_2,
  USDC_ISSUER_ADDRESS,
  VALID_UUID,
  VALID_TX_HASH,
  BASE_DATE,
  UPDATED_DATE,
} from "./constants";

let _seq = 0;
/** Returns a deterministic UUID with an incrementing suffix to avoid collisions. */
function nextUUID(): string {
  _seq += 1;
  const suffix = String(_seq).padStart(12, "0");
  return `550e8400-e29b-41d4-a716-${suffix}`;
}

/** Reset the internal sequence counter (useful between test suites). */
export function resetFactorySequence(): void {
  _seq = 0;
}

// ---------------------------------------------------------------------------
// Domain factories
// ---------------------------------------------------------------------------

export function createUser(overrides?: Partial<User>): User {
  return {
    id: nextUUID(),
    walletAddress: VALID_STELLAR_ADDRESS,
    email: "investor@example.com",
    displayName: "Test Investor",
    kycStatus: "approved",
    kycTier: "verified",
    kycDocuments: [],
    createdAt: BASE_DATE,
    updatedAt: UPDATED_DATE,
    ...overrides,
  };
}

export function createKycDocument(
  overrides?: Partial<KycDocument>,
): KycDocument {
  return {
    id: nextUUID(),
    userId: VALID_UUID,
    type: "passport",
    fileName: "passport_scan.pdf",
    fileUrl: "https://storage.example.com/docs/passport_scan.pdf",
    status: "approved",
    uploadedAt: BASE_DATE,
    reviewedAt: UPDATED_DATE,
    ...overrides,
  };
}

export function createPropertyLocation(
  overrides?: Partial<PropertyLocation>,
): PropertyLocation {
  return {
    address: "1200 Brickell Ave",
    city: "Miami",
    country: "US",
    postalCode: "33131",
    coordinates: { latitude: 25.7617, longitude: -80.1918 },
    ...overrides,
  };
}

export function createProperty(
  overrides?: Partial<PropertyInfo>,
): PropertyInfo {
  return {
    id: nextUUID(),
    name: "Brickell Luxury Condo",
    description:
      "Premium residential unit in Miami's Brickell financial district",
    propertyType: "residential",
    location: createPropertyLocation(),
    totalValue: "2000000",
    totalShares: 2000,
    availableShares: 500,
    pricePerShare: "1000",
    images: ["https://images.example.com/brickell-condo-1.jpg"],
    documents: [],
    verified: true,
    listedAt: BASE_DATE,
    owner: VALID_STELLAR_ADDRESS,
    ...overrides,
  };
}

export function createLendingPool(
  overrides?: Partial<LendingPool>,
): LendingPool {
  return {
    id: nextUUID(),
    name: "USDC Lending Pool",
    asset: "USDC",
    assetAddress: USDC_ISSUER_ADDRESS,
    totalDeposits: "500000",
    totalBorrows: "200000",
    availableLiquidity: "300000",
    utilizationRate: 40,
    supplyAPY: 8,
    borrowAPY: 10,
    collateralFactor: 75,
    liquidationThreshold: 80,
    liquidationPenalty: 5,
    reserveFactor: 1000,
    isActive: true,
    isPaused: false,
    createdAt: BASE_DATE,
    ...overrides,
  };
}

export function createDepositPosition(
  overrides?: Partial<DepositPosition>,
): DepositPosition {
  return {
    id: nextUUID(),
    poolId: VALID_UUID,
    depositor: VALID_STELLAR_ADDRESS,
    amount: "1000",
    shares: "1000",
    depositedAt: BASE_DATE,
    lastAccrualAt: UPDATED_DATE,
    accruedInterest: "12.50",
    ...overrides,
  };
}

export function createBorrowPosition(
  overrides?: Partial<BorrowPosition>,
): BorrowPosition {
  return {
    id: nextUUID(),
    poolId: VALID_UUID,
    borrower: VALID_STELLAR_ADDRESS_2,
    principal: "500",
    accruedInterest: "8.25",
    collateralAmount: "750",
    collateralAsset: USDC_ISSUER_ADDRESS,
    healthFactor: 1.8,
    borrowedAt: BASE_DATE,
    lastAccrualAt: UPDATED_DATE,
    ...overrides,
  };
}

export function createTransaction(
  overrides?: Partial<Transaction>,
): Transaction {
  return {
    id: nextUUID(),
    type: "deposit",
    hash: VALID_TX_HASH,
    from: VALID_STELLAR_ADDRESS,
    to: USDC_ISSUER_ADDRESS,
    amount: "1000",
    asset: "USDC",
    status: "confirmed",
    timestamp: BASE_DATE,
    ...overrides,
  };
}

export function createOraclePrice(
  overrides?: Partial<OraclePrice>,
): OraclePrice {
  return {
    asset: "USDC",
    assetAddress: USDC_ISSUER_ADDRESS,
    priceUSD: "1.00",
    timestamp: UPDATED_DATE,
    source: "stellarx-oracle",
    confidence: 99,
    ...overrides,
  };
}
