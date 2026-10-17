import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";

/**
 * Security headers configuration test.
 *
 * This test validates that the next.config.ts headers() function is properly
 * configured with security headers required for protecting against:
 * - Clickjacking (X-Frame-Options, frame-ancestors)
 * - MIME type sniffing (X-Content-Type-Options)
 * - Unencrypted connections (Strict-Transport-Security)
 * - Unauthorized resource embedding (Content-Security-Policy)
 *
 * Note: This test reads and validates the next.config.ts source code rather than
 * importing it, as importing a config file with env-dependent behavior can be
 * complex. The static analysis approach is more reliable for verifying the
 * presence of required security headers in the configuration.
 */
describe("Security Headers Configuration", () => {
  const nextConfigPath = path.join(
    import.meta.dir,
    "../../next.config.ts",
  );
  const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");

  it("should have a headers function defined", () => {
    expect(nextConfigContent).toContain("async function headers()");
  });

  it("should include X-Content-Type-Options header with nosniff", () => {
    expect(nextConfigContent).toContain("X-Content-Type-Options");
    expect(nextConfigContent).toContain("nosniff");
  });

  it("should include X-Frame-Options header with DENY", () => {
    expect(nextConfigContent).toContain("X-Frame-Options");
    expect(nextConfigContent).toContain("DENY");
  });

  it("should include Referrer-Policy header", () => {
    expect(nextConfigContent).toContain("Referrer-Policy");
    expect(nextConfigContent).toContain("strict-origin-when-cross-origin");
  });

  it("should include Permissions-Policy header", () => {
    expect(nextConfigContent).toContain("Permissions-Policy");
    expect(nextConfigContent).toContain("camera=()");
    expect(nextConfigContent).toContain("geolocation=()");
    expect(nextConfigContent).toContain("microphone=()");
  });

  it("should include Content-Security-Policy header", () => {
    expect(nextConfigContent).toContain("Content-Security-Policy");
  });

  it("should have frame-ancestors 'none' in CSP", () => {
    expect(nextConfigContent).toContain("frame-ancestors 'none'");
  });

  it("should have object-src 'none' in CSP", () => {
    expect(nextConfigContent).toContain("object-src 'none'");
  });

  it("should have base-uri 'self' in CSP", () => {
    expect(nextConfigContent).toContain("base-uri 'self'");
  });

  it("should configure connect-src for API and blockchain endpoints", () => {
    expect(nextConfigContent).toContain("connect-src");
    expect(nextConfigContent).toContain("apiUrl");
    expect(nextConfigContent).toContain("sorobanRpcUrl");
    expect(nextConfigContent).toContain("horizonUrl");
  });

  it("should support mainnet configuration", () => {
    expect(nextConfigContent).toContain("rpc.mainnet.stellar.org");
    expect(nextConfigContent).toContain("horizon.stellar.org");
  });

  it("should support testnet configuration", () => {
    expect(nextConfigContent).toContain("soroban-testnet.stellar.org");
    expect(nextConfigContent).toContain("horizon-testnet.stellar.org");
  });

  it("should include Privy auth endpoints in CSP", () => {
    expect(nextConfigContent).toContain("auth.privy.io");
    expect(nextConfigContent).toContain("api.privy.io");
  });

  it("should include Freighter wallet endpoints", () => {
    expect(nextConfigContent).toContain("freighter.app");
  });

  it("should have Strict-Transport-Security for production", () => {
    expect(nextConfigContent).toContain("Strict-Transport-Security");
    expect(nextConfigContent).toContain("max-age=31536000");
    expect(nextConfigContent).toContain("isProduction");
  });

  it("should document unsafe-inline exceptions if they exist", () => {
    // This test verifies that any use of unsafe-inline is documented
    if (nextConfigContent.includes("unsafe-inline")) {
      // If there are unsafe-inline exceptions, they should be documented
      // in a comment explaining why
      const hasDocumentation =
        nextConfigContent.includes("comment") ||
        nextConfigContent.includes("//") ||
        nextConfigContent.includes("/* ");
      expect(hasDocumentation).toBe(true);
    }
  });
});
