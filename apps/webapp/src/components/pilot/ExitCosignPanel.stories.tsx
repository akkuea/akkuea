import type { Meta, StoryObj } from "@storybook/react";
import { ExitCosignPanel } from "./ExitCosignPanel";

const OPERATOR = "GDNSSYSCSSGH6LKCQC345PNKRTSV6U2I6ZQJWVP7BFVMXFNKZAQOMHB";
const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const meta: Meta<typeof ExitCosignPanel> = {
  title: "Pilot/ExitCosignPanel",
  component: ExitCosignPanel,
  parameters: { layout: "padded" },
  args: {
    operatorAddress: OPERATOR,
    allyAddress: ALLY,
    signTransaction: async (xdr: string) => xdr,
    onExited: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ExitCosignPanel>;

/**
 * The compose form, before the operator confirms or prepares anything. The
 * confirm and prepared states depend on interaction and a live contract
 * call, so they are not reachable from a static Storybook args table.
 */
export const Compose: Story = {};
