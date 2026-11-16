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

/**
 * Browser origins the API accepts cross-origin requests from in development
 * when `CORS_ALLOWED_ORIGINS` is unset: the webapp (`next dev` on 3000) and
 * Akkuea Land (`next dev`, which takes 3002 under `bun run dev` because the
 * webapp holds 3000 and the API 3001).
 */
export const DEFAULT_DEV_CORS_ALLOWED_ORIGINS: readonly string[] = [
  "http://localhost:3000",
  "http://localhost:3002",
];

/**
 * True for an exact browser origin such as `https://app.example.com` or
 * `http://localhost:3000`: an `http` or `https` scheme, a host, and an optional
 * non-default port, written exactly as a browser sends it in the `Origin`
 * header. Paths, trailing slashes, query strings, credentials, wildcards, and
 * upper-case hosts are rejected.
 */
export const isExactOrigin = (val: string): boolean => {
  if (typeof val !== "string" || val.includes("*")) return false;
  try {
    const url = new URL(val);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === val
    );
  } catch {
    return false;
  }
};

/**
 * Splits a comma-separated origin list, trimming entries and dropping empty
 * ones. See docs/deployment/environment-variables.md.
 */
export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export const corsAllowedOriginsSchema = z
  .string()
  .optional()
  .transform(parseCorsAllowedOrigins)
  .superRefine((origins, ctx) => {
    const invalid = origins.filter((origin) => !isExactOrigin(origin));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `CORS_ALLOWED_ORIGINS must be a comma-separated list of exact origins (scheme, host, and optional port, such as https://app.example.com; no path, trailing slash, or wildcard). Invalid: ${invalid.join(", ")}`,
      });
    }
  });

/**
 * The origins the API should allow, given the parsed `CORS_ALLOWED_ORIGINS`
 * list and `NODE_ENV`. A configured list always wins. With no list,
 * development (also the default when `NODE_ENV` is unset) falls back to the
 * local frontends and every other environment allows no cross-origin requests.
 */
export function resolveCorsAllowedOrigins(
  configured: readonly string[],
  nodeEnv: string | undefined,
): string[] {
  if (configured.length > 0) return [...configured];
  if ((nodeEnv ?? "development") === "development") {
    return [...DEFAULT_DEV_CORS_ALLOWED_ORIGINS];
  }
  return [];
}

const PILOT_CYCLE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;

export const isPilotCycle = (val: string): boolean =>
  typeof val === "string" && PILOT_CYCLE_PATTERN.test(val);

export const isHttpsUrl = (val: string): boolean => {
  if (typeof val !== "string" || val.length === 0 || /\s/.test(val)) {
    return false;
  }
  try {
    const parsed = new URL(val);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
};

export const isIsoDateString = (val: string): boolean => {
  if (typeof val !== "string") return false;
  const match = ISO_DATE_PATTERN.exec(val);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return false;
  }

  return !Number.isNaN(Date.parse(val));
};

function normalizeOptionalString(val: string | undefined): string | undefined {
  if (val === undefined) return undefined;
  const trimmed = val.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalStellarPublicKeySchema(varName: string) {
  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine((val) => val === undefined || isStellarPublicKey(val), {
      message: `${varName} must be a valid Stellar public key (56 characters starting with G)`,
    });
}

function optionalStellarContractIdSchema(varName: string) {
  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine((val) => val === undefined || isStellarContractId(val), {
      message: `${varName} must be a valid Soroban contract ID (56 characters starting with C)`,
    });
}

function optionalHttpOrHttpsUrlSchema(varName: string) {
  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (/\s/.test(val)) return false;
        try {
          const parsed = new URL(val);
          return (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            parsed.hostname.length > 0
          );
        } catch {
          return false;
        }
      },
      {
        message: `${varName} must be a valid http:// or https:// URL`,
      },
    );
}

function optionalHttpsUrlSchema(varName: string) {
  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine((val) => val === undefined || isHttpsUrl(val), {
      message: `${varName} must be an absolute https:// URL`,
    });
}

function optionalIsoDateSchema(varName: string) {
  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine((val) => val === undefined || isIsoDateString(val), {
      message: `${varName} must be a valid ISO-8601 date (e.g. 2026-01-15 or 2026-01-15T00:00:00.000Z)`,
    });
}

function optionalPositiveNumberSchema(varName: string, defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((val) => {
      const normalized = normalizeOptionalString(val);
      return normalized === undefined ? defaultValue : Number(normalized);
    })
    .refine((val) => Number.isFinite(val) && val > 0, {
      message: `${varName} must be a positive number`,
    });
}

function optionalPositiveIntSchema(varName: string, defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((val) => {
      const normalized = normalizeOptionalString(val);
      if (normalized === undefined) return defaultValue;
      return /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
    })
    .refine((val) => Number.isSafeInteger(val) && val >= 1, {
      message: `${varName} must be a positive integer`,
    });
}

function optionalBoundedIntSchema(
  varName: string,
  min: number,
  max: number,
  defaultValue: number,
) {
  return z
    .string()
    .optional()
    .transform((val) => {
      const normalized = normalizeOptionalString(val);
      if (normalized === undefined) return defaultValue;
      return /^-?\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
    })
    .refine((val) => Number.isSafeInteger(val) && val >= min && val <= max, {
      message: `${varName} must be an integer between ${min} and ${max}`,
    });
}

function optionalBooleanDefaultSchema(varName: string, defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val, ctx): boolean => {
      if (val === undefined) return defaultValue;
      if (typeof val === "boolean") return val;
      const normalized = val.trim().toLowerCase();
      if (normalized === "") return defaultValue;
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${varName} must be "true", "false", "1", or "0"`,
      });
      return z.NEVER;
    });
}

export const pilotStartCycleSchema = z
  .string()
  .optional()
  .transform((val) => normalizeOptionalString(val) ?? "2026-01")
  .refine(isPilotCycle, {
    message:
      "NEXT_PUBLIC_PILOT_START_CYCLE must be in YYYY-MM format with month 01 to 12",
  });

export const pilotPaymentDaySchema = optionalBoundedIntSchema(
  "NEXT_PUBLIC_PILOT_PAYMENT_DAY",
  1,
  28,
  5,
);

export const pilotNetworkSchema = z
  .string()
  .optional()
  .transform((val) => (normalizeOptionalString(val) ?? "testnet").toLowerCase())
  .pipe(
    z.enum(["testnet", "mainnet", "public"], {
      errorMap: () => ({
        message:
          'NEXT_PUBLIC_STELLAR_NETWORK must be "testnet", "mainnet", or "public"',
      }),
    }),
  );

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
  CORS_ALLOWED_ORIGINS: corsAllowedOriginsSchema,
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
  PAYMENT_TOKEN_CONTRACT_ID: stellarContractIdSchema
    .optional()
    .or(z.literal("")),
  WHITELIST_CONTRACT_ID: optionalStellarContractIdSchema(
    "WHITELIST_CONTRACT_ID",
  ),
  PILOT_PAYOUT_SPLIT_CONTRACT_ID: optionalStellarContractIdSchema(
    "PILOT_PAYOUT_SPLIT_CONTRACT_ID",
  ),
  PILOT_ESCALATION_JOB_ENABLED: optionalBooleanDefaultSchema(
    "PILOT_ESCALATION_JOB_ENABLED",
    true,
  ),
  PILOT_ESCALATION_AGREEMENT_START: optionalIsoDateSchema(
    "PILOT_ESCALATION_AGREEMENT_START",
  ),
  PILOT_ESCALATION_OPERATOR_USER_ID: z
    .string()
    .optional()
    .transform(normalizeOptionalString),
  PILOT_ESCALATION_CADENCE_DAYS: optionalPositiveNumberSchema(
    "PILOT_ESCALATION_CADENCE_DAYS",
    30,
  ),
  PILOT_ESCALATION_THRESHOLD_CYCLES: optionalPositiveIntSchema(
    "PILOT_ESCALATION_THRESHOLD_CYCLES",
    2,
  ),
  PILOT_ESCALATION_POLL_INTERVAL_MS: optionalPositiveNumberSchema(
    "PILOT_ESCALATION_POLL_INTERVAL_MS",
    21_600_000,
  ),
  PILOT_ESCALATION_RENOTIFY_INTERVAL_MS: optionalPositiveNumberSchema(
    "PILOT_ESCALATION_RENOTIFY_INTERVAL_MS",
    604_800_000,
  ),
  PILOT_WHITELIST_REVIEW_SLA_HOURS: optionalPositiveNumberSchema(
    "PILOT_WHITELIST_REVIEW_SLA_HOURS",
    48,
  ),
  PILOT_EVIDENCE_REVIEW_SLA_HOURS: optionalPositiveNumberSchema(
    "PILOT_EVIDENCE_REVIEW_SLA_HOURS",
    48,
  ),
  PILOT_REVIEW_METRICS_WINDOW_DAYS: optionalPositiveNumberSchema(
    "PILOT_REVIEW_METRICS_WINDOW_DAYS",
    30,
  ),
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
  NEXT_PUBLIC_STELLAR_NETWORK: pilotNetworkSchema,
  NEXT_PUBLIC_SOROBAN_RPC_URL: optionalHttpOrHttpsUrlSchema(
    "NEXT_PUBLIC_SOROBAN_RPC_URL",
  ),
  NEXT_PUBLIC_PILOT_ALLY_ADDRESS: optionalStellarPublicKeySchema(
    "NEXT_PUBLIC_PILOT_ALLY_ADDRESS",
  ),
  NEXT_PUBLIC_PILOT_START_CYCLE: pilotStartCycleSchema,
  NEXT_PUBLIC_PILOT_PAYMENT_DAY: pilotPaymentDaySchema,
  NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL: optionalHttpsUrlSchema(
    "NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL",
  ),
  NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID: optionalStellarContractIdSchema(
    "NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID",
  ),
  NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID: optionalStellarContractIdSchema(
    "NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID",
  ),
  NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID: optionalStellarContractIdSchema(
    "NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID",
  ),
  NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS: optionalPositiveNumberSchema(
    "NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS",
    24,
  ),
  NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS: optionalBoundedIntSchema(
    "NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS",
    0,
    9_999,
    100,
  ),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebappEnv = z.infer<typeof webappEnvSchema>;
