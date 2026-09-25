import type { Meta, StoryObj } from "@storybook/react";
import { PilotStateBanner } from "./PilotStateBanner";
import { sampleExitRecord } from "./fixtures";

const meta: Meta<typeof PilotStateBanner> = {
  title: "Pilot/PilotStateBanner",
  component: PilotStateBanner,
  parameters: { layout: "padded" },
  args: {},
};

export default meta;
type Story = StoryObj<typeof PilotStateBanner>;

/** An active pilot renders nothing at all. */
export const Active: Story = {};

/** A reversible operational pause. */
export const Paused: Story = {
  args: { isPaused: true },
};

/** A permanent exit, with the reason and timestamp recorded on-chain. */
export const Exited: Story = {
  args: { exitRecord: sampleExitRecord },
};

/** A wound-down pilot whose payout contract is also paused. */
export const ExitedAndPaused: Story = {
  args: { exitRecord: sampleExitRecord, isPaused: true },
};
