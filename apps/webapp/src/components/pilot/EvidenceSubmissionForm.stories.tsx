import type { Meta, StoryObj } from "@storybook/react";
import {
  EvidenceSubmissionFormView,
  type EvidenceSubmissionWallet,
} from "./EvidenceSubmissionForm";

const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const connectedAlly: EvidenceSubmissionWallet = {
  address: ALLY,
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedAlly: EvidenceSubmissionWallet = {
  ...connectedAlly,
  address: null,
  isConnected: false,
};

const meta: Meta<typeof EvidenceSubmissionFormView> = {
  title: "Pilot/EvidenceSubmissionForm",
  component: EvidenceSubmissionFormView,
  parameters: { layout: "padded" },
  args: { cycleId: "2026-03", wallet: connectedAlly },
};

export default meta;
type Story = StoryObj<typeof EvidenceSubmissionFormView>;

export const Ready: Story = {};

export const DisconnectedWallet: Story = {
  args: { wallet: disconnectedAlly },
};

export const AwaitingReview: Story = { args: { currentStatus: "submitted" } };

export const Rejected: Story = {
  args: {
    currentStatus: "rejected",
    reviewReason: "The statement covers three weeks, not the full month.",
  },
};

export const Approved: Story = { args: { currentStatus: "approved" } };

export const ContractPaused: Story = { args: { isPaused: true } };
