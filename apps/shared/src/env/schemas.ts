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
    error: "Must be a valid Stellar public key (56 characters starting with G)",
  })
  .refine(isStellarPublicKey, {
    message:
      "Must be a valid Stellar public key (56 characters starting with G)",
  });

export const stellarSecretSeedSchema = z
  .string({
    error:
      "Must be a valid Stellar secret seed (56 characters starting with S)",
  })
  .refine(isStellarSecretSeed, {
    message:
      "Must be a valid Stellar secret seed (56 characters starting with S)",
  });

export const stellarContractIdSchema = z
  .string({
    error:
      "Must be a valid Soroban contract ID (56 characters starting with C)",
  })
  .refine(isStellarContractId, {
    message:
      "Must be a valid Soroban contract ID (56 characters starting with C)",
  });

export const urlSchema = z.url({
  error: (issue) =>
    issue.input === undefined
      ? "Must be a valid URL"
      : "Must be a valid URL (e.g. https://... or http://...)",
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
        code: "custom",
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
        code: "custom",
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

// ---------------------------------------------------------------------------
// Pilot settings
//
// Configuration for the single-ally pilot (docs/strategy/product-brief.md),
// read by the pilot dashboard in apps/webapp and by the pilot jobs and routes
// in apps/api. Every variable is optional. An unset, empty, or whitespace-only
// value resolves to its default in `PILOT_ENV_DEFAULTS` (or to `undefined` when
// it has none), so the empty assignments shipped in the `.env.example` files
// are valid. A value that is set but malformed fails validation with a message
// naming the variable, instead of being silently replaced by the default at
// its read site. See docs/deployment/environment-variables.md.
// ---------------------------------------------------------------------------

/**
 * Defaults applied when an optional pilot variable is unset or empty. The
 * single source of truth for these values; the read sites in apps/webapp and
 * apps/api apply the same numbers. Pilot variables with no entry here (the ally
 * address, contract ID overrides, splat URL, agreement start, and operator user
 * ID) have no default and resolve to `undefined` when unset. See
 * docs/deployment/environment-variables.md.
 */
export const PILOT_ENV_DEFAULTS = {
  NEXT_PUBLIC_PILOT_START_CYCLE: "2026-01",
  NEXT_PUBLIC_PILOT_PAYMENT_DAY: 5,
  NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS: 24,
  NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS: 100,
  PILOT_ESCALATION_JOB_ENABLED: true,
  PILOT_PAYMENT_DAY: 5,
  PILOT_ESCALATION_THRESHOLD_CYCLES: 2,
  /** 6 hours. */
  PILOT_ESCALATION_POLL_INTERVAL_MS: 21_600_000,
  /** 7 days. */
  PILOT_ESCALATION_RENOTIFY_INTERVAL_MS: 604_800_000,
  PILOT_WHITELIST_REVIEW_SLA_HOURS: 48,
  PILOT_EVIDENCE_REVIEW_SLA_HOURS: 48,
  PILOT_REVIEW_METRICS_WINDOW_DAYS: 30,
} as const;

/**
 * Builds the schema for one optional pilot variable. The raw value is trimmed;
 * an unset or blank value resolves to `fallback`. Otherwise `parse` converts
 * it, and a result of `undefined` means the value is malformed, which is
 * reported as `<name> must be <expected> (got "<value>")`.
 */
function pilotSetting<T, D extends T | undefined>(
  name: string,
  expected: string,
  parse: (value: string) => T | undefined,
  fallback: D,
) {
  return z
    .string()
    .optional()
    .transform((raw, ctx): T | D => {
      const value = raw?.trim();
      if (!value) return fallback;
      const parsed = parse(value);
      if (parsed === undefined) {
        ctx.addIssue({
          code: "custom",
          message: `${name} must be ${expected} (got "${value}")`,
          input: raw,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

const WHOLE_NUMBER_PATTERN = /^\d+$/;
const POSITIVE_DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
const CYCLE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-](\d{2}):(\d{2})))?$/;

/**
 * Largest delay, in milliseconds, that `setInterval` accepts (2^31 - 1, about
 * 24.8 days). A larger delay overflows and the runtime fires the timer every
 * millisecond instead, so the escalation job's poll interval is capped here.
 */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Parses a whole number written only with digits, within `[min, max]`. */
const parseWholeNumber =
  (min: number, max: number) =>
  (value: string): number | undefined => {
    if (!WHOLE_NUMBER_PATTERN.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
      ? parsed
      : undefined;
  };

/**
 * True for a real calendar date in ISO 8601 form: `YYYY-MM-DD`, or a date-time
 * with an explicit `Z` or `+HH:MM` / `-HH:MM` offset, such as
 * `2026-01-15T00:00:00.000Z`. Rejects impossible dates such as `2026-02-30`.
 */
export const isIsoDate = (val: string): boolean => {
  const match = ISO_DATE_PATTERN.exec(val);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMin] =
    match;
  const calendar = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const isRealDate =
    calendar.getUTCFullYear() === Number(year) &&
    calendar.getUTCMonth() === Number(month) - 1 &&
    calendar.getUTCDate() === Number(day);
  const isRealTime =
    hour === undefined ||
    (Number(hour) <= 23 &&
      Number(minute) <= 59 &&
      Number(second ?? 0) <= 59 &&
      Number(offsetHour ?? 0) <= 23 &&
      Number(offsetMin ?? 0) <= 59);
  return isRealDate && isRealTime && !Number.isNaN(new Date(val).getTime());
};

const isHttpsUrl = (val: string): boolean => {
  try {
    const url = new URL(val);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
};

/**
 * Optional Stellar account address (`G...`), validated with its StrKey
 * checksum. Used for `NEXT_PUBLIC_PILOT_ALLY_ADDRESS`.
 */
export const pilotStellarAddressSchema = (name: string) =>
  pilotSetting(
    name,
    "a valid Stellar public key, 56 characters starting with G",
    (value) => (isStellarPublicKey(value) ? value : undefined),
    undefined,
  );

/**
 * Optional Soroban contract ID (`C...`), validated with its StrKey checksum.
 * Unset means the read site falls back to the committed deployment artifact.
 */
export const pilotContractIdSchema = (name: string) =>
  pilotSetting(
    name,
    "a valid Soroban contract ID, 56 characters starting with C",
    (value) => (isStellarContractId(value) ? value : undefined),
    undefined,
  );

/** Optional month in `YYYY-MM` form, month `01` to `12`. */
export const pilotCycleSchema = (name: string, fallback: string) =>
  pilotSetting(
    name,
    "a month in YYYY-MM format, such as 2026-01",
    (value) => (CYCLE_PATTERN.test(value) ? value : undefined),
    fallback,
  );

/**
 * Optional whole number from `min` to `max`. Only digits are accepted, so
 * `5.0`, `5junk`, `-1`, `0x10`, and `1e3` are rejected rather than coerced.
 * Without `max`, the message reads "a positive whole number" when `min` is 1.
 */
export const pilotWholeNumberSchema = (
  name: string,
  options: { min: number; max?: number; fallback: number },
) => {
  const { min, max = Number.MAX_SAFE_INTEGER, fallback } = options;
  const expected =
    options.max !== undefined
      ? `a whole number from ${min} to ${max}`
      : min === 1
        ? "a positive whole number"
        : `a whole number of at least ${min}`;
  return pilotSetting(name, expected, parseWholeNumber(min, max), fallback);
};

/**
 * Optional number greater than zero, written with digits and an optional
 * decimal part (such as `24` or `1.5`). Rejects `0`, signs, exponents, and
 * `Infinity`.
 */
export const pilotPositiveNumberSchema = (name: string, fallback: number) =>
  pilotSetting(
    name,
    "a positive number, such as 24 or 1.5",
    (value) => {
      if (!POSITIVE_DECIMAL_PATTERN.test(value)) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    },
    fallback,
  );

/** Optional `true` or `false`, case-insensitive. */
export const pilotFlagSchema = (name: string, fallback: boolean) =>
  pilotSetting(
    name,
    "true or false",
    (value) => {
      const lowered = value.toLowerCase();
      if (lowered === "true") return true;
      if (lowered === "false") return false;
      return undefined;
    },
    fallback,
  );

/** Optional `https` URL. */
export const pilotHttpsUrlSchema = (name: string) =>
  pilotSetting(
    name,
    "an https URL, such as https://example.org/property.splat",
    (value) => (isHttpsUrl(value) ? value : undefined),
    undefined,
  );

/** Optional ISO 8601 date or date-time; see {@link isIsoDate}. */
export const pilotIsoDateSchema = (name: string) =>
  pilotSetting(
    name,
    "an ISO 8601 date such as 2026-01-15, or a date-time with Z or an offset such as 2026-01-15T00:00:00.000Z",
    (value) => (isIsoDate(value) ? value : undefined),
    undefined,
  );

/** Optional UUID in canonical `8-4-4-4-12` hexadecimal form. */
export const pilotUuidSchema = (name: string) =>
  pilotSetting(
    name,
    "a user UUID, such as 3f2b8c1e-5d4a-4c7b-9e1f-0a2b3c4d5e6f",
    (value) => (UUID_PATTERN.test(value) ? value : undefined),
    undefined,
  );

export const apiEnvSchema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
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
    .string({ error: "WEBHOOK_SECRET is required" })
    .min(1, "WEBHOOK_SECRET is required"),
  OPERATIONS_BACKEND_CREDENTIAL: z
    .string({ error: "OPERATIONS_BACKEND_CREDENTIAL is required" })
    .min(1, "OPERATIONS_BACKEND_CREDENTIAL is required"),
  OPERATIONS_ALLOWED_WALLETS: z.string().optional(),
  LIQUIDATOR_API_KEY: z
    .string({ error: "LIQUIDATOR_API_KEY is required" })
    .min(1, "LIQUIDATOR_API_KEY is required"),
  INTERNAL_API_KEY: z
    .string({ error: "INTERNAL_API_KEY is required" })
    .min(1, "INTERNAL_API_KEY is required"),
  KYC_UPLOAD_DIR: z
    .string({ error: "KYC_UPLOAD_DIR is required" })
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
    .string({ error: "STELLAR_NETWORK_PASSPHRASE is required" })
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
  // Pilot settings (all optional; see the "Pilot settings" section above).
  PILOT_ESCALATION_JOB_ENABLED: pilotFlagSchema(
    "PILOT_ESCALATION_JOB_ENABLED",
    PILOT_ENV_DEFAULTS.PILOT_ESCALATION_JOB_ENABLED,
  ),
  PILOT_ESCALATION_AGREEMENT_START: pilotIsoDateSchema(
    "PILOT_ESCALATION_AGREEMENT_START",
  ),
  PILOT_ESCALATION_OPERATOR_USER_ID: pilotUuidSchema(
    "PILOT_ESCALATION_OPERATOR_USER_ID",
  ),
  PILOT_PAYMENT_DAY: pilotWholeNumberSchema("PILOT_PAYMENT_DAY", {
    min: 1,
    max: 28,
    fallback: PILOT_ENV_DEFAULTS.PILOT_PAYMENT_DAY,
  }),
  PILOT_ESCALATION_THRESHOLD_CYCLES: pilotWholeNumberSchema(
    "PILOT_ESCALATION_THRESHOLD_CYCLES",
    {
      min: 1,
      fallback: PILOT_ENV_DEFAULTS.PILOT_ESCALATION_THRESHOLD_CYCLES,
    },
  ),
  PILOT_ESCALATION_POLL_INTERVAL_MS: pilotWholeNumberSchema(
    "PILOT_ESCALATION_POLL_INTERVAL_MS",
    {
      min: 1,
      max: MAX_TIMER_DELAY_MS,
      fallback: PILOT_ENV_DEFAULTS.PILOT_ESCALATION_POLL_INTERVAL_MS,
    },
  ),
  PILOT_ESCALATION_RENOTIFY_INTERVAL_MS: pilotWholeNumberSchema(
    "PILOT_ESCALATION_RENOTIFY_INTERVAL_MS",
    {
      min: 1,
      fallback: PILOT_ENV_DEFAULTS.PILOT_ESCALATION_RENOTIFY_INTERVAL_MS,
    },
  ),
  PILOT_PAYOUT_SPLIT_CONTRACT_ID: pilotContractIdSchema(
    "PILOT_PAYOUT_SPLIT_CONTRACT_ID",
  ),
  WHITELIST_CONTRACT_ID: pilotContractIdSchema("WHITELIST_CONTRACT_ID"),
  PILOT_WHITELIST_REVIEW_SLA_HOURS: pilotPositiveNumberSchema(
    "PILOT_WHITELIST_REVIEW_SLA_HOURS",
    PILOT_ENV_DEFAULTS.PILOT_WHITELIST_REVIEW_SLA_HOURS,
  ),
  PILOT_EVIDENCE_REVIEW_SLA_HOURS: pilotPositiveNumberSchema(
    "PILOT_EVIDENCE_REVIEW_SLA_HOURS",
    PILOT_ENV_DEFAULTS.PILOT_EVIDENCE_REVIEW_SLA_HOURS,
  ),
  PILOT_REVIEW_METRICS_WINDOW_DAYS: pilotPositiveNumberSchema(
    "PILOT_REVIEW_METRICS_WINDOW_DAYS",
    PILOT_ENV_DEFAULTS.PILOT_REVIEW_METRICS_WINDOW_DAYS,
  ),
});

export const webappEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: urlSchema,
  API_URL: urlSchema,
  OPERATIONS_BACKEND_CREDENTIAL: z
    .string({ error: "OPERATIONS_BACKEND_CREDENTIAL is required" })
    .min(1, "OPERATIONS_BACKEND_CREDENTIAL is required"),
  OPERATIONS_ALLOWED_WALLETS: z
    .string({ error: "OPERATIONS_ALLOWED_WALLETS is required" })
    .min(1, "OPERATIONS_ALLOWED_WALLETS is required"),
  NEXT_PUBLIC_LENDING_SSE_URL: urlSchema.optional().or(z.literal("")),
  NEXT_PUBLIC_USE_MOCK: booleanSchema,
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  NEXT_PUBLIC_POLLAR_KEY: z.string().optional(),
  NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS: propertyImageHostsSchema,
  // Pilot dashboard settings (all optional; see the "Pilot settings" section
  // above).
  NEXT_PUBLIC_PILOT_ALLY_ADDRESS: pilotStellarAddressSchema(
    "NEXT_PUBLIC_PILOT_ALLY_ADDRESS",
  ),
  NEXT_PUBLIC_PILOT_START_CYCLE: pilotCycleSchema(
    "NEXT_PUBLIC_PILOT_START_CYCLE",
    PILOT_ENV_DEFAULTS.NEXT_PUBLIC_PILOT_START_CYCLE,
  ),
  NEXT_PUBLIC_PILOT_PAYMENT_DAY: pilotWholeNumberSchema(
    "NEXT_PUBLIC_PILOT_PAYMENT_DAY",
    {
      min: 1,
      max: 28,
      fallback: PILOT_ENV_DEFAULTS.NEXT_PUBLIC_PILOT_PAYMENT_DAY,
    },
  ),
  NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL: pilotHttpsUrlSchema(
    "NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL",
  ),
  NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID: pilotContractIdSchema(
    "NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID",
  ),
  NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID: pilotContractIdSchema(
    "NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID",
  ),
  NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID: pilotContractIdSchema(
    "NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID",
  ),
  NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS: pilotPositiveNumberSchema(
    "NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS",
    PILOT_ENV_DEFAULTS.NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS,
  ),
  NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS: pilotWholeNumberSchema(
    "NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS",
    {
      min: 0,
      max: 9999,
      fallback: PILOT_ENV_DEFAULTS.NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS,
    },
  ),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebappEnv = z.infer<typeof webappEnvSchema>;
