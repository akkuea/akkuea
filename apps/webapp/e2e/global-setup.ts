import type { FullConfig } from "@playwright/test";

/**
 * Warms both pilot routes before any spec runs.
 *
 * The e2e web server runs Next's webpack dev server (see `dev:e2e` in
 * package.json), which compiles each route lazily on its first request. That
 * first compile can take far longer than a normal per-test timeout, so
 * without a warm-up the first test to touch a given route flakes on
 * `page.goto` while later tests against the same route pass instantly.
 * Hitting each route once here, before Playwright's per-test clock starts,
 * keeps every actual test fast and deterministic regardless of run order.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;

  const routes = ["/en/pilot/onboarding", "/en/pilot/review/whitelist"];
  const deadline = Date.now() + 90_000;

  for (const route of routes) {
    for (;;) {
      try {
        const res = await fetch(new URL(route, baseURL));
        if (res.ok) break;
      } catch {
        // Server may not be accepting connections yet; keep retrying.
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out warming up route ${route} for e2e tests`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
