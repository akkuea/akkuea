import { describe, expect, it } from "bun:test";
import { API_ENDPOINTS } from "@akkuea/shared";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  nextConfig,
} from "../../next.config";

describe("webapp security headers and Content-Security-Policy", () => {
  it("exposes headers() for all routes in nextConfig", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const routeHeaders = await nextConfig.headers!();

    expect(routeHeaders).toHaveLength(1);
    expect(routeHeaders[0]?.source).toBe("/:path*");
    expect(routeHeaders[0]?.headers.length).toBeGreaterThanOrEqual(5);
  });

  it("includes all six baseline security headers in production", () => {
    const headers = buildSecurityHeaders({
      NODE_ENV: "production",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
    });

    const headerMap = new Map(headers.map((h) => [h.key, h.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.get("Permissions-Policy")).toContain("microphone=()");
    expect(headerMap.get("Permissions-Policy")).toContain("geolocation=()");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );

    const csp = headerMap.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("omits HSTS in development and allows report-only toggle", () => {
    const headers = buildSecurityHeaders({
      NODE_ENV: "development",
      NEXT_PUBLIC_CSP_REPORT_ONLY: "true",
    });

    const headerMap = new Map(headers.map((h) => [h.key, h.value]));

    expect(headerMap.has("Strict-Transport-Security")).toBe(false);
    expect(headerMap.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(headerMap.has("Content-Security-Policy")).toBe(false);
  });

  it("builds connect-src dynamically for testnet and mainnet configurations", () => {
    const testnetCsp = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
      NEXT_PUBLIC_LENDING_SSE_URL: "http://127.0.0.1:4100/events",
    });

    expect(testnetCsp).toContain("http://localhost:4000");
    expect(testnetCsp).toContain("http://127.0.0.1:4100");
    expect(testnetCsp).toContain(API_ENDPOINTS.HORIZON.TESTNET);
    expect(testnetCsp).toContain(API_ENDPOINTS.SOROBAN_RPC.TESTNET);
    expect(testnetCsp).not.toContain(API_ENDPOINTS.HORIZON.MAINNET);

    const mainnetCsp = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS: "images.unsplash.com,cdn.akkuea.org",
    });

    expect(mainnetCsp).toContain(API_ENDPOINTS.HORIZON.MAINNET);
    expect(mainnetCsp).toContain(API_ENDPOINTS.SOROBAN_RPC.MAINNET);
    expect(mainnetCsp).not.toContain(API_ENDPOINTS.HORIZON.TESTNET);
    expect(mainnetCsp).toContain("images.unsplash.com");
    expect(mainnetCsp).toContain("cdn.akkuea.org");
  });
});
