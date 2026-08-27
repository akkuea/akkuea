import type { Meta, StoryObj } from "@storybook/react";
import { CycleStatusBadge } from "./CycleStatusBadge";

const meta: Meta<typeof CycleStatusBadge> = {
  title: "Pilot/CycleStatusBadge",
  component: CycleStatusBadge,
  parameters: { layout: "centered" },
  args: { status: "on_time" },
};

export default meta;
type Story = StoryObj<typeof CycleStatusBadge>;

export const OnTime: Story = {};
export const Late: Story = { args: { status: "late" } };
export const Disputed: Story = { args: { status: "disputed" } };
export const NotReceived: Story = { args: { status: "not_received" } };
export const Pending: Story = { args: { status: "pending" } };
