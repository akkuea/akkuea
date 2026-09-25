import React from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import "../globals.css";
import { OnboardingGate } from "@/components/game/onboarding/OnboardingGate";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/context/ThemeContext";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme class before first paint. Must stay
            synchronous and inline, otherwise the page flashes the wrong
            theme while the bundle loads. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-land-bg text-land-fg min-h-screen antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-land-accent-fill focus:text-land-on-accent"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <OnboardingGate>
              <div id="main-content">{children}</div>
            </OnboardingGate>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
