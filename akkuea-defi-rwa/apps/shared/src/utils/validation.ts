import {
  PropertyInfo,
  ShareOwnership,
  Transaction,
  LendingPool,
} from "../types";
import { StrKey } from "stellar-sdk";

export class ValidationService {
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

    if (!property.totalShares || property.totalShares <= 0) {
      errors.push("Total shares must be greater than 0");
    }

    if (!property.valuePerShare || property.valuePerShare <= 0) {
      errors.push("Value per share must be greater than 0");
    }

    if (
      property.availableShares !== undefined &&
      property.availableShares < 0
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

    if (!ownership.shares || ownership.shares <= 0) {
      errors.push("Number of shares must be greater than 0");
    }

    if (!ownership.purchasePrice || ownership.purchasePrice <= 0) {
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

    if (!pool.assetSymbol || pool.assetSymbol.trim().length === 0) {
      errors.push("Asset symbol is required");
    }

    if (
      pool.baseRate === undefined ||
      pool.baseRate < 0 ||
      pool.baseRate > 10000
    ) {
      errors.push("Base rate must be between 0 and 10000 basis points");
    }

    if (
      pool.collateralFactor === undefined ||
      pool.collateralFactor < 0 ||
      pool.collateralFactor > 10000
    ) {
      errors.push("Collateral factor must be between 0 and 10000 basis points");
    }

    if (pool.totalDeposits !== undefined && pool.totalDeposits < 0) {
      errors.push("Total deposits cannot be negative");
    }

    if (pool.totalBorrows !== undefined && pool.totalBorrows < 0) {
      errors.push("Total borrows cannot be negative");
    }

    if (
      pool.totalDeposits &&
      pool.totalBorrows &&
      pool.totalBorrows > pool.totalDeposits
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

    if (!tx.amount || tx.amount <= 0) {
      errors.push("Amount must be greater than 0");
    }

    if (!tx.from || !this.validateStellarAddress(tx.from)) {
      errors.push("Valid from address is required");
    }

    if (!tx.txHash || tx.txHash.trim().length === 0) {
      errors.push("Transaction hash is required");
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

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateKYCDocument(documentType: string): boolean {
    const validTypes = ["passport", "id_card", "proof_of_address", "other"];
    return validTypes.includes(documentType);
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, "");
  }
}
