import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the webapp e2e suite.
 *
 * Two test projects run here:
 *   chromium           - Evidence lifecycle and whitelist specs against a mocked Next.js
 *                        dev server. Every Soroban RPC and API call is intercepted and
 *                        fulfilled at the browser network layer via `page.route()`.
 *   visual-regression  - `toHaveScreenshot` over the static Storybook build, in both
 *                        light and dark themes. Baselines live in `e2e/snapshots/` and
 *                        are committed so unintended drift fails CI. Run standalone with:
 *                          bunx playwright test --project=visual-regression
 *
 * Seam for pointing the chromium suite at a real environment: set
 * `PLAYWRIGHT_BASE_URL` to a running deployment and `PLAYWRIGHT_SKIP_WEBSERVER=1`.
 * The specs would then need their `page.route()` mocks removed or made conditional.
 */

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Warms all pilot routes once before any spec runs; see the file for why.
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
      // Exclude visual-regression specs; they point at Storybook, not the app.
      testIgnore: ["**/visual-regression.spec.ts"],
    },
    {
      name: "visual-regression",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PLAYWRIGHT_STORYBOOK_URL ?? "http://localhost:6006",
      },
      testMatch: ["**/visual-regression.spec.ts"],
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
