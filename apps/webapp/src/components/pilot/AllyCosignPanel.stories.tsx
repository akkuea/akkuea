import type { Meta, StoryObj } from "@storybook/react";
import { AllyCosignPanelView, type AllyCosignWallet } from "./AllyCosignPanel";

const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const connectedAlly: AllyCosignWallet = {
  address: ALLY,
  isConnected: true,
  connect: () => {},
  canSignAuthEntries: true,
  signAuthEntry: async () => "signed-auth-entry-xdr",
};

const disconnectedAlly: AllyCosignWallet = {
  ...connectedAlly,
  address: null,
  isConnected: false,
};

const unsupportedWalletAlly: AllyCosignWallet = {
  ...connectedAlly,
  canSignAuthEntries: false,
};

const meta: Meta<typeof AllyCosignPanelView> = {
  title: "Pilot/AllyCosignPanel",
  component: AllyCosignPanelView,
  parameters: { layout: "padded" },
  args: { wallet: connectedAlly },
};

export default meta;
type Story = StoryObj<typeof AllyCosignPanelView>;

export const Ready: Story = {};

export const DisconnectedWallet: Story = {
  args: { wallet: disconnectedAlly },
};

/** Wallets that cannot sign auth entries (embedded providers such as Privy
 * or Pollar) get an explicit message instead of a silent failure. */
export const WalletCannotSignAuthEntries: Story = {
  args: { wallet: unsupportedWalletAlly },
};
