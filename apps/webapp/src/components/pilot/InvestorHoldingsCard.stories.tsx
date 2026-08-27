import type { Meta, StoryObj } from "@storybook/react";
import { InvestorHoldingsCard } from "./InvestorHoldingsCard";
import { SAMPLE_NOW, sampleHoldings } from "./fixtures";

const LAST_UPDATED = new Date(SAMPLE_NOW * 1000);

const meta: Meta<typeof InvestorHoldingsCard> = {
  title: "Pilot/InvestorHoldingsCard",
  component: InvestorHoldingsCard,
  parameters: { layout: "padded" },
  args: {
    holdings: sampleHoldings,
    totalDistributed: BigInt(21_150_0000000),
    isLoading: false,
    error: null,
    isDisconnected: false,
    lastUpdatedAt: LAST_UPDATED,
    connectionStatus: "connected",
    onRefresh: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof InvestorHoldingsCard>;

export const Populated: Story = {};

export const Loading: Story = {
  args: {
    holdings: null,
    isLoading: true,
    lastUpdatedAt: null,
    connectionStatus: "connecting",
  },
};

export const Error: Story = {
  args: {
    holdings: null,
    error: "Could not reach Soroban RPC.",
    lastUpdatedAt: null,
    connectionStatus: "disconnected",
  },
};

/** A wallet holding no tokens yet, which is what a new investor sees. */
export const Empty: Story = {
  args: { holdings: { ...sampleHoldings, balance: BigInt(0) } },
};

export const DisconnectedWallet: Story = {
  args: {
    holdings: null,
    isDisconnected: true,
    lastUpdatedAt: null,
    connectionStatus: "disconnected",
  },
};

/** Holding tokens without whitelist approval means payouts are skipped. */
export const NotWhitelisted: Story = {
  args: { holdings: { ...sampleHoldings, whitelisted: false } },
};
