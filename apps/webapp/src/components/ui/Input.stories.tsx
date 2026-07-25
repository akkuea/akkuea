import type { Meta, StoryObj } from "@storybook/react";
import { Input, Textarea } from "./Input";
import { Search, Mail } from "lucide-react";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  argTypes: {
    label: { control: "text" },
    error: { control: "text" },
    hint: { control: "text" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Enter value..." },
};

export const WithLabel: Story = {
  args: { label: "Wallet Address", placeholder: "G..." },
};

export const WithHint: Story = {
  args: {
    label: "Contract ID",
    placeholder: "CDLZ...",
    hint: "Paste the contract ID from Stellar Expert",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    placeholder: "you@example.com",
    error: "Invalid email address",
    defaultValue: "invalid",
  },
};

export const Disabled: Story = {
  args: { label: "Read-only", value: "0x1234...abcd", disabled: true },
};

export const WithLeftIcon: Story = {
  args: {
    label: "Search",
    placeholder: "Search properties...",
    leftIcon: <Search className="w-4 h-4" />,
  },
};

export const WithRightIcon: Story = {
  args: {
    label: "Email",
    placeholder: "you@example.com",
    defaultValue: "user@example.com",
    rightIcon: <Mail className="w-4 h-4" />,
  },
};

export const TextareaStory: StoryObj<typeof Textarea> = {
  render: () => (
    <Textarea
      label="Description"
      placeholder="Write a description..."
      hint="Max 500 characters"
    />
  ),
};
TextareaStory.storyName = "Textarea";

export const TextareaWithError: StoryObj<typeof Textarea> = {
  render: () => (
    <Textarea
      label="Bio"
      placeholder="Tell us about yourself"
      error="Bio is required"
    />
  ),
};
TextareaWithError.storyName = "Textarea with Error";
