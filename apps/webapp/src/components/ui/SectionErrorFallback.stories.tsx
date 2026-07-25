import type { Meta, StoryObj } from "@storybook/react";
import { SectionErrorFallback } from "./SectionErrorFallback";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof SectionErrorFallback> = {
  title: "UI/SectionErrorFallback",
  component: SectionErrorFallback,
  argTypes: {
    message: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof SectionErrorFallback>;

export const Default: Story = {};

export const WithRetry: Story = {
  args: { onReset: action("retry") },
};

export const CustomMessage: Story = {
  args: {
    message: "Failed to load portfolio stats",
    onReset: action("retry"),
  },
};
