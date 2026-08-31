import type { Preview } from "@storybook/react";
import { createElement } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import "../src/app/globals.css";
import enMessages from "../messages/en.json";

// The catalogue holds an array of marquee strings, which next-intl's message
// type does not model. The provider handles it fine at runtime.
const messages = enMessages as unknown as AbstractIntlMessages;

const preview: Preview = {
  // Any component calling useTranslations needs a provider above it, so every
  // story gets one rather than each translated component wiring its own.
  decorators: [
    (Story) =>
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages, timeZone: "UTC" },
        createElement(Story),
      ),
  ],
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#000000" },
        { name: "light", value: "#ffffff" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
