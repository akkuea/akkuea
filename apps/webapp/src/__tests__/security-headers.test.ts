import { describe, it, expect } from "bun:test";
import { NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "../lib/csp";
import { middleware } from "../../middleware";

/**
 * Security headers configuration test.
 *
 * Tests verify that:
 * 1. The CSP builder exports correctly and produces policies with all directives
 * 2. The middleware correctly generates and sets the CSP header with nonce
 * 3. Static headers are present in next.config.ts
 */
describe("Security Headers Configuration", () => {
  describe("CSP Builder (buildContentSecurityPolicy)", () => {
    it("should include frame-ancestors 'none'", () => {
      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    it("should include nonce in script-src when provided", () => {
      const nonce = "abc";
      const csp = buildContentSecurityPolicy(nonce);

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");
    });

    it("should not include nonce or strict-dynamic when not provided", () => {
      const csp = buildContentSecurityPolicy();

      expect(csp).not.toContain("'nonce-");
      expect(csp).not.toContain("'strict-dynamic'");
    });

    it("should build connect-src from API_ENDPOINTS based on network", () => {
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("http://localhost:3001");
      expect(csp).toContain("https://soroban-testnet.stellar.org");
      expect(csp).toContain("https://horizon-testnet.stellar.org");
    });

    it("should use mainnet RPC and Horizon when configured", () => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("https://rpc.mainnet.stellar.org");
      expect(csp).toContain("https://horizon.stellar.org");
    });

    it("should include Privy and Freighter wallet endpoints", () => {
      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("https://auth.privy.io");
      expect(csp).toContain("https://api.privy.io");
      expect(csp).toContain("wss://auth.privy.io");
      expect(csp).toContain("https://freighter.app");
    });

    it("should include Pollar SDK endpoint in connect-src and frame-src", () => {
      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("https://sdk.api.pollar.xyz");
      // Verify it's in connect-src
      const connectMatch = csp.match(/connect-src\s+([^;]+)/);
      expect(connectMatch).toBeDefined();
      expect(connectMatch?.[1]).toContain("https://sdk.api.pollar.xyz");
      // Verify it's in frame-src
      const frameMatch = csp.match(/frame-src\s+([^;]+)/);
      expect(frameMatch).toBeDefined();
      expect(frameMatch?.[1]).toContain("https://sdk.api.pollar.xyz");
    });

    it("should include lending SSE URL when configured", () => {
      process.env.NEXT_PUBLIC_LENDING_SSE_URL =
        "https://api.example.com/sse/lending";

      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("https://api.example.com/sse/lending");
    });

    it("should build img-src from property image hosts", () => {
      process.env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS =
        "images.unsplash.com,cdn.example.com";

      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("images.unsplash.com");
      expect(csp).toContain("cdn.example.com");
    });

    it("should document unsafe-inline exception in style-src", () => {
      const csp = buildContentSecurityPolicy();

      // style-src 'unsafe-inline' is documented for Next.js inline styles
      expect(csp).toContain("style-src 'self' https: 'unsafe-inline'");
    });
  });

  describe("middleware CSP enforcement", () => {
    it("middleware sets an enforcing CSP with a nonce", () => {
      const res = middleware(new NextRequest("http://localhost:3000/en"));

      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    });
  });

  describe("next.config.ts static headers", () => {
    it("should export static security headers for nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, and HSTS in production", async () => {
      const { default: nextConfig } = await import("../../next.config");

      if (!nextConfig.headers) {
        throw new Error("nextConfig.headers is not defined");
      }

      const result = await nextConfig.headers();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length > 0).toBe(true);

      const firstRule = result[0];
      expect(firstRule.headers).toBeDefined();

      const headerMap: Record<string, string> = {};
      if (firstRule.headers && Array.isArray(firstRule.headers)) {
        for (const h of firstRule.headers) {
          if (h.key && h.value) {
            headerMap[h.key] = h.value;
          }
        }
      }

      // Core security headers always present
      expect(Object.keys(headerMap)).toContain("X-Content-Type-Options");
      expect(headerMap["X-Content-Type-Options"]).toBe("nosniff");
      expect(Object.keys(headerMap)).toContain("X-Frame-Options");
      expect(headerMap["X-Frame-Options"]).toBe("DENY");
      expect(Object.keys(headerMap)).toContain("Referrer-Policy");
      expect(headerMap["Referrer-Policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(Object.keys(headerMap)).toContain("Permissions-Policy");
      expect(headerMap["Permissions-Policy"]).toContain("camera=()");
      // HSTS is production-only, so verify its presence when NODE_ENV is production
      // In test environments, it may not be present
      if (process.env.NODE_ENV === "production") {
        expect(Object.keys(headerMap)).toContain("Strict-Transport-Security");
      }
    });
  });
});
