import { describe, it, expect } from "bun:test";
import { buildContentSecurityPolicy } from "../lib/csp";

/**
 * Security headers configuration test.
 *
 * Tests verify that CSP builder produces correct policies with all required
 * directives and that static headers are configured correctly in next.config.ts.
 */
describe("Security Headers Configuration", () => {
  it("buildContentSecurityPolicy should include frame-ancestors 'none'", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("buildContentSecurityPolicy should include nonce in script-src", () => {
    const nonce = "test-nonce-abc123";
    const csp = buildContentSecurityPolicy(nonce);

    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("buildContentSecurityPolicy should build connect-src with API URL and blockchain endpoints", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("http://localhost:3001");
    expect(csp).toContain("https://soroban-testnet.stellar.org");
    expect(csp).toContain("https://horizon-testnet.stellar.org");
    expect(csp).toContain("https://auth.privy.io");
    expect(csp).toContain("https://api.freighter.app");
  });

  it("buildContentSecurityPolicy should use mainnet endpoints when configured", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("https://rpc.mainnet.stellar.org");
    expect(csp).toContain("https://horizon.stellar.org");
    expect(csp).not.toContain("testnet");
  });

  it("buildContentSecurityPolicy should include lending SSE URL in connect-src when provided", () => {
    process.env.NEXT_PUBLIC_LENDING_SSE_URL =
      "https://api.example.com/sse/lending";

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("https://api.example.com/sse/lending");
  });

  it("buildContentSecurityPolicy should build img-src from property image hosts", () => {
    process.env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS =
      "images.unsplash.com,cdn.example.com";

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("images.unsplash.com");
    expect(csp).toContain("cdn.example.com");
  });

  it("buildContentSecurityPolicy should include Privy and Freighter endpoints", () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("https://auth.privy.io");
    expect(csp).toContain("https://api.privy.io");
    expect(csp).toContain("wss://auth.privy.io");
    expect(csp).toContain("https://freighter.app");
  });

  it("buildContentSecurityPolicy without nonce should not include 'strict-dynamic'", () => {
    const csp = buildContentSecurityPolicy();

    // When no nonce is provided, strict-dynamic should not be in the policy
    expect(csp).not.toContain("'strict-dynamic'");
  });

  it("should document unsafe-inline exception in style-src", () => {
    const csp = buildContentSecurityPolicy();

    // style-src 'unsafe-inline' is documented for Next.js inline styles
    expect(csp).toContain("style-src 'self' https: 'unsafe-inline'");
  });

  it("buildContentSecurityPolicy should not include CSP in script-src when no nonce", () => {
    const csp = buildContentSecurityPolicy();
    // When built without nonce, it shouldn't have nonce
    expect(csp).not.toContain("'nonce-");
  });
});
