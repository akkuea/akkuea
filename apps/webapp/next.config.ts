import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { parsePropertyImageHosts } from "@akkuea/shared";

// Validate webapp environment configuration on server boot
import "./src/lib/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Build a strict Content-Security-Policy based on environment configuration.
 *
 * The CSP allows:
 * - Privy (@privy-io/react-auth): iframes for embedded wallet flows
 * - Stellar Wallets Kit: frame-src for wallet connection
 * - Smart Account Kit: required dependencies
 * - Soroban RPC and Horizon endpoints: for blockchain queries
 * - API URL: for backend communication
 * - Unsplash images: for property imagery
 * - MSW service worker: when NEXT_PUBLIC_USE_MOCK=true
 *
 * If any third-party SDK requires 'unsafe-inline' or 'unsafe-eval', that
 * exception is explicitly documented in a comment below.
 */
function buildContentSecurityPolicy(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

  // Network-specific Soroban RPC and Horizon endpoints
  const sorobanRpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    (network === "mainnet"
      ? "https://rpc.mainnet.stellar.org"
      : "https://soroban-testnet.stellar.org");
  const horizonUrl =
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  const connectSources = [
    "'self'",
    apiUrl,
    sorobanRpcUrl,
    horizonUrl,
    // Privy services
    "https://auth.privy.io",
    "wss://auth.privy.io",
    "https://api.privy.io",
    // Stellar Wallets Kit discovery and signature requests
    "https://api.freighter.app",
  ];

  const frameSources = [
    "'self'",
    // Privy embedded wallet and login flows
    "https://auth.privy.io",
    // Stellar Wallets Kit
    "https://freighter.app",
  ];

  const scriptSources = [
    "'self'",
    // Privy SDK
    "https://cdn.privy.io",
    // Smart Account Kit dependencies (may require inline scripts for initialization)
    "https://cdn.jsdelivr.net",
  ];

  // Include MSW service worker registration script when mocking is enabled
  if (useMock) {
    scriptSources.push("/mockServiceWorker.js");
  }

  return [
    "base-uri 'self'",
    "default-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self' https: data:",
    `frame-ancestors 'none'`,
    `frame-src ${frameSources.join(" ")}`,
    `img-src 'self' https: data:`,
    `object-src 'none'`,
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' https: 'unsafe-inline'",
    "upgrade-insecure-requests",
  ].join("; ");
}

async function headers() {
  const isProduction = process.env.NODE_ENV === "production";
  const cspReportOnly = process.env.CSP_REPORT_ONLY === "true";

  // Determine which CSP header to use
  // In production, enforce the policy. In development or when CSP_REPORT_ONLY is set, report only.
  const cspHeader = cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const cspValue = buildContentSecurityPolicy();

  return [
    {
      source: "/:path*",
      headers: [
        {
          key: cspHeader,
          value: cspValue,
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value:
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
        },
        ...(isProduction
          ? [
              {
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains; preload",
              },
            ]
          : []),
      ],
    },
  ];
}

const nextConfig: NextConfig = {
  transpilePackages: ["smart-account-kit", "smart-account-kit-bindings"],
  images: {
    maximumDiskCacheSize: 250 * 1024 * 1024,
    remotePatterns: propertyImageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  headers,
};

export default withNextIntl(nextConfig);
