import type { Meta, StoryObj } from "@storybook/nextjs";
import { PageErrorFallback } from "./PageErrorFallback";
import { action } from "storybook/actions";

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
