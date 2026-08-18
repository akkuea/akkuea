import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { OnboardingGate } from "@/components/game/onboarding/OnboardingGate";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Akkuea Land | City Builder on Stellar",
  description:
    "Build, own, and trade virtual land parcels backed by real-world assets on the Stellar blockchain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme class before first paint. Must stay
            synchronous and inline, otherwise the page flashes the wrong
            theme while the bundle loads. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-land-bg text-land-fg min-h-screen antialiased">
        <ThemeProvider>
          <OnboardingGate>{children}</OnboardingGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
