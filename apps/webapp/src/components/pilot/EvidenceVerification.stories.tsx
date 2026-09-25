import type { Meta, StoryObj } from "@storybook/react";
import { EvidenceVerification } from "./EvidenceVerification";

const HASH = "3b1f".repeat(16);

const meta: Meta<typeof EvidenceVerification> = {
  title: "Pilot/EvidenceVerification",
  component: EvidenceVerification,
  parameters: { layout: "padded" },
  args: {
    evidenceLink: "https://example.org/statements/2026-08.pdf",
    evidenceHashHex: HASH,
  },
};

export default meta;
type Story = StoryObj<typeof EvidenceVerification>;

/**
 * Pressing the action re-fetches the linked document, re-hashes it in the
 * browser, and reports match, mismatch, or unreachable. A source the browser
 * cannot fetch offers the download-and-hash fallback.
 */
export const Default: Story = {};
