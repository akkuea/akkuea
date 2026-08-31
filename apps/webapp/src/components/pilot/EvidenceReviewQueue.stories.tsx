import type { Meta, StoryObj } from "@storybook/react";
import {
  EvidenceReviewQueueView,
  type OperatorWallet,
} from "./EvidenceReviewQueue";
import {
  awaitingReviewCycle,
  paidOnTimeCycle,
  populatedCycles,
  SAMPLE_NOW,
} from "./fixtures";

const LAST_UPDATED = new Date(SAMPLE_NOW * 1000);

const OPERATOR = "GDNSSYSCSSGH6LKCQC345PNKRTSV6U2I6ZQJWVP7BFVMXFNKZAQOMHB";

const connectedOperator: OperatorWallet = {
  address: OPERATOR,
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedOperator: OperatorWallet = {
  ...connectedOperator,
  address: null,
  isConnected: false,
};

const meta: Meta<typeof EvidenceReviewQueueView> = {
  title: "Pilot/EvidenceReviewQueue",
  component: EvidenceReviewQueueView,
  parameters: { layout: "padded" },
  args: {
    wallet: connectedOperator,
    cycles: populatedCycles,
    isLoading: false,
    error: null,
    lastUpdatedAt: LAST_UPDATED,
    connectionStatus: "connected",
    isPaused: false,
    onRefresh: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof EvidenceReviewQueueView>;

export const Populated: Story = {};

/** Without an operator wallet the queue explains what to connect and why. */
export const DisconnectedWallet: Story = {
  args: { wallet: disconnectedOperator },
};

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

/** Nothing is waiting on a decision once every reported cycle is settled. */
export const Empty: Story = {
  args: { cycles: [paidOnTimeCycle] },
};

/** A paused contract disables every review action and says why. */
export const ContractPaused: Story = {
  args: { cycles: [awaitingReviewCycle], isPaused: true },
};
