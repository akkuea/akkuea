import { describe, expect, test, beforeEach, afterEach } from "bun:test";

// Ensure env validation does not block test runner
process.env.SKIP_ENV_VALIDATION = "true";

const { getSecurityHeaders, nextConfig } = await import("../../../next.config");

describe("Security Headers & CSP", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, SKIP_ENV_VALIDATION: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("next.config headers() returns configured route headers", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) return;

    const routes = await nextConfig.headers();
    expect(routes.length).toBeGreaterThan(0);

    const catchAllRoute = routes.find((r) => r.source === "/:path*");
    expect(catchAllRoute).toBeDefined();

    const headers = catchAllRoute?.headers ?? [];
    const headerKeys = headers.map((h) => h.key);

    expect(headerKeys).toContain("X-Content-Type-Options");
    expect(headerKeys).toContain("Referrer-Policy");
    expect(headerKeys).toContain("Permissions-Policy");
    expect(headerKeys).toContain("Content-Security-Policy");
  });

  test("enforces strict CSP with frame-ancestors none and object-src none", () => {
    const headers = getSecurityHeaders();
    const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("https://*.privy.io");
  });

  test("dynamically includes API and network RPC endpoints in connect-src", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.custom-domain.com";
    process.env.STELLAR_RPC_URL = "https://custom-soroban-rpc.org";

    const headers = getSecurityHeaders();
    const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("https://api.custom-domain.com");
    expect(csp).toContain("https://custom-soroban-rpc.org");
    expect(csp).toContain("https://soroban-testnet.stellar.org");
  });

  test("includes Strict-Transport-Security in production mode", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const headers = getSecurityHeaders();

    const hsts = headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts).toBeDefined();
    expect(hsts?.value).toContain("max-age=31536000");
    expect(hsts?.value).toContain("includeSubDomains");
  });

  test("uses Content-Security-Policy-Report-Only when configured", () => {
    process.env.CSP_REPORT_ONLY = "true";
    const headers = getSecurityHeaders();

    const reportOnly = headers.find(
      (h) => h.key === "Content-Security-Policy-Report-Only",
    );
    const enforcing = headers.find((h) => h.key === "Content-Security-Policy");

    expect(reportOnly).toBeDefined();
    expect(enforcing).toBeUndefined();
  });
});
