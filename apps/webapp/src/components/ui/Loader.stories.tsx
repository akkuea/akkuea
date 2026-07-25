import type { Meta, StoryObj } from "@storybook/react";
import { Loader, PageLoader } from "./Loader";

const meta: Meta<typeof Loader> = {
  title: "UI/Loader",
  component: Loader,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof Loader>;

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const PageLoaderStory: StoryObj<typeof PageLoader> = {
  render: () => <PageLoader message="Loading properties..." />,
};
PageLoaderStory.storyName = "Page Loader";

export const LoaderRow: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Loader size="sm" />
      <Loader size="md" />
      <Loader size="lg" />
    </div>
  ),
};
