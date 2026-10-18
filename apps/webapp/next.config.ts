import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { parsePropertyImageHosts } from "@akkuea/shared";

// Validate webapp environment configuration on server boot
import "./src/lib/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export function getSecurityHeaders(): Array<{ key: string; value: string }> {
  const isProd = process.env.NODE_ENV === "production";
  const isReportOnly =
    process.env.CSP_REPORT_ONLY === "true" ||
    process.env.CSP_REPORT_ONLY === "1";

  // Build connect-src dynamically from configuration & known network endpoints
  const connectSources = new Set<string>([
    "'self'",
    "https://*.privy.io",
    "https://auth.privy.io",
    "wss://*.privy.io",
    "https://*.stellar.org",
    "https://soroban-testnet.stellar.org",
    "https://horizon-testnet.stellar.org",
    "https://rpc.mainnet.stellar.org",
    "https://horizon.stellar.org",
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
    "wss://*.walletconnect.com",
    "wss://*.walletconnect.org",
  ]);

  const addUrlToSources = (urlStr: string | undefined) => {
    if (!urlStr) return;
    try {
      const u = new URL(urlStr);
      connectSources.add(u.origin);
    } catch {
      // Ignore invalid or relative URLs
    }
  };

  addUrlToSources(process.env.NEXT_PUBLIC_API_URL);
  addUrlToSources(process.env.API_URL);
  addUrlToSources(process.env.NEXT_PUBLIC_LENDING_SSE_URL);
  addUrlToSources(process.env.STELLAR_RPC_URL);
  addUrlToSources(process.env.STELLAR_HORIZON_URL);

  if (!isProd) {
    connectSources.add("ws://localhost:*");
    connectSources.add("http://localhost:*");
  }

  // Note on script-src:
  // '@privy-io/react-auth' and Web3 wallet bridge SDKs (@creit.tech/stellar-wallets-kit, smart-account-kit)
  // require 'unsafe-inline' and 'unsafe-eval' for client-side cryptographic and iframe bridge operations.
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.privy.io",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.privy.io https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    "frame-src 'self' https://*.privy.io https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
    `connect-src ${Array.from(connectSources).join(" ")}`,
  ];

  const cspHeaderKey = isReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const headers: Array<{ key: string; value: string }> = [
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: cspHeaderKey,
      value: cspDirectives.join("; "),
    },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
}

// Hosts next/image may load property images from. Validated at boot by
// webappEnvSchema; see docs/deployment/environment-variables.md.
const propertyImageHosts = parsePropertyImageHosts(
  process.env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS,
);

const nextConfig: NextConfig = {
  transpilePackages: ["smart-account-kit", "smart-account-kit-bindings"],
  images: {
    maximumDiskCacheSize: 250 * 1024 * 1024,
    remotePatterns: propertyImageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
  },
};

export { nextConfig };
export default withNextIntl(nextConfig);
