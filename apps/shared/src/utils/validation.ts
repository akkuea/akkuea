import type {
  PropertyInfo,
  ShareOwnership,
  Transaction,
  LendingPool,
  RealEstateValuationPayload,
} from "../types/index.js";
import { StrKey } from "@stellar/stellar-sdk";

export class ValidationService {
  private static parseFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
        return null;
      }
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  static validatePropertyInfo(property: Partial<PropertyInfo>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!property.id || property.id.trim().length === 0) {
      errors.push("Property ID is required");
    }

    if (!property.owner || !this.validateStellarAddress(property.owner)) {
      errors.push("Valid owner address is required");
    }

    const totalShares = this.parseFiniteNumber(property.totalShares);
    if (totalShares === null || totalShares <= 0) {
      errors.push("Total shares must be greater than 0");
    }

    const pricePerShare = this.parseFiniteNumber(property.pricePerShare);
    if (pricePerShare === null || pricePerShare <= 0) {
      errors.push("Price per share must be greater than 0");
    }

    let availableShares: number | null = null;
    if (property.availableShares !== undefined) {
      availableShares = this.parseFiniteNumber(property.availableShares);
      if (availableShares === null || availableShares < 0) {
        errors.push("Available shares cannot be negative");
      }
    }

    if (
      totalShares !== null &&
      totalShares > 0 &&
      availableShares !== null &&
      availableShares > totalShares
    ) {
      errors.push("Available shares cannot exceed total shares");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateShareOwnership(ownership: Partial<ShareOwnership>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!ownership.propertyId || ownership.propertyId.trim().length === 0) {
      errors.push("Property ID is required");
    }

    if (!ownership.owner || !this.validateStellarAddress(ownership.owner)) {
      errors.push("Valid owner address is required");
    }

    const shares = this.parseFiniteNumber(ownership.shares);
    if (shares === null || shares <= 0) {
      errors.push("Number of shares must be greater than 0");
    }

    const purchasePrice = this.parseFiniteNumber(ownership.purchasePrice);
    if (purchasePrice === null || purchasePrice <= 0) {
      errors.push("Purchase price must be greater than 0");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateLendingPool(pool: Partial<LendingPool>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!pool.id || pool.id.trim().length === 0) {
      errors.push("Pool ID is required");
    }

    if (!pool.asset || pool.asset.trim().length === 0) {
      errors.push("Asset is required");
    }

    if (
      !pool.assetAddress ||
      (!this.validateStellarAddress(pool.assetAddress) &&
        !this.validateContractAddress(pool.assetAddress))
    ) {
      errors.push("Valid asset address is required");
    }

    const collateralFactor = this.parseFiniteNumber(pool.collateralFactor);
    if (
      collateralFactor === null ||
      collateralFactor < 0 ||
      collateralFactor > 10000
    ) {
      errors.push("Collateral factor must be between 0 and 10000 basis points");
    }

    let totalDeposits: number | null = null;
    if (pool.totalDeposits !== undefined) {
      totalDeposits = this.parseFiniteNumber(pool.totalDeposits);
      if (totalDeposits === null || totalDeposits < 0) {
        errors.push("Total deposits cannot be negative");
      }
    }

    let totalBorrows: number | null = null;
    if (pool.totalBorrows !== undefined) {
      totalBorrows = this.parseFiniteNumber(pool.totalBorrows);
      if (totalBorrows === null || totalBorrows < 0) {
        errors.push("Total borrows cannot be negative");
      }
    }

    if (
      totalDeposits !== null &&
      totalBorrows !== null &&
      totalDeposits >= 0 &&
      totalBorrows >= 0 &&
      totalBorrows > totalDeposits
    ) {
      errors.push("Total borrows cannot exceed total deposits");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateTransaction(tx: Partial<Transaction>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!tx.id || tx.id.trim().length === 0) {
      errors.push("Transaction ID is required");
    }

    if (
      !tx.type ||
      !Object.values([
        "share_purchase",
        "deposit",
        "borrow",
        "repayment",
        "withdrawal",
      ]).includes(tx.type)
    ) {
      errors.push("Valid transaction type is required");
    }

    const amount = this.parseFiniteNumber(tx.amount);
    if (amount === null || amount <= 0) {
      errors.push("Amount must be greater than 0");
    }

    if (!tx.from || !this.validateStellarAddress(tx.from)) {
      errors.push("Valid from address is required");
    }

    if (tx.hash && tx.hash.trim().length === 0) {
      errors.push("Transaction hash cannot be empty");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateStellarAddress(address: string): boolean {
    try {
      if (address.length !== 56) return false;
      if (!address.startsWith("G")) return false;

      // Try to decode as ed25519 public key
      StrKey.decodeEd25519PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  static validateContractAddress(address: string): boolean {
    return typeof address === "string" && StrKey.isValidContract(address);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateKYCDocument(documentType: string): boolean {
    const validTypes = ["passport", "id_card", "proof_of_address", "other"];
    return validTypes.includes(documentType);
  }

  static validateValuationPayload(
    payload: Partial<RealEstateValuationPayload>,
    maxAgeMs: number = 24 * 60 * 60 * 1000,
    minPrice: number = 1,
    maxPrice: number = 1_000_000_000,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.propertyId || payload.propertyId.trim().length === 0) {
      errors.push("Property ID is required");
    }

    const price = this.parseFiniteNumber(payload.price);
    if (price === null || price <= 0) {
      errors.push("Price must be greater than 0");
    } else if (price < minPrice || price > maxPrice) {
      errors.push(`Price must be between ${minPrice} and ${maxPrice}`);
    }

    if (!payload.currency || payload.currency.trim().length === 0) {
      errors.push("Currency is required");
    }

    if (!payload.sourceId || payload.sourceId.trim().length === 0) {
      errors.push("Source ID is required");
    }

    if (!payload.sourceName || payload.sourceName.trim().length === 0) {
      errors.push("Source name is required");
    }

    if (!payload.timestamp) {
      errors.push("Timestamp is required");
    } else {
      const parsedTimestamp = new Date(payload.timestamp).getTime();
      if (!Number.isFinite(parsedTimestamp)) {
        errors.push("Valid timestamp is required");
      } else {
        const age = Date.now() - parsedTimestamp;
        if (age > maxAgeMs) {
          errors.push(
            `Valuation is stale: timestamp is older than ${maxAgeMs / 3600000} hour(s)`,
          );
        }
        if (age < 0) {
          errors.push("Timestamp cannot be in the future");
        }
      }
    }

    const confidence = this.parseFiniteNumber(payload.confidence);
    if (confidence === null || confidence < 0 || confidence > 100) {
      errors.push("Confidence must be between 0 and 100");
    }

    const validMethodologies = [
      "automated",
      "manual",
      "comparable_sales",
      "income_approach",
      "cost_approach",
    ];
    if (
      !payload.methodology ||
      !validMethodologies.includes(payload.methodology)
    ) {
      errors.push(
        `Methodology must be one of: ${validMethodologies.join(", ")}`,
      );
    }

    if (!payload.provenance || !payload.provenance.dataProvider) {
      errors.push("Provenance dataProvider is required");
    }

    return { isValid: errors.length === 0, errors };
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, "");
  }
}
