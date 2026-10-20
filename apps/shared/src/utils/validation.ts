import type {
  PropertyInfo,
  ShareOwnership,
  Transaction,
  LendingPool,
  RealEstateValuationPayload,
} from "../types/index.js";
import { StrKey } from "@stellar/stellar-sdk";

export class ValidationService {
  /**
   * Finite-number guard used by every amount, price, share count and
   * confidence check. `NaN` and `Infinity` compare false against every
   * boundary (`NaN <= 0` is false, `Infinity <= 0` is false), so a plain
   * comparison lets them through; the explicit check does not.
   */
  private static isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  /**
   * A number, or a numeric string, that parses to a finite positive value.
   * Amounts arrive as decimal strings (`"100.50"`), so the string branch is
   * required; `"abc"` parses to NaN and is rejected.
   */
  private static isPositiveAmount(value: unknown): boolean {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed > 0;
    }
    return false;
  }

  /** Same as `isPositiveAmount`, but zero is allowed. */
  private static isNonNegativeAmount(value: unknown): boolean {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }
    return false;
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

    if (
      !this.isFiniteNumber(property.totalShares) ||
      property.totalShares <= 0
    ) {
      errors.push("Total shares must be greater than 0");
    }

    if (!this.isPositiveAmount(property.pricePerShare)) {
      errors.push("Price per share must be greater than 0");
    }

    if (
      property.availableShares !== undefined &&
      (!this.isFiniteNumber(property.availableShares) ||
        property.availableShares < 0)
    ) {
      errors.push("Available shares cannot be negative");
    }

    if (
      property.totalShares &&
      property.availableShares &&
      property.availableShares > property.totalShares
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

    if (!this.isFiniteNumber(ownership.shares) || ownership.shares <= 0) {
      errors.push("Number of shares must be greater than 0");
    }

    if (!this.isPositiveAmount(ownership.purchasePrice)) {
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

    if (!pool.assetAddress || !this.isValidAssetAddress(pool.assetAddress)) {
      errors.push("Valid asset address is required");
    }

    if (
      pool.collateralFactor === undefined ||
      !this.isFiniteNumber(pool.collateralFactor) ||
      pool.collateralFactor < 0 ||
      pool.collateralFactor > 10000
    ) {
      errors.push("Collateral factor must be between 0 and 10000 basis points");
    }

    if (
      pool.totalDeposits !== undefined &&
      !this.isNonNegativeAmount(pool.totalDeposits)
    ) {
      errors.push("Total deposits cannot be negative");
    }

    if (
      pool.totalBorrows !== undefined &&
      !this.isNonNegativeAmount(pool.totalBorrows)
    ) {
      errors.push("Total borrows cannot be negative");
    }

    if (
      pool.totalDeposits &&
      pool.totalBorrows &&
      parseFloat(pool.totalBorrows) > parseFloat(pool.totalDeposits)
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

    if (!this.isPositiveAmount(tx.amount)) {
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

  /**
   * Asset addresses may be either an account (native asset) or a Soroban
   * contract (`C...`). `validateStellarAddress` stays account-only; this
   * helper is the one used where a contract address is legitimate.
   */
  static isValidAssetAddress(address: string): boolean {
    if (!address || address.length !== 56) return false;

    if (address.startsWith("C")) {
      return StrKey.isValidContract(address);
    }

    return this.validateStellarAddress(address);
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

    if (!this.isFiniteNumber(payload.price) || payload.price <= 0) {
      errors.push("Price must be greater than 0");
    } else if (payload.price < minPrice || payload.price > maxPrice) {
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
    } else if (Number.isNaN(new Date(payload.timestamp).getTime())) {
      // An unparseable timestamp used to reach the age arithmetic, where
      // NaN compares false against every bound and slipped through.
      errors.push("Timestamp must be a valid ISO date");
    } else {
      const age = Date.now() - new Date(payload.timestamp).getTime();
      if (age > maxAgeMs) {
        errors.push(
          `Valuation is stale: timestamp is older than ${maxAgeMs / 3600000} hour(s)`,
        );
      }
      if (age < 0) {
        errors.push("Timestamp cannot be in the future");
      }
    }

    if (
      payload.confidence === undefined ||
      !this.isFiniteNumber(payload.confidence) ||
      payload.confidence < 0 ||
      payload.confidence > 100
    ) {
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
