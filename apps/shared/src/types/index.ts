export type {
  PropertyLocation,
  PropertyDocument,
  PropertyInfo,
  ShareOwnership,
} from "../schemas/property.schema";

export type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "../schemas/lending.schema";

export type {
  TransactionType,
  TransactionStatus,
  Transaction,
  TransactionFilter,
  TransactionQueryParams,
  PaginatedTransactionResponse,
} from "../schemas/transaction.schema";

export type {
  KycStatus,
  KycTier,
  KycDocument,
  User,
  OraclePrice,
} from "../schemas/user.schema";

// Observability contracts
export * from "./observability";
export type ValuationMethodology =
  | "automated"
  | "manual"
  | "comparable_sales"
  | "income_approach"
  | "cost_approach";

export type PropertyType = "residential" | "commercial" | "industrial" | "land";

export type ValuationStatus = "active" | "stale" | "rejected" | "manual_review";

export interface ValuationProvenance {
  dataProvider: string;
  reportUrl?: string;
  licenseNumber?: string;
  assessorName?: string;
}

export interface ValuationMetadata {
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  neighborhood?: string;
  propertyType?: PropertyType;
}

export interface RealEstateValuationPayload {
  propertyId: string;
  price: number;
  currency: string;
  sourceId: string;
  sourceName: string;
  timestamp: Date;
  confidence: number;
  methodology: ValuationMethodology;
  provenance: ValuationProvenance;
  metadata: ValuationMetadata;
}

export interface ValuationRecord extends RealEstateValuationPayload {
  id: string;
  status: ValuationStatus;
  receivedAt: Date;
  rejectionReason?: string;
}

export interface ContractValuationPayload {
  propertyId: string;
  priceMicroUsd: number;
  timestamp: number;
  sourceHash: string;
  confidence: number;
}

export * from "./risk";
export * from "./pagination";
