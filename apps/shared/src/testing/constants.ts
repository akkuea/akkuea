/**
 * Shared test constants — canonical values to eliminate duplication across test suites.
 */

/** Valid Stellar public key (ed25519, G-prefix, base32) */
export const VALID_STELLAR_ADDRESS =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/** Secondary Stellar address for two-party tests */
export const VALID_STELLAR_ADDRESS_2 =
  "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON";

/** USDC issuer on Stellar testnet */
export const USDC_ISSUER_ADDRESS =
  "GA5ZSEJYBEOJ58MWPSPMXSVPZJVHIHAIPSZI7ZS2UXUJRZ4MZEGERUAU";

/** Deterministic UUID for primary test entities */
export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

/** UUID that should never exist in any store */
export const NON_EXISTENT_UUID = "00000000-0000-4000-a000-000000000000";

/** ISO-8601 timestamps for consistent date testing */
export const BASE_DATE = "2025-01-15T10:00:00.000Z";
export const UPDATED_DATE = "2025-06-20T14:30:00.000Z";

/** 64-char hex transaction hash */
export const VALID_TX_HASH =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
