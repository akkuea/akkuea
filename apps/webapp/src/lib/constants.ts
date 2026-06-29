export const TIMEOUTS = {
  /** Max time to wait for 3D model fetch before aborting */
  FETCH_ABORT_MS: 120_000,
  /** How often to poll Soroban RPC for lending pool updates */
  LENDING_POLL_MS: 30_000,
  /** Auth retry debounce */
  AUTH_RETRY_DELAY_MS: 300,
  /** Auth token refresh timeout */
  AUTH_REFRESH_MS: 30_000,
} as const;
