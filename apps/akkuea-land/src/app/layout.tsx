import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { OnboardingGate } from "@/components/game/onboarding/OnboardingGate";

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
      <body className="bg-land-bg text-land-fg min-h-screen antialiased">
        <OnboardingGate>{children}</OnboardingGate>
      </body>
    </html>
  );
}
