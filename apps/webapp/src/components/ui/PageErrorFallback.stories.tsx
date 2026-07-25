import type { Meta, StoryObj } from "@storybook/react";
import { PageErrorFallback } from "./PageErrorFallback";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof PageErrorFallback> = {
  title: "UI/PageErrorFallback",
  component: PageErrorFallback,
};

export default meta;
type Story = StoryObj<typeof PageErrorFallback>;

export const Default: Story = {};

export const WithReset: Story = {
  args: { onReset: action("reset") },
};
