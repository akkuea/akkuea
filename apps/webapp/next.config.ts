import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { parsePropertyImageHosts } from "@akkuea/shared";

// Validate webapp environment configuration on server boot
import "./src/lib/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Static security headers (CSP is per-request and set by middleware.ts).
 *
 * X-Content-Type-Options: nosniff - prevents MIME sniffing
 * X-Frame-Options: DENY - defense-in-depth against clickjacking
 * Referrer-Policy: strict-origin-when-cross-origin - privacy-aware referer
 * Permissions-Policy: disables dangerous browser APIs
 * Strict-Transport-Security: enforces HTTPS in production
 */
async function headers() {
  const isProduction = process.env.NODE_ENV === "production";

  return [
    {
      source: "/:path*",
      headers: [
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
