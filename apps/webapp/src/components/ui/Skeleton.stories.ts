import type { Meta, StoryObj } from "@storybook/react";
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonAvatar,
  SkeletonPropertyCard,
  SkeletonPoolCard,
} from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Base: Story = {
  args: { className: "h-4 w-48" },
};

export const Circular: Story = {
  args: { variant: "circular", className: "h-12 w-12" },
};

export const Rectangular: Story = {
  args: { variant: "rectangular", className: "h-32 w-64" },
};

export const TextLines: StoryObj<typeof SkeletonText> = {
  render: () => <SkeletonText lines={4} className="w-96" />,
};
TextLines.storyName = "Text Lines";

export const AvatarLoading: StoryObj<typeof SkeletonAvatar> = {
  render: () => (
    <div className="flex items-center gap-4">
      <SkeletonAvatar size="sm" />
      <SkeletonAvatar size="md" />
      <SkeletonAvatar size="lg" />
    </div>
  ),
};
AvatarLoading.storyName = "Avatar";

export const CardLoading: StoryObj<typeof SkeletonCard> = {
  render: () => <SkeletonCard className="w-80" />,
};
CardLoading.storyName = "Card";

export const TableLoading: StoryObj<typeof SkeletonTable> = {
  render: () => <SkeletonTable rows={4} columns={4} className="w-full max-w-2xl" />,
};
TableLoading.storyName = "Table";

export const PropertyCardLoading: StoryObj<typeof SkeletonPropertyCard> = {
  render: () => <SkeletonPropertyCard className="w-80" />,
};
PropertyCardLoading.storyName = "Property Card";

export const PoolCardLoading: StoryObj<typeof SkeletonPoolCard> = {
  render: () => <SkeletonPoolCard className="w-80" />,
};
PoolCardLoading.storyName = "Pool Card";
