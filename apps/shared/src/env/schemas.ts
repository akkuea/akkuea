import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

export const isStellarPublicKey = (val: string): boolean => {
  try {
    return (
      typeof val === "string" &&
      val.startsWith("G") &&
      val.length === 56 &&
      StrKey.isValidEd25519PublicKey(val)
    );
  } catch {
    return false;
  }
};

export const isStellarSecretSeed = (val: string): boolean => {
  try {
    return (
      typeof val === "string" &&
      val.startsWith("S") &&
      val.length === 56 &&
      StrKey.isValidEd25519SecretSeed(val)
    );
  } catch {
    return false;
  }
};

export const isStellarContractId = (val: string): boolean => {
  try {
    return (
      typeof val === "string" &&
      val.startsWith("C") &&
      val.length === 56 &&
      StrKey.isValidContract(val)
    );
  } catch {
    return false;
  }
};

export const stellarPublicKeySchema = z
  .string({ required_error: "Must be a valid Stellar public key (56 characters starting with G)" })
  .refine(isStellarPublicKey, {
    message: "Must be a valid Stellar public key (56 characters starting with G)",
  });

export const stellarSecretSeedSchema = z
  .string({ required_error: "Must be a valid Stellar secret seed (56 characters starting with S)" })
  .refine(isStellarSecretSeed, {
    message: "Must be a valid Stellar secret seed (56 characters starting with S)",
  });

export const stellarContractIdSchema = z
  .string({ required_error: "Must be a valid Soroban contract ID (56 characters starting with C)" })
  .refine(isStellarContractId, {
    message: "Must be a valid Soroban contract ID (56 characters starting with C)",
  });

export const urlSchema = z.string({ required_error: "Must be a valid URL" }).url({
  message: "Must be a valid URL (e.g. https://... or http://...)",
});

export const portSchema = z
  .string()
  .optional()
  .transform((val) => (val ? parseInt(val, 10) : 3001))
  .pipe(z.number().int().min(1).max(65535));

export const booleanSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
    return undefined;
  });

export const apiEnvSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  DATABASE_SSL: booleanSchema,
  PORT: portSchema,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  WEBHOOK_SECRET: z
    .string({ required_error: "WEBHOOK_SECRET is required" })
    .min(1, "WEBHOOK_SECRET is required"),
  OPERATIONS_BACKEND_CREDENTIAL: z
    .string({ required_error: "OPERATIONS_BACKEND_CREDENTIAL is required" })
    .min(1, "OPERATIONS_BACKEND_CREDENTIAL is required"),
  OPERATIONS_ALLOWED_WALLETS: z.string().optional(),
  LIQUIDATOR_API_KEY: z
    .string({ required_error: "LIQUIDATOR_API_KEY is required" })
    .min(1, "LIQUIDATOR_API_KEY is required"),
  INTERNAL_API_KEY: z
    .string({ required_error: "INTERNAL_API_KEY is required" })
    .min(1, "INTERNAL_API_KEY is required"),
  KYC_UPLOAD_DIR: z
    .string({ required_error: "KYC_UPLOAD_DIR is required" })
    .min(1, "KYC_UPLOAD_DIR is required"),
  KYC_EXPIRY_JOB_ENABLED: booleanSchema,
  KYC_EXPIRY_POLL_INTERVAL_MS: z.string().optional(),
  KYC_EXPIRY_REMINDER_WINDOW_MS: z.string().optional(),
  NOTIFICATIONS_ENABLED: booleanSchema,
  NOTIFICATION_WEBHOOK_URL: urlSchema.optional().or(z.literal("")),
  NOTIFICATION_WEBHOOK_SECRET: z.string().optional(),
  NOTIFICATION_POLL_INTERVAL_MS: z.string().optional(),
  NOTIFICATION_REQUEST_TIMEOUT_MS: z.string().optional(),
  REDIS_URL: urlSchema.optional().or(z.literal("")),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).optional().default("testnet"),
  STELLAR_HORIZON_URL: urlSchema,
  STELLAR_RPC_URL: urlSchema,
  STELLAR_NETWORK_PASSPHRASE: z
    .string({ required_error: "STELLAR_NETWORK_PASSPHRASE is required" })
    .min(1, "STELLAR_NETWORK_PASSPHRASE is required"),
  STELLAR_ADMIN_PUBLIC_KEY: stellarPublicKeySchema,
  STELLAR_ADMIN_SECRET: stellarSecretSeedSchema,
  REAL_ESTATE_TOKEN_CONTRACT_ID: stellarContractIdSchema.optional().or(z.literal("")),
  DEFI_RWA_CONTRACT_ID: stellarContractIdSchema.optional().or(z.literal("")),
});

export const webappEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: urlSchema,
  API_URL: urlSchema,
  OPERATIONS_BACKEND_CREDENTIAL: z
    .string({ required_error: "OPERATIONS_BACKEND_CREDENTIAL is required" })
    .min(1, "OPERATIONS_BACKEND_CREDENTIAL is required"),
  OPERATIONS_ALLOWED_WALLETS: z
    .string({ required_error: "OPERATIONS_ALLOWED_WALLETS is required" })
    .min(1, "OPERATIONS_ALLOWED_WALLETS is required"),
  NEXT_PUBLIC_LENDING_SSE_URL: urlSchema.optional().or(z.literal("")),
  NEXT_PUBLIC_USE_MOCK: booleanSchema,
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  NEXT_PUBLIC_POLLAR_KEY: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebappEnv = z.infer<typeof webappEnvSchema>;
