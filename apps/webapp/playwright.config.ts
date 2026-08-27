import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the pilot whitelist onboarding/review e2e suite.
 *
 * This suite is deliberately isolated from `bun test` (unit tests): it lives in
 * `e2e/`, runs against a real Next.js dev server, and mocks every whitelist API
 * call at the browser network layer via `page.route()` (see `e2e/mocks`). No
 * backend process or testnet transaction is required to run it.
 *
 * Seam for pointing this suite at a real environment later: set
 * `PLAYWRIGHT_BASE_URL` to a running deployment and `PLAYWRIGHT_SKIP_WEBSERVER=1`
 * so Playwright reuses it instead of booting a local dev server. The specs
 * would then need their `page.route()` mocks removed or made conditional; that
 * change is intentionally left for whoever takes on that later, real-environment
 * pass, this suite's job is the fast, deterministic mocked path.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Warms both pilot routes once before any spec runs; see the file for why.
  globalSetup: require.resolve("./e2e/global-setup"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],
  // Generous relative to a typical unit test: the onboarding "error" spec
  // waits out apiClient's built-in retry/backoff on a mocked 5xx response.
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        // Runs against webpack rather than the default Turbopack dev server:
        // Turbopack's on-demand compilation of the next-intl plugin config
        // currently 500s on every locale-prefixed route under Next 16 (see
        // `dev:e2e` in package.json). This only affects this throwaway e2e
        // dev server, not `bun run dev` or the production `bun run build`
        // used elsewhere, neither of which hit that code path.
        command: "bun run dev:e2e",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          PORT,
          // Real values are irrelevant: every request the app makes to these
          // hosts is intercepted and fulfilled by e2e/mocks, no server ever
          // needs to be reachable at these URLs.
          NEXT_PUBLIC_API_URL: "http://localhost:3101",
          API_URL: "http://localhost:3101",
          OPERATIONS_BACKEND_CREDENTIAL: "e2e-test-credential",
          OPERATIONS_ALLOWED_WALLETS: "*",
          NEXT_PUBLIC_USE_MOCK: "false",
          SKIP_ENV_VALIDATION: "true",
        },
      },
});
