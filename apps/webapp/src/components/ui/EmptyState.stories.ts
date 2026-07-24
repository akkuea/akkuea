import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    title: "No properties found",
    description: "Try adjusting your filters or create a new property listing.",
  },
};

export const WithAction: Story = {
  args: {
    title: "No results",
    description: "Your search did not match any properties.",
    action: { label: "Clear filters", onClick: action("clear-filters") },
  },
};

export const CustomIcon: Story = {
  args: {
    title: "Portfolio is empty",
    description: "Start by adding your first investment.",
    action: { label: "Browse Properties", onClick: action("browse") },
  },
};
