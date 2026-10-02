import type { Meta, StoryObj } from "@storybook/react";
import { PayoutHistory } from "./PayoutHistory";
import {
  pendingSettlementCycle,
  SAMPLE_NOW,
  settlementCycles,
} from "./fixtures";

const LAST_UPDATED = new Date(SAMPLE_NOW * 1000);
const EXPLORER_URL =
  "https://stellar.expert/explorer/testnet/contract/CBGDO2GUWYSDU4SK3SNJJHYX6HRADUNXCU7TKJFFGLRWA4FSRZNLAJ4J";

const meta: Meta<typeof PayoutHistory> = {
  title: "Pilot/PayoutHistory",
  component: PayoutHistory,
  parameters: { layout: "padded" },
  args: {
    cycles: settlementCycles,
    isLoading: false,
    error: null,
    lastUpdatedAt: LAST_UPDATED,
    connectionStatus: "connected",
    onRefresh: () => {},
    explorerUrl: EXPLORER_URL,
  },
};

export default meta;
type Story = StoryObj<typeof PayoutHistory>;

/** A settled EURC cycle, a withheld cycle, and one still pending. */
export const Populated: Story = {};

export const Loading: Story = {
  args: {
    cycles: [],
    isLoading: true,
    lastUpdatedAt: null,
    connectionStatus: "connecting",
  },
};

export const Error: Story = {
  args: {
    cycles: [],
    error: "Could not reach Soroban RPC.",
    lastUpdatedAt: null,
    connectionStatus: "disconnected",
  },
};

/** Before the first distribution there is nothing to show. */
export const Empty: Story = {
  args: { cycles: [pendingSettlementCycle] },
};
