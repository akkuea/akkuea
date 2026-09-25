import type { Meta, StoryObj } from "@storybook/react";
import {
  WithheldFundsCardView,
  type WithheldWallet,
} from "./WithheldFundsCard";

const connectedWallet: WithheldWallet = {
  address: "GDMNDPKKZQGCXQVJFVNQZ3Q5VJQ5F4VJ3XJ4W6O2F3Q5H7K4L2M4N6P8R",
  isConnected: true,
  connect: () => {},
  signTransaction: async (xdr: string) => xdr,
};

const disconnectedWallet: WithheldWallet = {
  ...connectedWallet,
  address: null,
  isConnected: false,
};

const meta: Meta<typeof WithheldFundsCardView> = {
  title: "Pilot/WithheldFundsCard",
  component: WithheldFundsCardView,
  parameters: { layout: "padded" },
  args: {
    withheld: BigInt(4_500_0000000),
    wallet: connectedWallet,
    onClaimed: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof WithheldFundsCardView>;

/** A failed EURC leg reserved this holder's share, claimable in USDC. */
export const Claimable: Story = {};

export const DisconnectedWallet: Story = {
  args: { wallet: disconnectedWallet },
};

/** Nothing is reserved, so the card renders nothing. */
export const NothingWithheld: Story = {
  args: { withheld: BigInt(0) },
};
