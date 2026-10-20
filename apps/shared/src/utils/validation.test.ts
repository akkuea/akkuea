import { describe, it, expect } from "bun:test";
import { ValidationService } from "./validation";

const ACCOUNT = "GADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOZPI";
const CONTRACT = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const OTHER_CONTRACT =
  "CAEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQTD2L";

function errorsOf(result: { isValid: boolean; errors: string[] }): string[] {
  expect(result.isValid).toBe(false);
  return result.errors;
}

describe("ValidationService", () => {
  describe("validatePropertyInfo", () => {
    it("accepts a minimal valid property", () => {
      const result = ValidationService.validatePropertyInfo({
        id: "3f0a8d3e-6f1c-4f3e-9a1b-2c4d5e6f7a8b",
        owner: ACCOUNT,
        totalShares: 1000,
        pricePerShare: "25.00",
        availableShares: 1000,
      });

      expect(result.errors).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    it("rejects NaN and Infinity total shares", () => {
      for (const totalShares of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const errors = errorsOf(
          ValidationService.validatePropertyInfo({
            id: "3f0a8d3e-6f1c-4f3e-9a1b-2c4d5e6f7a8b",
            owner: ACCOUNT,
            totalShares,
            pricePerShare: "25.00",
          }),
        );
        expect(errors).toContain("Total shares must be greater than 0");
      }
    });

    it("rejects a non-numeric price per share", () => {
      const errors = errorsOf(
        ValidationService.validatePropertyInfo({
          id: "3f0a8d3e-6f1c-4f3e-9a1b-2c4d5e6f7a8b",
          owner: ACCOUNT,
          totalShares: 1000,
          pricePerShare: "not-a-number",
        }),
      );
      expect(errors).toContain("Price per share must be greater than 0");
    });

    it("rejects an infinite price per share", () => {
      const errors = errorsOf(
        ValidationService.validatePropertyInfo({
          id: "3f0a8d3e-6f1c-4f3e-9a1b-2c4d5e6f7a8b",
          owner: ACCOUNT,
          totalShares: 1000,
          pricePerShare: "Infinity",
        }),
      );
      expect(errors).toContain("Price per share must be greater than 0");
    });

    it("rejects a negative or non-finite available share count", () => {
      for (const availableShares of [-1, Number.NaN]) {
        const errors = errorsOf(
          ValidationService.validatePropertyInfo({
            id: "3f0a8d3e-6f1c-4f3e-9a1b-2c4d5e6f7a8b",
            owner: ACCOUNT,
            totalShares: 1000,
            pricePerShare: "25.00",
            availableShares,
          }),
        );
        expect(errors).toContain("Available shares cannot be negative");
      }
    });
  });

  describe("validateShareOwnership", () => {
    const base = {
      propertyId: "3f0a8d3e-6f1c-4f3e-9a1b-2c4d5e6f7a8b",
      owner: ACCOUNT,
      purchasePrice: "250.00",
    };

    it("accepts a valid ownership record", () => {
      const result = ValidationService.validateShareOwnership({
        ...base,
        shares: 10,
      });
      expect(result.errors).toEqual([]);
    });

    it("rejects non-finite share counts", () => {
      for (const shares of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const errors = errorsOf(
          ValidationService.validateShareOwnership({ ...base, shares }),
        );
        expect(errors).toContain("Number of shares must be greater than 0");
      }
    });

    it("rejects a non-numeric purchase price", () => {
      const errors = errorsOf(
        ValidationService.validateShareOwnership({
          ...base,
          shares: 10,
          purchasePrice: "abc",
        }),
      );
      expect(errors).toContain("Purchase price must be greater than 0");
    });
  });

  describe("validateLendingPool", () => {
    const base = {
      id: "pool-1",
      asset: "USDC",
      collateralFactor: 7500,
    };

    it("accepts a contract address as the asset address", () => {
      const result = ValidationService.validateLendingPool({
        ...base,
        assetAddress: CONTRACT,
        totalDeposits: "1000",
        totalBorrows: "250",
      });
      expect(result.errors).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    it("still accepts an account address as the asset address", () => {
      const result = ValidationService.validateLendingPool({
        ...base,
        assetAddress: ACCOUNT,
      });
      expect(result.errors).toEqual([]);
    });

    it("rejects a malformed contract address", () => {
      const errors = errorsOf(
        ValidationService.validateLendingPool({
          ...base,
          assetAddress: `C${"A".repeat(10)}`,
        }),
      );
      expect(errors).toContain("Valid asset address is required");
    });

    it("rejects a non-finite collateral factor", () => {
      for (const collateralFactor of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        10_001,
      ]) {
        const errors = errorsOf(
          ValidationService.validateLendingPool({
            ...base,
            assetAddress: CONTRACT,
            collateralFactor,
          }),
        );
        expect(errors).toContain(
          "Collateral factor must be between 0 and 10000 basis points",
        );
      }
    });

    it("rejects a non-numeric total deposit or borrow amount", () => {
      for (const field of ["totalDeposits", "totalBorrows"] as const) {
        const errors = errorsOf(
          ValidationService.validateLendingPool({
            ...base,
            assetAddress: CONTRACT,
            [field]: "lorem",
          }),
        );
        expect(errors).toContain(
          field === "totalDeposits"
            ? "Total deposits cannot be negative"
            : "Total borrows cannot be negative",
        );
      }
    });

    it("rejects borrows that exceed deposits", () => {
      const errors = errorsOf(
        ValidationService.validateLendingPool({
          ...base,
          assetAddress: CONTRACT,
          totalDeposits: "100",
          totalBorrows: "200",
        }),
      );
      expect(errors).toContain("Total borrows cannot exceed total deposits");
    });
  });

  describe("validateTransaction", () => {
    const base = {
      id: "tx-1",
      type: "deposit" as const,
      from: ACCOUNT,
    };

    it("accepts a valid transaction", () => {
      const result = ValidationService.validateTransaction({
        ...base,
        amount: "42.5",
      });
      expect(result.errors).toEqual([]);
    });

    it("rejects non-finite and non-numeric amounts", () => {
      for (const amount of ["abc", "Infinity", Number.NaN]) {
        const errors = errorsOf(
          ValidationService.validateTransaction({
            ...base,
            amount: amount as unknown as string,
          }),
        );
        expect(errors).toContain("Amount must be greater than 0");
      }
    });

    it("rejects a contract address as the sender", () => {
      const errors = errorsOf(
        ValidationService.validateTransaction({
          ...base,
          from: OTHER_CONTRACT,
          amount: "42.5",
        }),
      );
      expect(errors).toContain("Valid from address is required");
    });
  });

  describe("validateStellarAddress", () => {
    it("accepts an ed25519 account address", () => {
      expect(ValidationService.validateStellarAddress(ACCOUNT)).toBe(true);
    });

    it("rejects contract addresses", () => {
      expect(ValidationService.validateStellarAddress(CONTRACT)).toBe(false);
    });

    it("rejects short and malformed addresses", () => {
      expect(ValidationService.validateStellarAddress("GABC")).toBe(false);
      expect(
        ValidationService.validateStellarAddress(`G${"A".repeat(55)}`),
      ).toBe(false);
    });
  });

  describe("isValidAssetAddress", () => {
    it("accepts both account and contract addresses", () => {
      expect(ValidationService.isValidAssetAddress(ACCOUNT)).toBe(true);
      expect(ValidationService.isValidAssetAddress(CONTRACT)).toBe(true);
    });

    it("rejects malformed addresses", () => {
      expect(ValidationService.isValidAssetAddress("")).toBe(false);
      expect(
        ValidationService.isValidAssetAddress(OTHER_CONTRACT.slice(0, 40)),
      ).toBe(false);
    });
  });

  describe("validateEmail", () => {
    it("accepts a standard email address", () => {
      expect(ValidationService.validateEmail("scout@example.com")).toBe(true);
    });

    it("rejects malformed email addresses", () => {
      expect(ValidationService.validateEmail("scout@example")).toBe(false);
      expect(ValidationService.validateEmail("scout.example.com")).toBe(false);
      expect(ValidationService.validateEmail("scout @example.com")).toBe(false);
    });
  });

  describe("validateKYCDocument", () => {
    it("accepts supported document types", () => {
      for (const type of ["passport", "id_card", "proof_of_address", "other"]) {
        expect(ValidationService.validateKYCDocument(type)).toBe(true);
      }
    });

    it("rejects unsupported document types", () => {
      expect(ValidationService.validateKYCDocument("drivers_license")).toBe(
        false,
      );
      expect(ValidationService.validateKYCDocument("")).toBe(false);
    });
  });

  describe("validateValuationPayload", () => {
    const base = {
      propertyId: "property-1",
      currency: "USD",
      sourceId: "source-1",
      sourceName: "Automated AVM",
      confidence: 90,
      methodology: "automated" as const,
      provenance: { dataProvider: "Automated AVM" },
      metadata: {},
    };

    it("accepts a fresh, well formed payload", () => {
      const result = ValidationService.validateValuationPayload({
        ...base,
        price: 250_000,
        timestamp: new Date(),
      });
      expect(result.errors).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    it("rejects NaN and infinite prices", () => {
      for (const price of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const errors = errorsOf(
          ValidationService.validateValuationPayload({
            ...base,
            price,
            timestamp: new Date(),
          }),
        );
        expect(errors).toContain("Price must be greater than 0");
      }
    });

    it("rejects a non-finite confidence", () => {
      for (const confidence of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        -1,
        101,
      ]) {
        const errors = errorsOf(
          ValidationService.validateValuationPayload({
            ...base,
            confidence,
            price: 250_000,
            timestamp: new Date(),
          }),
        );
        expect(errors).toContain("Confidence must be between 0 and 100");
      }
    });

    it("rejects an unparseable timestamp with its own message", () => {
      const errors = errorsOf(
        ValidationService.validateValuationPayload({
          ...base,
          price: 250_000,
          timestamp: new Date("not-a-date"),
        }),
      );
      expect(errors).toContain("Timestamp must be a valid ISO date");
    });

    it("rejects a stale timestamp", () => {
      const stale = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const errors = errorsOf(
        ValidationService.validateValuationPayload({
          ...base,
          price: 250_000,
          timestamp: stale,
        }),
      );
      expect(
        errors.some((error) => error.startsWith("Valuation is stale")),
      ).toBe(true);
    });

    it("rejects a timestamp in the future", () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const errors = errorsOf(
        ValidationService.validateValuationPayload({
          ...base,
          price: 250_000,
          timestamp: future,
        }),
      );
      expect(errors).toContain("Timestamp cannot be in the future");
    });
  });

  describe("sanitizeString", () => {
    it("trims surrounding whitespace", () => {
      expect(ValidationService.sanitizeString("  harbour view  ")).toBe(
        "harbour view",
      );
    });

    it("strips angle brackets", () => {
      expect(
        ValidationService.sanitizeString("<script>alert(1)</script>"),
      ).toBe("scriptalert(1)/script");
    });
  });
});
