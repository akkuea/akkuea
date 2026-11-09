import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import {
  API_ENDPOINTS,
  parsePropertyImageHosts,
  validateWebappEnv,
} from "@akkuea/shared";

// Validate webapp environment configuration on server boot
if (process.env.NODE_ENV !== "test") {
  validateWebappEnv();
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function toOriginOrNull(rawUrl: string | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(
  envVars: NodeJS.ProcessEnv = process.env,
): string {
  const configuredNetwork = (envVars.NEXT_PUBLIC_STELLAR_NETWORK ?? "")
    .trim()
    .toLowerCase();
  const isMainnet =
    configuredNetwork === "mainnet" || configuredNetwork === "public";

  const sorobanRpcUrl =
    envVars.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (isMainnet
      ? API_ENDPOINTS.SOROBAN_RPC.MAINNET
      : API_ENDPOINTS.SOROBAN_RPC.TESTNET);
  const horizonUrl =
    envVars.NEXT_PUBLIC_HORIZON_URL?.trim() ||
    (isMainnet ? API_ENDPOINTS.HORIZON.MAINNET : API_ENDPOINTS.HORIZON.TESTNET);
  const apiUrl = envVars.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001";
  const sseUrl = envVars.NEXT_PUBLIC_LENDING_SSE_URL?.trim();

  const dynamicConnectOrigins = [
    toOriginOrNull(apiUrl),
    toOriginOrNull(sorobanRpcUrl),
    toOriginOrNull(horizonUrl),
    toOriginOrNull(sseUrl),
  ].filter((origin): origin is string => Boolean(origin));

  const connectSrc = Array.from(
    new Set([
      "'self'",
      ...dynamicConnectOrigins,
      "https://auth.privy.io",
      "https://*.rpc.privy.systems",
      "https://explorer-api.walletconnect.com",
      "wss://relay.walletconnect.com",
      "wss://relay.walletconnect.org",
    ]),
  );

  const imageHosts = parsePropertyImageHosts(
    envVars.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS,
  );
  const imgSrc = Array.from(
    new Set([
      "'self'",
      "data:",
      "blob:",
      ...imageHosts.map((host) => `https://${host}`),
      "https://explorer-api.walletconnect.com",
    ]),
  );

  // Next.js App Router emits inline hydration scripts (__next_f) on static and
  // dynamic routes when configured via next.config.ts headers(), and
  // @privy-io/react-auth / @creit.tech/stellar-wallets-kit inject modal scripts
  // and styles. Development builds additionally require 'unsafe-eval' for
  // Next.js React Refresh / source-map reconstruction.
  const isDev = envVars.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://challenges.cloudflare.com",
  ];

  const frameSrc = [
    "'self'",
    "https://auth.privy.io",
    "https://verify.walletconnect.com",
    "https://verify.walletconnect.org",
    "https://challenges.cloudflare.com",
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(
  envVars: NodeJS.ProcessEnv = process.env,
): { key: string; value: string }[] {
  const reportOnly =
    (envVars.NEXT_PUBLIC_CSP_REPORT_ONLY ?? "").trim().toLowerCase() === "true";
  const cspHeaderKey = reportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const headers: { key: string; value: string }[] = [
    {
      key: cspHeaderKey,
      value: buildContentSecurityPolicy(envVars),
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
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
  ];

  if (envVars.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
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
        headers: buildSecurityHeaders(process.env),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
