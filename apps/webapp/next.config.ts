import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["smart-account-kit", "smart-account-kit-bindings"],
  images: {
    maximumDiskCacheSize: 250 * 1024 * 1024,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
