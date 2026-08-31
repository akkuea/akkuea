import { describe, it, expect } from "bun:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  validateApiEnv,
  validateWebappEnv,
  EnvValidationError,
  isStellarPublicKey,
  isStellarSecretSeed,
  isStellarContractId,
} from "../index";

const sampleKeypair = Keypair.random();
const VALID_PUBLIC_KEY = sampleKeypair.publicKey();
const VALID_SECRET_KEY = sampleKeypair.secret();
const VALID_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32));

const VALID_API_ENV = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/akkuea_defi",
  DATABASE_POOL_MAX: "10",
  DATABASE_SSL: "false",
  PORT: "3001",
  NODE_ENV: "development",
  LOG_LEVEL: "info",
  WEBHOOK_SECRET: "0123456789abcdef0123456789abcdef",
  OPERATIONS_BACKEND_CREDENTIAL: "0123456789abcdef0123456789abcdef",
  OPERATIONS_ALLOWED_WALLETS: "*",
  LIQUIDATOR_API_KEY: "0123456789abcdef0123456789abcdef",
  INTERNAL_API_KEY: "0123456789abcdef0123456789abcdef",
  KYC_UPLOAD_DIR: "/tmp/akkuea-kyc",
  STELLAR_NETWORK: "testnet",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  STELLAR_ADMIN_PUBLIC_KEY: VALID_PUBLIC_KEY,
  STELLAR_ADMIN_SECRET: VALID_SECRET_KEY,
  REAL_ESTATE_TOKEN_CONTRACT_ID: VALID_CONTRACT_ID,
};

const VALID_WEBAPP_ENV = {
  NEXT_PUBLIC_API_URL: "http://localhost:3001",
  API_URL: "http://localhost:3001",
  OPERATIONS_BACKEND_CREDENTIAL: "0123456789abcdef0123456789abcdef",
  OPERATIONS_ALLOWED_WALLETS: "*",
  NEXT_PUBLIC_USE_MOCK: "false",
};

describe("Environment Validation Module", () => {
  describe("Stellar Format Helper Functions", () => {
    it("validates Stellar public keys starting with G", () => {
      expect(isStellarPublicKey(VALID_PUBLIC_KEY)).toBe(true);
      expect(isStellarPublicKey("invalid_address")).toBe(false);
      expect(isStellarPublicKey(VALID_SECRET_KEY)).toBe(false);
    });

    it("validates Stellar secret seeds starting with S", () => {
      expect(isStellarSecretSeed(VALID_SECRET_KEY)).toBe(true);
      expect(isStellarSecretSeed("invalid_secret")).toBe(false);
      expect(isStellarSecretSeed(VALID_PUBLIC_KEY)).toBe(false);
    });

    it("validates Soroban contract IDs starting with C", () => {
      expect(isStellarContractId(VALID_CONTRACT_ID)).toBe(true);
      expect(isStellarContractId("invalid_contract_id")).toBe(false);
    });
  });

  describe("API Environment Validation (validateApiEnv)", () => {
    it("successfully validates a complete and valid API environment", () => {
      const parsed = validateApiEnv(VALID_API_ENV);
      expect(parsed.DATABASE_URL).toBe(VALID_API_ENV.DATABASE_URL);
      expect(parsed.PORT).toBe(3001);
      expect(parsed.NODE_ENV).toBe("development");
      expect(parsed.STELLAR_ADMIN_PUBLIC_KEY).toBe(VALID_PUBLIC_KEY);
    });

    it("fails fast when a required variable is missing", () => {
      const invalidEnv = { ...VALID_API_ENV };
      delete (invalidEnv as Record<string, string | undefined>).DATABASE_URL;

      expect(() => validateApiEnv(invalidEnv)).toThrow(EnvValidationError);
      try {
        validateApiEnv(invalidEnv);
      } catch (err) {
        const error = err as EnvValidationError;
        expect(error.message).toContain("DATABASE_URL");
        expect(error.message).toContain("docs/ENV_SETUP.md");
      }
    });

    it("fails when STELLAR_ADMIN_PUBLIC_KEY is malformed", () => {
      const invalidEnv = {
        ...VALID_API_ENV,
        STELLAR_ADMIN_PUBLIC_KEY: "INVALID_PUBLIC_KEY",
      };

      expect(() => validateApiEnv(invalidEnv)).toThrow(EnvValidationError);
      try {
        validateApiEnv(invalidEnv);
      } catch (err) {
        const error = err as EnvValidationError;
        expect(error.message).toContain("STELLAR_ADMIN_PUBLIC_KEY");
      }
    });

    it("fails when STELLAR_ADMIN_SECRET is malformed", () => {
      const invalidEnv = {
        ...VALID_API_ENV,
        STELLAR_ADMIN_SECRET: "INVALID_SECRET_KEY",
      };

      expect(() => validateApiEnv(invalidEnv)).toThrow(EnvValidationError);
      try {
        validateApiEnv(invalidEnv);
      } catch (err) {
        const error = err as EnvValidationError;
        expect(error.message).toContain("STELLAR_ADMIN_SECRET");
      }
    });

    it("fails when a URL is invalid", () => {
      const invalidEnv = {
        ...VALID_API_ENV,
        STELLAR_HORIZON_URL: "not-a-valid-url",
      };

      expect(() => validateApiEnv(invalidEnv)).toThrow(EnvValidationError);
      try {
        validateApiEnv(invalidEnv);
      } catch (err) {
        const error = err as EnvValidationError;
        expect(error.message).toContain("STELLAR_HORIZON_URL");
      }
    });

    it("aggregates multiple errors into a single clear error message", () => {
      const invalidEnv = {
        ...VALID_API_ENV,
        STELLAR_ADMIN_PUBLIC_KEY: "BAD_KEY",
        STELLAR_HORIZON_URL: "BAD_URL",
      };
      delete (invalidEnv as Record<string, string | undefined>).DATABASE_URL;

      try {
        validateApiEnv(invalidEnv);
        expect(true).toBe(false);
      } catch (err) {
        const error = err as EnvValidationError;
        expect(error.issues.length).toBeGreaterThanOrEqual(3);
        expect(error.message).toContain("DATABASE_URL");
        expect(error.message).toContain("STELLAR_ADMIN_PUBLIC_KEY");
        expect(error.message).toContain("STELLAR_HORIZON_URL");
        expect(error.message).toContain("docs/ENV_SETUP.md");
      }
    });

    it("bypasses validation when SKIP_ENV_VALIDATION is set", () => {
      const invalidEnv = { SKIP_ENV_VALIDATION: "true" };
      expect(() => validateApiEnv(invalidEnv)).not.toThrow();
    });
  });

  describe("Webapp Environment Validation (validateWebappEnv)", () => {
    it("successfully validates a valid webapp environment", () => {
      const parsed = validateWebappEnv(VALID_WEBAPP_ENV);
      expect(parsed.NEXT_PUBLIC_API_URL).toBe(
        VALID_WEBAPP_ENV.NEXT_PUBLIC_API_URL,
      );
      expect(parsed.OPERATIONS_BACKEND_CREDENTIAL).toBe(
        VALID_WEBAPP_ENV.OPERATIONS_BACKEND_CREDENTIAL,
      );
    });

    it("fails fast when NEXT_PUBLIC_API_URL is missing or invalid", () => {
      const invalidEnv = {
        ...VALID_WEBAPP_ENV,
        NEXT_PUBLIC_API_URL: "invalid_url",
      };

      expect(() => validateWebappEnv(invalidEnv)).toThrow(EnvValidationError);
      try {
        validateWebappEnv(invalidEnv);
      } catch (err) {
        const error = err as EnvValidationError;
        expect(error.message).toContain("NEXT_PUBLIC_API_URL");
        expect(error.message).toContain("docs/ENV_SETUP.md");
      }
    });
  });
});
