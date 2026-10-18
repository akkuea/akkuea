import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { parsePropertyImageHosts, API_ENDPOINTS } from "@akkuea/shared";

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
 * - Property image hosts: from NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS config
 * - Lending SSE stream: when NEXT_PUBLIC_LENDING_SSE_URL is configured
 *
 * script-src uses a nonce injected by middleware.ts for inline script protection.
 *
 * style-src includes 'unsafe-inline' to support Next.js inline component styles
 * and Tailwind CSS. This is a documented exception for Next.js framework requirements.
 */
function buildContentSecurityPolicy(nonce?: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const lendingSseUrl = process.env.NEXT_PUBLIC_LENDING_SSE_URL || "";
  const network =
    (process.env.NEXT_PUBLIC_STELLAR_NETWORK as "mainnet" | "testnet") ||
    "testnet";

  // Use environment override or select from API_ENDPOINTS based on network
  const sorobanRpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    API_ENDPOINTS.SOROBAN_RPC[network.toUpperCase() as "MAINNET" | "TESTNET"];
  const horizonUrl =
    API_ENDPOINTS.HORIZON[network.toUpperCase() as "MAINNET" | "TESTNET"];

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

  // Add lending SSE endpoint if configured
  if (lendingSseUrl) {
    connectSources.push(lendingSseUrl);
  }

  const frameSources = [
    "'self'",
    // Privy embedded wallet and login flows
    "https://auth.privy.io",
    // Stellar Wallets Kit
    "https://freighter.app",
  ];

  // Build script-src with nonce for inline scripts (injected by Next.js)
  const scriptSources = [
    "'self'",
    // Privy SDK
    "https://cdn.privy.io",
    // Smart Account Kit dependencies
    "https://cdn.jsdelivr.net",
  ];

  // Add nonce for Next.js inline hydration scripts
  if (nonce) {
    scriptSources.push(`'nonce-${nonce}'`);
  }

  // Build img-src from property image hosts + unsplash
  const propertyHosts = parsePropertyImageHosts(
    process.env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS,
  );
  const imgSources = ["'self'", "data:", ...propertyHosts];

  return [
    "base-uri 'self'",
    "default-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self' https: data:",
    "frame-ancestors 'none'",
    `frame-src ${frameSources.join(" ")}`,
    `img-src ${imgSources.join(" ")}`,
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    // Next.js inline component styles and Tailwind CSS require 'unsafe-inline'
    "style-src 'self' https: 'unsafe-inline'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export interface HeadersWithNonce {
  headers: Array<{
    key: string;
    value: string;
  }>;
  nonce?: string;
}

async function headers(request?: {
  headersList: Headers;
}): Promise<
  Array<{
    source: string;
    headers: Array<{
      key: string;
      value: string;
    }>;
  }>
> {
  const isProduction = process.env.NODE_ENV === "production";
  const cspReportOnly = process.env.CSP_REPORT_ONLY === "true";

  // Get nonce from request headers if available (injected by middleware)
  const nonce = request?.headersList.get("x-nonce") || undefined;

  // Determine which CSP header to use
  // In production, enforce the policy. In development or when CSP_REPORT_ONLY is set, report only.
  const cspHeader = cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const cspValue = buildContentSecurityPolicy(nonce);

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

const propertyImageHosts = parsePropertyImageHosts(
  process.env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS,
);

const nextConfig: NextConfig = {
  transpilePackages: ["smart-account-kit", "smart-account-kit-bindings"],
  images: {
    maximumDiskCacheSize: 250 * 1024 * 1024,
    remotePatterns: propertyImageHosts.map((hostname: string) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  headers,
};

export default withNextIntl(nextConfig);
