import { describe, expect, it } from "bun:test";
import { API_ENDPOINTS } from "@akkuea/shared";
import nextConfig, {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "../../next.config";

describe("webapp security headers and Content-Security-Policy", () => {
  it("exposes an async headers() config on nextConfig covering all routes", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const routes = await nextConfig.headers!();
    expect(routes).toHaveLength(1);
    expect(routes[0]?.source).toBe("/:path*");
  });

  it("returns all six security headers in production mode", () => {
    const headers = buildSecurityHeaders({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://api.akkuea.org",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    });

    const headerMap = new Map(headers.map((h) => [h.key, h.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );

    const csp = headerMap.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("omits Strict-Transport-Security outside production", () => {
    const headers = buildSecurityHeaders({
      NODE_ENV: "development",
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
    });
    const keys = headers.map((h) => h.key);
    expect(keys).not.toContain("Strict-Transport-Security");
  });

  it("resolves connect-src dynamically for testnet and mainnet without code changes", () => {
    const testnetCsp = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://api-staging.akkuea.org/v1",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    });
    expect(testnetCsp).toContain("https://api-staging.akkuea.org");
    expect(testnetCsp).toContain(API_ENDPOINTS.SOROBAN_RPC.TESTNET);
    expect(testnetCsp).toContain(API_ENDPOINTS.HORIZON.TESTNET);

    const mainnetCsp = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://api.akkuea.org",
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
    });
    expect(mainnetCsp).toContain("https://api.akkuea.org");
    expect(mainnetCsp).toContain(API_ENDPOINTS.SOROBAN_RPC.MAINNET);
    expect(mainnetCsp).toContain(API_ENDPOINTS.HORIZON.MAINNET);
    expect(mainnetCsp).not.toContain(API_ENDPOINTS.SOROBAN_RPC.TESTNET);
  });

  it("switches to Content-Security-Policy-Report-Only when NEXT_PUBLIC_CSP_REPORT_ONLY=true", () => {
    const headers = buildSecurityHeaders({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://api.akkuea.org",
      NEXT_PUBLIC_CSP_REPORT_ONLY: "true",
    });
    const keys = headers.map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy-Report-Only");
    expect(keys).not.toContain("Content-Security-Policy");
  });
});
