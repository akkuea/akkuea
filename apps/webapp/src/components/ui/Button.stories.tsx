import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { ArrowRight, Trash2 } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger", "accent"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    isLoading: { control: "boolean" },
    isSecure: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: "Primary", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
};

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
};

export const Danger: Story = {
  args: { children: "Danger", variant: "danger" },
};

export const Accent: Story = {
  args: { children: "Accent", variant: "accent" },
};

export const Small: Story = {
  args: { children: "Small", size: "sm" },
};

export const Large: Story = {
  args: { children: "Large", size: "lg" },
};

export const Loading: Story = {
  args: { children: "Loading...", isLoading: true },
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};

export const WithIcons: Story = {
  args: {
    children: "Continue",
    rightIcon: <ArrowRight className="w-4 h-4" />,
    variant: "accent",
  },
};

export const Secure: Story = {
  args: { children: "Sign Transaction", isSecure: true },
};

export const WithLeftIcon: Story = {
  args: {
    children: "Delete",
    leftIcon: <Trash2 className="w-4 h-4" />,
    variant: "danger",
  },
};
