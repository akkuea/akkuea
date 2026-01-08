export interface PropertyInfo {
  id: string;
  owner: string;
  totalShares: number;
  availableShares: number;
  valuePerShare: number;
  metadata: Record<string, string>;
  location?: {
    address: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  documents?: {
    title: string;
    url: string;
    type: "deed" | "appraisal" | "inspection" | "other";
  }[];
}

export interface ShareOwnership {
  propertyId: string;
  owner: string;
  shares: number;
  purchaseDate: Date;
  purchasePrice: number;
}

export interface LendingPool {
  id: string;
  assetSymbol: string;
  baseRate: number;
  collateralFactor: number;
  totalDeposits: number;
  totalBorrows: number;
  depositors: string[];
  borrowers: string[];
  isActive: boolean;
}

export interface DepositPosition {
  poolId: string;
  user: string;
  amount: number;
  depositDate: Date;
  accruedInterest: number;
}

export interface BorrowPosition {
  poolId: string;
  borrower: string;
  collateralPropertyId: string;
  collateralShares: number;
  borrowAmount: number;
  borrowDate: Date;
  interestRate: number;
  isLiquidated: boolean;
}

export interface Transaction {
  id: string;
  type: "share_purchase" | "deposit" | "borrow" | "repayment" | "withdrawal";
  amount: number;
  from: string;
  to?: string;
  timestamp: Date;
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  metadata?: Record<string, unknown>;
}

export interface User {
  address: string;
  email?: string;
  kycStatus: "pending" | "verified" | "rejected";
  reputation: number;
  createdAt: Date;
}

export interface KycDocument {
  id: string;
  userId: string;
  documentType: "passport" | "id_card" | "proof_of_address" | "other";
  documentUrl: string;
  status: "pending" | "verified" | "rejected";
  submittedAt: Date;
  verifiedAt?: Date;
}

export interface OraclePrice {
  assetId: string;
  price: number;
  timestamp: Date;
  source: string;
  confidence: number;
}
