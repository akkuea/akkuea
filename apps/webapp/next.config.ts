import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
