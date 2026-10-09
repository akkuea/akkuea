import type { Meta, StoryObj } from "@storybook/react";
import { RecordEvidenceCosignPanel } from "./RecordEvidenceCosignPanel";

const OPERATOR = "GDNSSYSCSSGH6LKCQC345PNKRTSV6U2I6ZQJWVP7BFVMXFNKZAQOMHB";
const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";

const meta: Meta<typeof RecordEvidenceCosignPanel> = {
  title: "Pilot/RecordEvidenceCosignPanel",
  component: RecordEvidenceCosignPanel,
  parameters: { layout: "padded" },
  args: {
    operatorAddress: OPERATOR,
    allyAddress: ALLY,
    signTransaction: async (xdr: string) => xdr,
    onRecorded: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof RecordEvidenceCosignPanel>;

/**
 * The compose form, before the operator prepares anything. The prepared/
 * co-sign states depend on a live contract call, so they are not reachable
 * from a static Storybook args table.
 */
export const Compose: Story = {};
