import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { API_ENDPOINTS, parsePropertyImageHosts } from "@akkuea/shared";

// Validate webapp environment configuration on server boot
import "./src/lib/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Hosts next/image may load property images from. Validated at boot by
// webappEnvSchema; see docs/deployment/environment-variables.md.
const propertyImageHosts = parsePropertyImageHosts(
  process.env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS,
);

function normalizeCspSource(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const isProd = env.NODE_ENV === "production";
  const stellarNetwork =
    env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "MAINNET" : "TESTNET";

  const imageHosts = parsePropertyImageHosts(
    env.NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS,
  );
  const imgSources = Array.from(
    new Set([
      "'self'",
      "data:",
      "blob:",
      ...imageHosts.map((hostname) => `https://${hostname}`),
      "https://*.privy.io",
    ]),
  );

  const configuredConnectSources = [
    normalizeCspSource(env.NEXT_PUBLIC_API_URL),
    normalizeCspSource(env.API_URL),
    normalizeCspSource(env.NEXT_PUBLIC_LENDING_SSE_URL),
    normalizeCspSource(env.NEXT_PUBLIC_SOROBAN_RPC_URL),
    API_ENDPOINTS.HORIZON[stellarNetwork],
    API_ENDPOINTS.SOROBAN_RPC[stellarNetwork],
  ].filter((source): source is string => Boolean(source));

  const connectSources = Array.from(
    new Set([
      "'self'",
      ...configuredConnectSources,
      "https://auth.privy.io",
      "https://*.privy.io",
      "https://api.privy.io",
      "https://*.walletconnect.com",
      "https://*.walletconnect.org",
      "wss://*.walletconnect.com",
      "wss://*.walletconnect.org",
    ]),
  );

  // Next.js App Router emits inline hydration/bootstrap scripts and
  // @privy-io/react-auth injects inline initialization handlers; until every
  // route opts into dynamic per-request nonce rendering, `'unsafe-inline'` is
  // required in `script-src`. `'unsafe-eval'` is restricted to non-production
  // builds for Next.js Fast Refresh / source-map evaluation.
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(isProd ? [] : ["'unsafe-eval'"]),
    "https://challenges.cloudflare.com",
  ];

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src ${imgSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    `frame-src 'self' https://auth.privy.io https://*.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com`,
    `worker-src 'self' blob:`,
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(
  env: NodeJS.ProcessEnv = process.env,
): Array<{ key: string; value: string }> {
  const isProd = env.NODE_ENV === "production";
  const reportOnly = env.NEXT_PUBLIC_CSP_REPORT_ONLY === "true";
  const cspHeaderKey = reportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const headers: Array<{ key: string; value: string }> = [
    {
      key: cspHeaderKey,
      value: buildContentSecurityPolicy(env),
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
      value:
        "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

export const nextConfig: NextConfig = {
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
