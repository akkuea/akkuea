import type { Meta, StoryObj } from "@storybook/react";
import { DistributionCosignPanel } from "./DistributionCosignPanel";

const OPERATOR = "GDNSSYSCSSGH6LKCQC345PNKRTSV6U2I6ZQJWVP7BFVMXFNKZAQOMHB";
const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const meta: Meta<typeof DistributionCosignPanel> = {
  title: "Pilot/DistributionCosignPanel",
  component: DistributionCosignPanel,
  parameters: { layout: "padded" },
  args: {
    operatorAddress: OPERATOR,
    allyAddress: ALLY,
    cycleId: "2026-03",
    totalDistributableUsdc: BigInt(125_000_0000000),
    signTransaction: async (xdr: string) => xdr,
    onDistributed: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof DistributionCosignPanel>;

/**
 * The panel's idle state, before the operator prepares anything. The
 * prepared/co-sign states depend on a live contract call, so they are not
 * reachable from a static Storybook args table.
 */
export const Idle: Story = {};
