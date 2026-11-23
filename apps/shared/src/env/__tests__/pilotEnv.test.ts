import { describe, it, expect } from "bun:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  validateApiEnv,
  validateWebappEnv,
  EnvValidationError,
  PILOT_ENV_DEFAULTS,
  isIsoDate,
} from "../index";

const VALID_PUBLIC_KEY = Keypair.random().publicKey();
const VALID_SECRET_KEY = Keypair.random().secret();
const VALID_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32));
const OTHER_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 7));

/** Flips the last character so the StrKey checksum no longer matches. */
function breakChecksum(key: string): string {
  const last = key[key.length - 1];
  return key.slice(0, -1) + (last === "A" ? "B" : "A");
}

const BASE_API_ENV: Record<string, string | undefined> = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/akkuea_defi",
  WEBHOOK_SECRET: "0123456789abcdef0123456789abcdef",
  OPERATIONS_BACKEND_CREDENTIAL: "0123456789abcdef0123456789abcdef",
  LIQUIDATOR_API_KEY: "0123456789abcdef0123456789abcdef",
  INTERNAL_API_KEY: "0123456789abcdef0123456789abcdef",
  KYC_UPLOAD_DIR: "/tmp/akkuea-kyc",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  STELLAR_ADMIN_PUBLIC_KEY: VALID_PUBLIC_KEY,
  STELLAR_ADMIN_SECRET: VALID_SECRET_KEY,
};

const BASE_WEBAPP_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_API_URL: "http://localhost:3001",
  API_URL: "http://localhost:3001",
  OPERATIONS_BACKEND_CREDENTIAL: "0123456789abcdef0123456789abcdef",
  OPERATIONS_ALLOWED_WALLETS: "*",
};

type Validate = (env: Record<string, string | undefined>) => object;

const validateWebapp: Validate = (env) =>
  validateWebappEnv({ ...BASE_WEBAPP_ENV, ...env });
const validateApi: Validate = (env) =>
  validateApiEnv({ ...BASE_API_ENV, ...env });

/** Validates `env` and returns the issues it reports, failing if none. */
function issuesFor(
  validate: Validate,
  env: Record<string, string | undefined>,
): string[] {
  try {
    validate(env);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).issues;
  }
  throw new Error(`Expected validation to fail for ${JSON.stringify(env)}`);
}

/** Asserts `value` fails validation with an issue that names `name`. */
function expectRejected(validate: Validate, name: string, value: string): void {
  const issues = issuesFor(validate, { [name]: value });
  expect(issues).toHaveLength(1);
  expect(issues[0]).toStartWith(`${name}: ${name} must be `);
}

function parsedValue(
  validate: Validate,
  name: string,
  value: string | undefined,
): unknown {
  return (validate({ [name]: value }) as Record<string, unknown>)[name];
}

const WEBAPP_DEFAULTS: [string, unknown][] = [
  ["NEXT_PUBLIC_PILOT_ALLY_ADDRESS", undefined],
  ["NEXT_PUBLIC_PILOT_START_CYCLE", "2026-01"],
  ["NEXT_PUBLIC_PILOT_PAYMENT_DAY", 5],
  ["NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL", undefined],
  ["NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID", undefined],
  ["NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID", undefined],
  ["NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID", undefined],
  ["NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS", 24],
  ["NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS", 100],
];

const API_DEFAULTS: [string, unknown][] = [
  ["PILOT_ESCALATION_JOB_ENABLED", true],
  ["PILOT_ESCALATION_AGREEMENT_START", undefined],
  ["PILOT_ESCALATION_OPERATOR_USER_ID", undefined],
  ["PILOT_PAYMENT_DAY", 5],
  ["PILOT_ESCALATION_THRESHOLD_CYCLES", 2],
  ["PILOT_ESCALATION_POLL_INTERVAL_MS", 21_600_000],
  ["PILOT_ESCALATION_RENOTIFY_INTERVAL_MS", 604_800_000],
  ["PILOT_PAYOUT_SPLIT_CONTRACT_ID", undefined],
  ["WHITELIST_CONTRACT_ID", undefined],
  ["PILOT_WHITELIST_REVIEW_SLA_HOURS", 48],
  ["PILOT_EVIDENCE_REVIEW_SLA_HOURS", 48],
  ["PILOT_REVIEW_METRICS_WINDOW_DAYS", 30],
];

const UNSET_VALUES: [string, string | undefined][] = [
  ["unset", undefined],
  ["empty", ""],
  ["whitespace", "   "],
];

describe("Pilot environment settings", () => {
  describe("defaults", () => {
    it("exports the documented defaults", () => {
      const documented = Object.fromEntries(
        [...WEBAPP_DEFAULTS, ...API_DEFAULTS].filter(
          ([, value]) => value !== undefined,
        ),
      );
      expect({ ...PILOT_ENV_DEFAULTS }).toEqual(documented);
    });

    for (const [label, raw] of UNSET_VALUES) {
      it.each(WEBAPP_DEFAULTS)(
        `webapp: %s resolves to its default when ${label}`,
        (name, expected) => {
          expect(parsedValue(validateWebapp, name, raw)).toEqual(expected);
        },
      );

      it.each(API_DEFAULTS)(
        `api: %s resolves to its default when ${label}`,
        (name, expected) => {
          expect(parsedValue(validateApi, name, raw)).toEqual(expected);
        },
      );
    }
  });

  describe("valid values", () => {
    it.each([
      ["NEXT_PUBLIC_PILOT_ALLY_ADDRESS", VALID_PUBLIC_KEY, VALID_PUBLIC_KEY],
      [
        "NEXT_PUBLIC_PILOT_ALLY_ADDRESS",
        ` ${VALID_PUBLIC_KEY} `,
        VALID_PUBLIC_KEY,
      ],
      ["NEXT_PUBLIC_PILOT_START_CYCLE", " 2026-03 ", "2026-03"],
      ["NEXT_PUBLIC_PILOT_START_CYCLE", "2027-12", "2027-12"],
      ["NEXT_PUBLIC_PILOT_PAYMENT_DAY", "12", 12],
      ["NEXT_PUBLIC_PILOT_PAYMENT_DAY", "1", 1],
      ["NEXT_PUBLIC_PILOT_PAYMENT_DAY", "28", 28],
      [
        "NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL",
        "https://example.org/property.splat",
        "https://example.org/property.splat",
      ],
      [
        "NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID",
        VALID_CONTRACT_ID,
        VALID_CONTRACT_ID,
      ],
      [
        "NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID",
        OTHER_CONTRACT_ID,
        OTHER_CONTRACT_ID,
      ],
      [
        "NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID",
        VALID_CONTRACT_ID,
        VALID_CONTRACT_ID,
      ],
      ["NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS", "48", 48],
      ["NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS", "1.5", 1.5],
      ["NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS", "0", 0],
      ["NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS", "9999", 9999],
    ])("webapp: %s=%p parses to %p", (name, raw, expected) => {
      expect(parsedValue(validateWebapp, name, raw)).toEqual(expected);
    });

    it.each([
      ["PILOT_ESCALATION_JOB_ENABLED", "FALSE", false],
      ["PILOT_ESCALATION_JOB_ENABLED", "false", false],
      ["PILOT_ESCALATION_JOB_ENABLED", "True", true],
      ["PILOT_ESCALATION_AGREEMENT_START", "2026-01-15", "2026-01-15"],
      [
        "PILOT_ESCALATION_AGREEMENT_START",
        "2026-01-15T00:00:00.000Z",
        "2026-01-15T00:00:00.000Z",
      ],
      [
        "PILOT_ESCALATION_AGREEMENT_START",
        "2026-01-15T09:30:00-05:00",
        "2026-01-15T09:30:00-05:00",
      ],
      ["PILOT_ESCALATION_AGREEMENT_START", "2028-02-29", "2028-02-29"],
      [
        "PILOT_ESCALATION_OPERATOR_USER_ID",
        "3F2B8C1E-5D4A-4C7B-9E1F-0A2B3C4D5E6F",
        "3F2B8C1E-5D4A-4C7B-9E1F-0A2B3C4D5E6F",
      ],
      [
        "PILOT_ESCALATION_OPERATOR_USER_ID",
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000000",
      ],
      ["PILOT_PAYMENT_DAY", "1", 1],
      ["PILOT_PAYMENT_DAY", "28", 28],
      ["PILOT_ESCALATION_THRESHOLD_CYCLES", "3", 3],
      ["PILOT_ESCALATION_POLL_INTERVAL_MS", "60000", 60_000],
      ["PILOT_ESCALATION_POLL_INTERVAL_MS", "2147483647", 2_147_483_647],
      ["PILOT_ESCALATION_RENOTIFY_INTERVAL_MS", "86400000", 86_400_000],
      ["PILOT_PAYOUT_SPLIT_CONTRACT_ID", VALID_CONTRACT_ID, VALID_CONTRACT_ID],
      ["WHITELIST_CONTRACT_ID", ` ${OTHER_CONTRACT_ID} `, OTHER_CONTRACT_ID],
      ["PILOT_WHITELIST_REVIEW_SLA_HOURS", "72", 72],
      ["PILOT_EVIDENCE_REVIEW_SLA_HOURS", "0.5", 0.5],
      ["PILOT_REVIEW_METRICS_WINDOW_DAYS", "7", 7],
    ])("api: %s=%p parses to %p", (name, raw, expected) => {
      expect(parsedValue(validateApi, name, raw)).toEqual(expected);
    });
  });

  describe("invalid webapp values", () => {
    it.each([
      ["wrong prefix", VALID_SECRET_KEY],
      ["bad checksum", breakChecksum(VALID_PUBLIC_KEY)],
      ["a contract ID", VALID_CONTRACT_ID],
      ["a short value", "GABC123"],
    ])("rejects an ally address that is %s", (_label, value) => {
      expectRejected(validateWebapp, "NEXT_PUBLIC_PILOT_ALLY_ADDRESS", value);
    });

    it("names the expected format for the ally address", () => {
      const [issue] = issuesFor(validateWebapp, {
        NEXT_PUBLIC_PILOT_ALLY_ADDRESS: "GABC123",
      });
      expect(issue).toContain(
        "NEXT_PUBLIC_PILOT_ALLY_ADDRESS must be a valid Stellar public key, 56 characters starting with G",
      );
    });

    it.each(["2026-1", "2026-13", "2026-00", "26-01", "2026/01", "2026-01-15"])(
      "rejects start cycle %p",
      (value) => {
        expectRejected(validateWebapp, "NEXT_PUBLIC_PILOT_START_CYCLE", value);
      },
    );

    it("reports the start cycle format and the received value", () => {
      expect(
        issuesFor(validateWebapp, { NEXT_PUBLIC_PILOT_START_CYCLE: "2026-1" }),
      ).toEqual([
        'NEXT_PUBLIC_PILOT_START_CYCLE: NEXT_PUBLIC_PILOT_START_CYCLE must be a month in YYYY-MM format, such as 2026-01 (got "2026-1")',
      ]);
    });

    it.each(["0", "29", "31", "5junk", "5.5", "5.0", "-1", "0x10", "1e1"])(
      "rejects payment day %p",
      (value) => {
        expectRejected(validateWebapp, "NEXT_PUBLIC_PILOT_PAYMENT_DAY", value);
      },
    );

    it("reports the payment day range instead of falling back to 5", () => {
      expect(
        issuesFor(validateWebapp, { NEXT_PUBLIC_PILOT_PAYMENT_DAY: "31" }),
      ).toEqual([
        'NEXT_PUBLIC_PILOT_PAYMENT_DAY: NEXT_PUBLIC_PILOT_PAYMENT_DAY must be a whole number from 1 to 28 (got "31")',
      ]);
    });

    const webappContractIds = [
      "NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID",
      "NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID",
      "NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID",
    ];
    const badContractIds: [string, string][] = [
      ["a G public key", VALID_PUBLIC_KEY],
      ["a bad checksum", breakChecksum(VALID_CONTRACT_ID)],
      ["a placeholder", "C..."],
      ["a short value", "COVERRIDE"],
    ];
    for (const name of webappContractIds) {
      it.each(badContractIds)(`rejects ${name} set to %s`, (_label, value) => {
        expectRejected(validateWebapp, name, value);
      });
    }

    it.each([
      ["an http URL", "http://example.org/property.splat"],
      ["a malformed URL", "not a url"],
      ["a bare host", "example.org/property.splat"],
    ])("rejects a splat URL that is %s", (_label, value) => {
      expectRejected(
        validateWebapp,
        "NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL",
        value,
      );
    });

    it.each(["0", "-1", "abc", "24h", "Infinity", "1e3", "0x10"])(
      "rejects co-sign expiry hours %p",
      (value) => {
        expectRejected(
          validateWebapp,
          "NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS",
          value,
        );
      },
    );

    it.each(["10000", "-1", "1.5", "abc", "100bps"])(
      "rejects EURC slippage %p",
      (value) => {
        expectRejected(
          validateWebapp,
          "NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS",
          value,
        );
      },
    );
  });

  describe("invalid api values", () => {
    it.each(["yes", "0", "1", "no", "enabled"])(
      "rejects job flag %p",
      (value) => {
        expectRejected(validateApi, "PILOT_ESCALATION_JOB_ENABLED", value);
      },
    );

    it.each([
      "2026-02-30",
      "2026-13-01",
      "15/01/2026",
      "not-a-date",
      "2026-01-15T00:00:00",
      "2026-01-15T25:00:00Z",
      "2026-1-15",
    ])("rejects agreement start %p", (value) => {
      expectRejected(validateApi, "PILOT_ESCALATION_AGREEMENT_START", value);
    });

    it.each([
      "b3f1",
      "not-a-uuid",
      "3f2b8c1e5d4a4c7b9e1f0a2b3c4d5e6f",
      "3f2b8c1e-5d4a-4c7b-9e1f-0a2b3c4d5e6g",
    ])("rejects operator user ID %p", (value) => {
      expectRejected(validateApi, "PILOT_ESCALATION_OPERATOR_USER_ID", value);
    });

    const positiveNumbers = [
      "PILOT_WHITELIST_REVIEW_SLA_HOURS",
      "PILOT_EVIDENCE_REVIEW_SLA_HOURS",
      "PILOT_REVIEW_METRICS_WINDOW_DAYS",
    ];
    for (const name of positiveNumbers) {
      it.each(["0", "0.0", "-5", "abc", "30days", "Infinity", "1e3"])(
        `rejects ${name}=%p`,
        (value) => {
          expectRejected(validateApi, name, value);
        },
      );
    }

    const positiveWholeNumbers = [
      "PILOT_PAYMENT_DAY",
      "PILOT_ESCALATION_THRESHOLD_CYCLES",
      "PILOT_ESCALATION_POLL_INTERVAL_MS",
      "PILOT_ESCALATION_RENOTIFY_INTERVAL_MS",
    ];
    for (const name of positiveWholeNumbers) {
      it.each(["0", "-1", "2.5", "abc", "2x", "0x10", "1e3"])(
        `rejects ${name}=%p`,
        (value) => {
          expectRejected(validateApi, name, value);
        },
      );
    }

    it("rejects a payment day above 28", () => {
      expectRejected(validateApi, "PILOT_PAYMENT_DAY", "29");
    });

    it("rejects a poll interval too large for a timer instead of letting it overflow", () => {
      expect(
        issuesFor(validateApi, {
          PILOT_ESCALATION_POLL_INTERVAL_MS: "2592000000",
        }),
      ).toEqual([
        'PILOT_ESCALATION_POLL_INTERVAL_MS: PILOT_ESCALATION_POLL_INTERVAL_MS must be a whole number from 1 to 2147483647 (got "2592000000")',
      ]);
    });

    for (const name of [
      "PILOT_PAYOUT_SPLIT_CONTRACT_ID",
      "WHITELIST_CONTRACT_ID",
    ]) {
      it.each([
        ["a G public key", VALID_PUBLIC_KEY],
        ["a bad checksum", breakChecksum(VALID_CONTRACT_ID)],
        ["a placeholder", "C..."],
      ])(`rejects ${name} set to %s`, (_label, value) => {
        expectRejected(validateApi, name, value);
      });
    }
  });

  describe("several invalid values", () => {
    it("reports one issue per webapp variable", () => {
      const issues = issuesFor(validateWebapp, {
        NEXT_PUBLIC_PILOT_ALLY_ADDRESS: VALID_CONTRACT_ID,
        NEXT_PUBLIC_PILOT_START_CYCLE: "2026-13",
        NEXT_PUBLIC_PILOT_PAYMENT_DAY: "31",
        NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID: VALID_PUBLIC_KEY,
        NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS: "10000",
      });
      expect(issues.map((issue) => issue.split(":")[0]).sort()).toEqual([
        "NEXT_PUBLIC_PILOT_ALLY_ADDRESS",
        "NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS",
        "NEXT_PUBLIC_PILOT_PAYMENT_DAY",
        "NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID",
        "NEXT_PUBLIC_PILOT_START_CYCLE",
      ]);
    });

    it("reports one issue per api variable", () => {
      const issues = issuesFor(validateApi, {
        PILOT_ESCALATION_JOB_ENABLED: "yes",
        PILOT_ESCALATION_AGREEMENT_START: "2026-02-30",
        PILOT_ESCALATION_OPERATOR_USER_ID: "operator",
        PILOT_ESCALATION_THRESHOLD_CYCLES: "0",
        WHITELIST_CONTRACT_ID: "C...",
      });
      expect(issues.map((issue) => issue.split(":")[0]).sort()).toEqual([
        "PILOT_ESCALATION_AGREEMENT_START",
        "PILOT_ESCALATION_JOB_ENABLED",
        "PILOT_ESCALATION_OPERATOR_USER_ID",
        "PILOT_ESCALATION_THRESHOLD_CYCLES",
        "WHITELIST_CONTRACT_ID",
      ]);
    });

    it("includes every failing variable in the error message", () => {
      try {
        validateWebapp({
          NEXT_PUBLIC_PILOT_PAYMENT_DAY: "29",
          NEXT_PUBLIC_PILOT_START_CYCLE: "2026/01",
        });
        throw new Error("Expected validation to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(EnvValidationError);
        const { message } = error as EnvValidationError;
        expect(message).toContain("NEXT_PUBLIC_PILOT_PAYMENT_DAY");
        expect(message).toContain("NEXT_PUBLIC_PILOT_START_CYCLE");
      }
    });
  });

  describe("isIsoDate", () => {
    it.each([
      ["2026-01-15", true],
      ["2026-01-15T00:00Z", true],
      ["2026-01-15T00:00:00.000+02:00", true],
      ["2027-02-29", false],
      ["2026-04-31", false],
      ["2026-01-15T00:00:00+24:00", false],
      ["2026-01-15T00:60:00Z", false],
    ])("isIsoDate(%p) is %p", (value, expected) => {
      expect(isIsoDate(value)).toBe(expected);
    });
  });
});
