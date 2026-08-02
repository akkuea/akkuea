import type { Meta, StoryObj } from "@storybook/react";
import { FreshnessIndicator } from "./FreshnessIndicator";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof FreshnessIndicator> = {
  title: "UI/FreshnessIndicator",
  component: FreshnessIndicator,
  argTypes: {
    connectionStatus: {
      control: "select",
      options: ["connected", "connecting", "disconnected"],
    },
    showLabel: { control: "boolean" },
    isPolling: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof FreshnessIndicator>;

export const Connected: Story = {
  args: {
    connectionStatus: "connected",
    lastUpdatedAt: new Date(),
  },
};

export const Connecting: Story = {
  args: {
    connectionStatus: "connecting",
    lastUpdatedAt: new Date(),
  },
};

export const Disconnected: Story = {
  args: {
    connectionStatus: "disconnected",
    lastUpdatedAt: new Date(Date.now() - 120000),
  },
};

export const Polling: Story = {
  args: {
    connectionStatus: "connected",
    isPolling: true,
    lastUpdatedAt: new Date(),
  },
};

export const WithRefresh: Story = {
  args: {
    connectionStatus: "connected",
    lastUpdatedAt: new Date(),
    onRefresh: action("refresh"),
  },
};

export const NoLabel: Story = {
  args: {
    connectionStatus: "connected",
    lastUpdatedAt: new Date(),
    showLabel: false,
  },
};

export const StaleData: Story = {
  args: {
    connectionStatus: "connected",
    lastUpdatedAt: new Date(Date.now() - 600000),
  },
};
