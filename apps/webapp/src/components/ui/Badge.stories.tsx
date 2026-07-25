import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "danger", "info", "outline"],
    },
    dot: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: "Default" },
};

export const Success: Story = {
  args: { children: "Active", variant: "success" },
};

export const Warning: Story = {
  args: { children: "Pending", variant: "warning" },
};

export const Danger: Story = {
  args: { children: "Failed", variant: "danger" },
};

export const Info: Story = {
  args: { children: "Info", variant: "info" },
};

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
};

export const WithDot: Story = {
  args: { children: "Live", variant: "success", dot: true },
};

export const BadgeRow: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
