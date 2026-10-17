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
  .string({
    required_error:
      "Must be a valid Stellar public key (56 characters starting with G)",
  })
  .refine(isStellarPublicKey, {
    message:
      "Must be a valid Stellar public key (56 characters starting with G)",
  });

export const stellarSecretSeedSchema = z
  .string({
    required_error:
      "Must be a valid Stellar secret seed (56 characters starting with S)",
  })
  .refine(isStellarSecretSeed, {
    message:
      "Must be a valid Stellar secret seed (56 characters starting with S)",
  });

export const stellarContractIdSchema = z
  .string({
    required_error:
      "Must be a valid Soroban contract ID (56 characters starting with C)",
  })
  .refine(isStellarContractId, {
    message:
      "Must be a valid Soroban contract ID (56 characters starting with C)",
  });

export const urlSchema = z
  .string({ required_error: "Must be a valid URL" })
  .url({
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
    if (typeof val === "string")
      return val.toLowerCase() === "true" || val === "1";
    return undefined;
  });

/**
 * How many reverse proxies in front of the API are trusted to append to
 * `x-forwarded-for`. `0` (the default) means no proxy is trusted and the client
 * address is read from the socket only, so a client cannot choose its own
 * rate-limit identity. See docs/deployment/environment-variables.md.
 */
export const trustedProxyHopsSchema = z
  .string()
  .optional()
  .transform((val) =>
    val === undefined || val.trim() === "" ? 0 : Number(val),
  )
  .refine((val) => Number.isInteger(val) && val >= 0 && val <= 10, {
    message:
      "TRUSTED_PROXY_HOPS must be an integer between 0 (no trusted proxy) and 10",
  });

/**
 * Hosts `next/image` may load property images from when
 * `NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS` is unset or empty.
 */
export const DEFAULT_PROPERTY_IMAGE_HOSTS: readonly string[] = [
  "images.unsplash.com",
];

const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * True for a bare hostname such as `cdn.example.com`: dot-separated labels of
 * letters, digits, and inner hyphens, with no protocol, port, path, or spaces.
 * Validated label by label so the pattern stays linear-time.
 */
export const isBareHostname = (val: string): boolean =>
  typeof val === "string" &&
  val.length > 0 &&
  val.length <= 253 &&
  val
    .toLowerCase()
    .split(".")
    .every((label) => HOSTNAME_LABEL_PATTERN.test(label));

/**
 * Splits a comma-separated host list, trimming entries and dropping empty
 * ones. Falls back to `DEFAULT_PROPERTY_IMAGE_HOSTS` when nothing remains.
 * Shared by the env schema and `apps/webapp/next.config.ts` so both read the
 * variable identically. See docs/deployment/environment-variables.md.
 */
export function parsePropertyImageHosts(value: string | undefined): string[] {
  const hosts = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return hosts.length > 0 ? hosts : [...DEFAULT_PROPERTY_IMAGE_HOSTS];
}

export const propertyImageHostsSchema = z
  .string()
  .optional()
  .transform(parsePropertyImageHosts)
  .superRefine((hosts, ctx) => {
    const invalid = hosts.filter((host) => !isBareHostname(host));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS must be a comma-separated list of bare hostnames (no protocol, port, path, or spaces). Invalid: ${invalid.join(", ")}`,
      });
    }
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
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
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
  TRUSTED_PROXY_HOPS: trustedProxyHopsSchema,
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).optional().default("testnet"),
  STELLAR_HORIZON_URL: urlSchema,
  STELLAR_RPC_URL: urlSchema,
  STELLAR_NETWORK_PASSPHRASE: z
    .string({ required_error: "STELLAR_NETWORK_PASSPHRASE is required" })
    .min(1, "STELLAR_NETWORK_PASSPHRASE is required"),
  STELLAR_ADMIN_PUBLIC_KEY: stellarPublicKeySchema,
  STELLAR_ADMIN_SECRET: stellarSecretSeedSchema,
  REAL_ESTATE_TOKEN_CONTRACT_ID: stellarContractIdSchema
    .optional()
    .or(z.literal("")),
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
  NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS: propertyImageHostsSchema,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebappEnv = z.infer<typeof webappEnvSchema>;
