import type { ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { render, within, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@/context/ThemeContext";
import enMessages from "../../messages/en.json";
import esMessages from "../../messages/es.json";

const MESSAGES = { en: enMessages, es: esMessages } as const;

export type SupportedLocale = keyof typeof MESSAGES;

/**
 * Renders a translated component with the real message catalogue for the
 * given locale (English by default).
 *
 * Using the actual messages rather than a stub that echoes keys means a test
 * asserting on visible copy also proves the key exists, so a missing or
 * renamed translation fails here instead of shipping as a raw key in the UI.
 *
 * Queries are scoped to this render's own container rather than the document
 * body, since renders from earlier files in the same `bun test` process stay
 * attached to the body otherwise.
 *
 * Also wraps in `ThemeProvider`, since in the real app that only comes from
 * the root layout: any component under test that reaches for `useTheme`
 * (`ThemeToggle`, `GameShell`) would otherwise throw outside of it.
 */
export function renderWithIntl(
  ui: ReactElement,
  options: { locale?: SupportedLocale } = {},
): RenderResult {
  const locale = options.locale ?? "en";
  const result = render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="UTC"
    >
      <ThemeProvider>{ui}</ThemeProvider>
    </NextIntlClientProvider>,
  );
  return { ...result, ...within(result.container) };
}
