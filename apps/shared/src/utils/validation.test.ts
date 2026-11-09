import { describe, expect, test } from "bun:test";
import { Keypair } from "@stellar/stellar-sdk";
import { ValidationService } from "./validation.js";
import type {
  LendingPool,
  PropertyInfo,
  RealEstateValuationPayload,
  ShareOwnership,
  Transaction,
} from "../types/index.js";

const VALID_ACCOUNT = Keypair.random().publicKey();
const VALID_CONTRACT =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const makeValidValuation = (
  overrides: Record<string, unknown> = {},
): Partial<RealEstateValuationPayload> => ({
  propertyId: "prop_001",
  price: 250_000,
  currency: "USD",
  sourceId: "src_001",
  sourceName: "Appraisal Source",
  timestamp: new Date(),
  confidence: 95,
  methodology: "comparable_sales",
  provenance: {
    dataProvider: "Trusted Appraisals",
  },
  ...overrides,
});

const makeValidProperty = (
  overrides: Record<string, unknown> = {},
): Partial<PropertyInfo> => ({
  id: "prop_001",
  owner: VALID_ACCOUNT,
  totalShares: 1000,
  availableShares: 500,
  pricePerShare: "100.50",
  ...overrides,
});

const makeValidShareOwnership = (
  overrides: Record<string, unknown> = {},
): Partial<ShareOwnership> => ({
  propertyId: "prop_001",
  owner: VALID_ACCOUNT,
  shares: 10,
  purchasePrice: "1000.00",
  ...overrides,
});

const makeValidLendingPool = (
  overrides: Record<string, unknown> = {},
): Partial<LendingPool> => ({
  id: "pool_usdc",
  asset: "USDC",
  assetAddress: VALID_CONTRACT,
  collateralFactor: 7500,
  totalDeposits: "100000",
  totalBorrows: "25000",
  ...overrides,
});

const makeValidTransaction = (
  overrides: Record<string, unknown> = {},
): Partial<Transaction> => ({
  id: "tx_001",
  type: "deposit",
  amount: "500.25",
  from: VALID_ACCOUNT,
  hash: "abc123hash",
  ...overrides,
});

describe("ValidationService", () => {
  describe("validatePropertyInfo", () => {
    test("accepts a valid property payload", () => {
      const result =
        ValidationService.validatePropertyInfo(makeValidProperty());
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("rejects missing required fields", () => {
      const result = ValidationService.validatePropertyInfo({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property ID is required");
      expect(result.errors).toContain("Valid owner address is required");
      expect(result.errors).toContain("Total shares must be greater than 0");
      expect(result.errors).toContain("Price per share must be greater than 0");
    });

    test("rejects non-numeric and non-finite pricePerShare and share counts", () => {
      expect(
        ValidationService.validatePropertyInfo(
          makeValidProperty({ pricePerShare: "abc" }),
        ),
      ).toEqual({
        isValid: false,
        errors: ["Price per share must be greater than 0"],
      });

      expect(
        ValidationService.validatePropertyInfo(
          makeValidProperty({ pricePerShare: "Infinity" }),
        ).isValid,
      ).toBe(false);

      expect(
        ValidationService.validatePropertyInfo(
          makeValidProperty({ totalShares: Number.NaN }),
        ),
      ).toEqual({
        isValid: false,
        errors: ["Total shares must be greater than 0"],
      });

      expect(
        ValidationService.validatePropertyInfo(
          makeValidProperty({ availableShares: Number.NaN }),
        ),
      ).toEqual({
        isValid: false,
        errors: ["Available shares cannot be negative"],
      });
    });

    test("rejects availableShares exceeding totalShares or contract address as owner", () => {
      const overAvail = ValidationService.validatePropertyInfo(
        makeValidProperty({ totalShares: 100, availableShares: 200 }),
      );
      expect(overAvail.isValid).toBe(false);
      expect(overAvail.errors).toContain(
        "Available shares cannot exceed total shares",
      );

      const contractOwner = ValidationService.validatePropertyInfo(
        makeValidProperty({ owner: VALID_CONTRACT }),
      );
      expect(contractOwner.isValid).toBe(false);
      expect(contractOwner.errors).toContain("Valid owner address is required");
    });
  });

  describe("validateShareOwnership", () => {
    test("accepts a valid share ownership payload", () => {
      const result = ValidationService.validateShareOwnership(
        makeValidShareOwnership(),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("rejects missing required fields and invalid numeric values", () => {
      const missing = ValidationService.validateShareOwnership({});
      expect(missing.isValid).toBe(false);
      expect(missing.errors).toContain("Property ID is required");
      expect(missing.errors).toContain("Valid owner address is required");
      expect(missing.errors).toContain(
        "Number of shares must be greater than 0",
      );
      expect(missing.errors).toContain("Purchase price must be greater than 0");

      const nanShares = ValidationService.validateShareOwnership(
        makeValidShareOwnership({ shares: Number.NaN, purchasePrice: "abc" }),
      );
      expect(nanShares.isValid).toBe(false);
      expect(nanShares.errors).toContain(
        "Number of shares must be greater than 0",
      );
      expect(nanShares.errors).toContain(
        "Purchase price must be greater than 0",
      );
    });
  });

  describe("validateLendingPool", () => {
    test("accepts a valid lending pool with a C... contract assetAddress", () => {
      const result = ValidationService.validateLendingPool(
        makeValidLendingPool({ assetAddress: VALID_CONTRACT }),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("rejects missing fields, malformed assetAddress, and non-finite numbers", () => {
      const missing = ValidationService.validateLendingPool({});
      expect(missing.isValid).toBe(false);
      expect(missing.errors).toContain("Pool ID is required");
      expect(missing.errors).toContain("Asset is required");
      expect(missing.errors).toContain("Valid asset address is required");
      expect(missing.errors).toContain(
        "Collateral factor must be between 0 and 10000 basis points",
      );

      const badAddress = ValidationService.validateLendingPool(
        makeValidLendingPool({ assetAddress: "CINVALIDCONTRACTADDRESS" }),
      );
      expect(badAddress.isValid).toBe(false);
      expect(badAddress.errors).toContain("Valid asset address is required");

      const badNumbers = ValidationService.validateLendingPool(
        makeValidLendingPool({
          collateralFactor: Number.NaN,
          totalDeposits: "abc",
          totalBorrows: "Infinity",
        }),
      );
      expect(badNumbers.isValid).toBe(false);
      expect(badNumbers.errors).toContain(
        "Collateral factor must be between 0 and 10000 basis points",
      );
      expect(badNumbers.errors).toContain("Total deposits cannot be negative");
      expect(badNumbers.errors).toContain("Total borrows cannot be negative");
    });

    test("rejects totalBorrows exceeding totalDeposits", () => {
      const result = ValidationService.validateLendingPool(
        makeValidLendingPool({ totalDeposits: "100", totalBorrows: "250" }),
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Total borrows cannot exceed total deposits",
      );
    });
  });

  describe("validateTransaction", () => {
    test("accepts a valid transaction", () => {
      const result = ValidationService.validateTransaction(
        makeValidTransaction(),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("rejects missing fields and non-finite amounts", () => {
      const missing = ValidationService.validateTransaction({});
      expect(missing.isValid).toBe(false);
      expect(missing.errors).toContain("Transaction ID is required");
      expect(missing.errors).toContain("Valid transaction type is required");
      expect(missing.errors).toContain("Amount must be greater than 0");
      expect(missing.errors).toContain("Valid from address is required");

      expect(
        ValidationService.validateTransaction(
          makeValidTransaction({ amount: "abc" }),
        ),
      ).toEqual({
        isValid: false,
        errors: ["Amount must be greater than 0"],
      });

      expect(
        ValidationService.validateTransaction(
          makeValidTransaction({ amount: "Infinity" }),
        ),
      ).toEqual({
        isValid: false,
        errors: ["Amount must be greater than 0"],
      });
    });
  });

  describe("validateStellarAddress and validateContractAddress", () => {
    test("validates G... account addresses and C... contract addresses distinctly", () => {
      expect(ValidationService.validateStellarAddress(VALID_ACCOUNT)).toBe(
        true,
      );
      expect(ValidationService.validateStellarAddress(VALID_CONTRACT)).toBe(
        false,
      );
      expect(ValidationService.validateStellarAddress("invalid")).toBe(false);

      expect(ValidationService.validateContractAddress(VALID_CONTRACT)).toBe(
        true,
      );
      expect(ValidationService.validateContractAddress(VALID_ACCOUNT)).toBe(
        false,
      );
      expect(ValidationService.validateContractAddress("invalid")).toBe(false);
    });
  });

  describe("validateEmail and validateKYCDocument", () => {
    test("validates email addresses", () => {
      expect(ValidationService.validateEmail("user@akkuea.com")).toBe(true);
      expect(ValidationService.validateEmail("not-an-email")).toBe(false);
    });

    test("validates KYC document types", () => {
      expect(ValidationService.validateKYCDocument("passport")).toBe(true);
      expect(ValidationService.validateKYCDocument("unknown_doc")).toBe(false);
    });
  });

  describe("validateValuationPayload", () => {
    test("accepts a valid valuation payload", () => {
      const result =
        ValidationService.validateValuationPayload(makeValidValuation());
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("rejects missing required fields", () => {
      const result = ValidationService.validateValuationPayload({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property ID is required");
      expect(result.errors).toContain("Price must be greater than 0");
      expect(result.errors).toContain("Currency is required");
      expect(result.errors).toContain("Source ID is required");
      expect(result.errors).toContain("Source name is required");
      expect(result.errors).toContain("Timestamp is required");
      expect(result.errors).toContain("Confidence must be between 0 and 100");
      expect(result.errors).toContain("Provenance dataProvider is required");
    });

    test("rejects invalid timestamp, NaN/string price, and NaN confidence", () => {
      const badDate = ValidationService.validateValuationPayload(
        makeValidValuation({ timestamp: "not-a-date" }),
      );
      expect(badDate.isValid).toBe(false);
      expect(badDate.errors).toContain("Valid timestamp is required");

      const nanPrice = ValidationService.validateValuationPayload(
        makeValidValuation({ price: Number.NaN }),
      );
      expect(nanPrice.isValid).toBe(false);
      expect(nanPrice.errors).toContain("Price must be greater than 0");

      const strPrice = ValidationService.validateValuationPayload(
        makeValidValuation({ price: "abc" }),
      );
      expect(strPrice.isValid).toBe(false);
      expect(strPrice.errors).toContain("Price must be greater than 0");

      const nanConfidence = ValidationService.validateValuationPayload(
        makeValidValuation({ confidence: Number.NaN }),
      );
      expect(nanConfidence.isValid).toBe(false);
      expect(nanConfidence.errors).toContain(
        "Confidence must be between 0 and 100",
      );
    });
  });

  describe("sanitizeString", () => {
    test("trims whitespace and strips angle brackets", () => {
      expect(
        ValidationService.sanitizeString("  <script>alert(1)</script>  "),
      ).toBe("scriptalert(1)/script");
    });
  });
});
