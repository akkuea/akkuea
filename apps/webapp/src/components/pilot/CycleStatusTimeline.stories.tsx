import type { Meta, StoryObj } from "@storybook/react";
import { CycleStatusTimeline } from "./CycleStatusTimeline";
import {
  escalatedCycles,
  populatedCycles,
  SAMPLE_NOW,
  timelineFor,
} from "./fixtures";

const LAST_UPDATED = new Date(SAMPLE_NOW * 1000);

const meta: Meta<typeof CycleStatusTimeline> = {
  title: "Pilot/CycleStatusTimeline",
  component: CycleStatusTimeline,
  parameters: { layout: "padded" },
  args: {
    timeline: timelineFor(populatedCycles),
    isLoading: false,
    error: null,
    lastUpdatedAt: LAST_UPDATED,
    connectionStatus: "connected",
    onRefresh: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof CycleStatusTimeline>;

export const Populated: Story = {};

export const Loading: Story = {
  args: {
    timeline: timelineFor([]),
    isLoading: true,
    lastUpdatedAt: null,
    connectionStatus: "connecting",
  },
};

export const Error: Story = {
  args: {
    timeline: timelineFor([]),
    error: "Could not reach Soroban RPC.",
    lastUpdatedAt: null,
    connectionStatus: "disconnected",
  },
};

export const Empty: Story = {
  args: { timeline: timelineFor([]) },
};

/** A failed poll over data that already loaded keeps the history on screen. */
export const StaleAfterFailedPoll: Story = {
  args: {
    error: "Could not reach Soroban RPC.",
    connectionStatus: "disconnected",
  },
};

/** Two consecutive unreported cycles trigger the on-chain escalation notice. */
export const Escalated: Story = {
  args: { timeline: timelineFor(escalatedCycles) },
};
