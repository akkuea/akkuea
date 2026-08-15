import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";
import { Button } from "./Button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "elevated",
        "bordered",
        "accent",
        "gradient",
        "glow",
      ],
    },
    hoverable: { control: "boolean" },
    noPadding: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: "This is a default card with some content.",
  },
};

export const Elevated: Story = {
  args: {
    variant: "elevated",
    children: "This card has an elevated shadow effect.",
  },
};

export const Bordered: Story = {
  args: {
    variant: "bordered",
    children: "This card has a bordered style that highlights on hover.",
  },
};

export const Accent: Story = {
  args: {
    variant: "accent",
    children: "This card glows with accent color on hover.",
  },
};

export const Gradient: Story = {
  args: {
    variant: "gradient",
    children: "This card has a subtle gradient background.",
  },
};

export const Glow: Story = {
  args: {
    variant: "glow",
    children: "This card has a permanent accent glow effect.",
  },
};

export const Hoverable: Story = {
  args: {
    hoverable: true,
    children: "Hover over me - I scale up slightly.",
  },
};

export const WithHeaderAndFooter: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>This is a description for the card.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-300">
          Main card content goes here. You can put any React nodes inside.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button variant="primary" size="sm">
          Save
        </Button>
      </CardFooter>
    </Card>
  ),
};
