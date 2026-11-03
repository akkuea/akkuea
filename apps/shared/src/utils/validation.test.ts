import { describe, it, expect } from "bun:test";
import { Keypair } from "@stellar/stellar-sdk";
import { ValidationService } from "./validation.js";
import type {
  PropertyInfo,
  ShareOwnership,
  LendingPool,
  Transaction,
  RealEstateValuationPayload,
} from "../types/index.js";

const VALID_ACCOUNT_ADDRESS = Keypair.random().publicKey();
const VALID_CONTRACT_ADDRESS =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const makeValidProperty = (
  overrides: Partial<PropertyInfo> = {},
): Partial<PropertyInfo> => ({
  id: "prop-001",
  owner: VALID_ACCOUNT_ADDRESS,
  totalShares: 1000,
  availableShares: 500,
  pricePerShare: "100.50",
  ...overrides,
});

const makeValidOwnership = (
  overrides: Partial<ShareOwnership> = {},
): Partial<ShareOwnership> => ({
  propertyId: "prop-001",
  owner: VALID_ACCOUNT_ADDRESS,
  shares: 25,
  purchasePrice: "2500.00",
  ...overrides,
});

const makeValidPool = (
  overrides: Partial<LendingPool> = {},
): Partial<LendingPool> => ({
  id: "pool-usdc",
  asset: "USDC",
  assetAddress: VALID_CONTRACT_ADDRESS,
  collateralFactor: 7500,
  totalDeposits: "100000.00",
  totalBorrows: "40000.00",
  ...overrides,
});

const makeValidTransaction = (
  overrides: Partial<Transaction> = {},
): Partial<Transaction> => ({
  id: "tx-001",
  type: "deposit",
  amount: "500.00",
  from: VALID_ACCOUNT_ADDRESS,
  hash: "abc123def456",
  ...overrides,
});

const makeValidValuationPayload = (
  overrides: Partial<RealEstateValuationPayload> = {},
): Partial<RealEstateValuationPayload> => ({
  propertyId: "prop-001",
  price: 250000,
  currency: "USD",
  sourceId: "src-001",
  sourceName: "Appraisal Service",
  timestamp: new Date(Date.now() - 60_000),
  confidence: 90,
  methodology: "automated",
  provenance: {
    dataProvider: "Trusted Valuations Inc.",
    licenseNumber: "LIC-9876",
    assessorName: "John Doe",
  },
  metadata: {
    squareFootage: 2000,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2015,
    propertyType: "residential",
  },
  ...overrides,
});

describe("ValidationService", () => {
  describe("validatePropertyInfo", () => {
    it("accepts a valid property payload", () => {
      const result =
        ValidationService.validatePropertyInfo(makeValidProperty());
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing required fields", () => {
      const result = ValidationService.validatePropertyInfo({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property ID is required");
      expect(result.errors).toContain("Valid owner address is required");
      expect(result.errors).toContain("Total shares must be greater than 0");
      expect(result.errors).toContain("Price per share must be greater than 0");
    });

    it("rejects non-numeric pricePerShare ('abc'), NaN, and Infinity", () => {
      const abcResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ pricePerShare: "abc" }),
      );
      expect(abcResult.isValid).toBe(false);
      expect(abcResult.errors).toContain(
        "Price per share must be greater than 0",
      );

      const infResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ pricePerShare: "Infinity" }),
      );
      expect(infResult.isValid).toBe(false);
      expect(infResult.errors).toContain(
        "Price per share must be greater than 0",
      );

      const nanSharesResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ totalShares: Number.NaN }),
      );
      expect(nanSharesResult.isValid).toBe(false);
      expect(nanSharesResult.errors).toContain(
        "Total shares must be greater than 0",
      );
    });

    it("rejects negative or excessive availableShares and contract owner addresses", () => {
      const negResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ availableShares: -1 }),
      );
      expect(negResult.isValid).toBe(false);
      expect(negResult.errors).toContain("Available shares cannot be negative");

      const nanAvailResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ availableShares: Number.NaN }),
      );
      expect(nanAvailResult.isValid).toBe(false);
      expect(nanAvailResult.errors).toContain(
        "Available shares cannot be negative",
      );

      const exceedResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ totalShares: 100, availableShares: 101 }),
      );
      expect(exceedResult.isValid).toBe(false);
      expect(exceedResult.errors).toContain(
        "Available shares cannot exceed total shares",
      );

      const contractOwnerResult = ValidationService.validatePropertyInfo(
        makeValidProperty({ owner: VALID_CONTRACT_ADDRESS }),
      );
      expect(contractOwnerResult.isValid).toBe(false);
      expect(contractOwnerResult.errors).toContain(
        "Valid owner address is required",
      );
    });
  });

  describe("validateShareOwnership", () => {
    it("accepts a valid share ownership payload", () => {
      const result =
        ValidationService.validateShareOwnership(makeValidOwnership());
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing required fields", () => {
      const result = ValidationService.validateShareOwnership({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property ID is required");
      expect(result.errors).toContain("Valid owner address is required");
      expect(result.errors).toContain(
        "Number of shares must be greater than 0",
      );
      expect(result.errors).toContain("Purchase price must be greater than 0");
    });

    it("rejects NaN shares and non-finite purchasePrice", () => {
      const result = ValidationService.validateShareOwnership(
        makeValidOwnership({
          shares: Number.NaN,
          purchasePrice: "abc",
          owner: VALID_CONTRACT_ADDRESS,
        }),
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Valid owner address is required");
      expect(result.errors).toContain(
        "Number of shares must be greater than 0",
      );
      expect(result.errors).toContain("Purchase price must be greater than 0");
    });
  });

  describe("validateLendingPool", () => {
    it("accepts a valid lending pool with a C... contract assetAddress", () => {
      const result = ValidationService.validateLendingPool(
        makeValidPool({ assetAddress: VALID_CONTRACT_ADDRESS }),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("accepts a valid lending pool with a G... account assetAddress", () => {
      const result = ValidationService.validateLendingPool(
        makeValidPool({ assetAddress: VALID_ACCOUNT_ADDRESS }),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing fields and malformed assetAddress", () => {
      const missingResult = ValidationService.validateLendingPool({});
      expect(missingResult.isValid).toBe(false);
      expect(missingResult.errors).toContain("Pool ID is required");
      expect(missingResult.errors).toContain("Asset is required");
      expect(missingResult.errors).toContain("Valid asset address is required");
      expect(missingResult.errors).toContain(
        "Collateral factor must be between 0 and 10000 basis points",
      );

      const badContractResult = ValidationService.validateLendingPool(
        makeValidPool({
          assetAddress:
            "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYS0",
        }),
      );
      expect(badContractResult.isValid).toBe(false);
      expect(badContractResult.errors).toContain(
        "Valid asset address is required",
      );
    });

    it("rejects NaN/non-finite deposits, borrows, and collateralFactor", () => {
      const badNumbers = ValidationService.validateLendingPool(
        makeValidPool({
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

      const borrowsExceedResult = ValidationService.validateLendingPool(
        makeValidPool({
          totalDeposits: "100.00",
          totalBorrows: "200.00",
        }),
      );
      expect(borrowsExceedResult.isValid).toBe(false);
      expect(borrowsExceedResult.errors).toContain(
        "Total borrows cannot exceed total deposits",
      );
    });
  });

  describe("validateTransaction", () => {
    it("accepts a valid transaction", () => {
      const result = ValidationService.validateTransaction(
        makeValidTransaction(),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing required fields and whitespace hash", () => {
      const result = ValidationService.validateTransaction({ hash: "   " });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Transaction ID is required");
      expect(result.errors).toContain("Valid transaction type is required");
      expect(result.errors).toContain("Amount must be greater than 0");
      expect(result.errors).toContain("Valid from address is required");
      expect(result.errors).toContain("Transaction hash cannot be empty");
    });

    it("rejects non-numeric ('abc') and 'Infinity' transaction amounts", () => {
      const abcResult = ValidationService.validateTransaction(
        makeValidTransaction({ amount: "abc" }),
      );
      expect(abcResult.isValid).toBe(false);
      expect(abcResult.errors).toContain("Amount must be greater than 0");

      const infResult = ValidationService.validateTransaction(
        makeValidTransaction({ amount: "Infinity" }),
      );
      expect(infResult.isValid).toBe(false);
      expect(infResult.errors).toContain("Amount must be greater than 0");

      const contractFromResult = ValidationService.validateTransaction(
        makeValidTransaction({ from: VALID_CONTRACT_ADDRESS }),
      );
      expect(contractFromResult.isValid).toBe(false);
      expect(contractFromResult.errors).toContain(
        "Valid from address is required",
      );
    });
  });

  describe("validateStellarAddress and validateContractAddress", () => {
    it("validates G... account addresses and rejects C... or malformed addresses", () => {
      expect(
        ValidationService.validateStellarAddress(VALID_ACCOUNT_ADDRESS),
      ).toBe(true);
      expect(
        ValidationService.validateStellarAddress(VALID_CONTRACT_ADDRESS),
      ).toBe(false);
      expect(ValidationService.validateStellarAddress("invalid")).toBe(false);
      expect(
        ValidationService.validateStellarAddress("G" + "A".repeat(55)),
      ).toBe(false);
    });

    it("validates C... contract addresses and rejects G... or malformed addresses", () => {
      expect(
        ValidationService.validateContractAddress(VALID_CONTRACT_ADDRESS),
      ).toBe(true);
      expect(
        ValidationService.validateContractAddress(VALID_ACCOUNT_ADDRESS),
      ).toBe(false);
      expect(ValidationService.validateContractAddress("invalid")).toBe(false);
    });
  });

  describe("validateEmail", () => {
    it("accepts valid email addresses and rejects malformed ones", () => {
      expect(ValidationService.validateEmail("user@akkuea.com")).toBe(true);
      expect(ValidationService.validateEmail("invalid-email")).toBe(false);
      expect(ValidationService.validateEmail("missing@domain")).toBe(false);
      expect(ValidationService.validateEmail("@nodomain.com")).toBe(false);
    });
  });

  describe("validateKYCDocument", () => {
    it("accepts supported KYC document types and rejects unknown types", () => {
      expect(ValidationService.validateKYCDocument("passport")).toBe(true);
      expect(ValidationService.validateKYCDocument("id_card")).toBe(true);
      expect(ValidationService.validateKYCDocument("proof_of_address")).toBe(
        true,
      );
      expect(ValidationService.validateKYCDocument("other")).toBe(true);
      expect(ValidationService.validateKYCDocument("driver_license")).toBe(
        false,
      );
    });
  });

  describe("validateValuationPayload", () => {
    it("accepts a valid valuation payload", () => {
      const result = ValidationService.validateValuationPayload(
        makeValidValuationPayload(),
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing required fields", () => {
      const result = ValidationService.validateValuationPayload({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Property ID is required");
      expect(result.errors).toContain("Price must be greater than 0");
      expect(result.errors).toContain("Currency is required");
      expect(result.errors).toContain("Source ID is required");
      expect(result.errors).toContain("Source name is required");
      expect(result.errors).toContain("Timestamp is required");
      expect(result.errors).toContain("Confidence must be between 0 and 100");
      expect(
        result.errors.some((e) => e.startsWith("Methodology must be one of:")),
      ).toBe(true);
      expect(result.errors).toContain("Provenance dataProvider is required");
    });

    it("rejects invalid timestamp strings ('not-a-date') and Invalid Date instances", () => {
      const strResult = ValidationService.validateValuationPayload(
        makeValidValuationPayload({
          timestamp: "not-a-date" as unknown as Date,
        }),
      );
      expect(strResult.isValid).toBe(false);
      expect(strResult.errors).toContain("Timestamp must be a valid date");

      const invalidDateResult = ValidationService.validateValuationPayload(
        makeValidValuationPayload({
          timestamp: new Date("not-a-date"),
        }),
      );
      expect(invalidDateResult.isValid).toBe(false);
      expect(invalidDateResult.errors).toContain(
        "Timestamp must be a valid date",
      );
    });

    it("rejects NaN and non-numeric ('abc') price values", () => {
      const nanPrice = ValidationService.validateValuationPayload(
        makeValidValuationPayload({ price: Number.NaN }),
      );
      expect(nanPrice.isValid).toBe(false);
      expect(nanPrice.errors).toContain("Price must be greater than 0");

      const abcPrice = ValidationService.validateValuationPayload(
        makeValidValuationPayload({ price: "abc" as unknown as number }),
      );
      expect(abcPrice.isValid).toBe(false);
      expect(abcPrice.errors).toContain("Price must be greater than 0");
    });

    it("rejects NaN confidence values", () => {
      const nanConfidence = ValidationService.validateValuationPayload(
        makeValidValuationPayload({ confidence: Number.NaN }),
      );
      expect(nanConfidence.isValid).toBe(false);
      expect(nanConfidence.errors).toContain(
        "Confidence must be between 0 and 100",
      );
    });
  });

  describe("sanitizeString", () => {
    it("trims whitespace and strips angle brackets", () => {
      expect(
        ValidationService.sanitizeString("  <script>alert(1)</script>  "),
      ).toBe("scriptalert(1)/script");
    });
  });
});
