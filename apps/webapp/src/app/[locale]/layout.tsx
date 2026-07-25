import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "../globals.css";

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

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-black text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded"
        >
          Skip to content
        </a>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <main id="main-content">{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
