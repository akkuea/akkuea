import type { Meta, StoryObj } from "@storybook/react";
import {
  EurcPreferenceFormView,
  type SettlementWallet,
} from "./EurcPreferenceForm";

const connectedWallet: SettlementWallet = {
  address: "GDMNDPKKZQGCXQVJFVNQZ3Q5VJQ5F4VJ3XJ4W6O2F3Q5H7K4L2M4N6P8R",
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedWallet: SettlementWallet = {
  ...connectedWallet,
  address: null,
  isConnected: false,
};

const meta: Meta<typeof EurcPreferenceFormView> = {
  title: "Pilot/EurcPreferenceForm",
  component: EurcPreferenceFormView,
  parameters: { layout: "padded" },
  args: {
    currentPreference: "usdc",
    isPaused: false,
    wallet: connectedWallet,
    onUpdated: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof EurcPreferenceFormView>;

/** Paid in USDC, the default, with the EURC option available. */
export const PaidInUsdc: Story = {};

/** Already opted into EURC. */
export const PaidInEurc: Story = {
  args: { currentPreference: "eurc" },
};

/** Currency changes are blocked while the contract is paused. */
export const ContractPaused: Story = {
  args: { isPaused: true },
};

export const DisconnectedWallet: Story = {
  args: { wallet: disconnectedWallet },
};
