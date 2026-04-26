import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akkuea DeFi RWA | Real Estate Tokenization Platform",
  description:
    "Democratizing real estate investment through blockchain tokenization. Fractional ownership, DeFi lending, and institutional-grade security on Stellar.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/logo.png", rel: "shortcut icon", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
  keywords: [
    "real estate tokenization",
    "DeFi",
    "Stellar blockchain",
    "fractional ownership",
    "RWA",
    "emerging markets",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
