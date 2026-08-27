import type { ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { render, within, type RenderResult } from "@testing-library/react";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../messages/en.json";

// The catalogue contains an array of marquee strings, which next-intl's message
// type does not model. The provider handles it fine at runtime.
const messages = enMessages as unknown as AbstractIntlMessages;

/**
 * Renders a translated component with the real English message catalogue.
 *
 * Using the actual messages rather than a stub that echoes keys means a test
 * asserting on visible copy also proves the key exists, so a missing or renamed
 * translation fails here instead of shipping as a raw key in the UI.
 *
 * Queries are scoped to this render's own container rather than the document
 * body. Renders from earlier files in the same `bun test` process are still
 * attached to the body, and a body-scoped query would either match one of them
 * or fail outright on a duplicate.
 */
export function renderWithIntl(ui: ReactElement): RenderResult {
  const result = renderInProvider(ui);
  return { ...result, ...within(result.container) };
}

function renderInProvider(ui: ReactElement): RenderResult {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="UTC"
      now={new Date("2026-04-25T00:00:00Z")}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
