import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Toggle } from "./Toggle";

const meta: Meta<typeof Toggle> = {
  title: "UI/Toggle",
  component: Toggle,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

function ToggleWrapper(props: Partial<React.ComponentProps<typeof Toggle>>) {
  const [enabled, setEnabled] = useState(false);
  return <Toggle {...props} enabled={enabled} onChange={setEnabled} />;
}

export const Default: Story = {
  render: () => <ToggleWrapper label="Enable notifications" />,
};

export const WithDescription: Story = {
  render: () => (
    <ToggleWrapper
      label="Dark mode"
      description="Toggle between light and dark themes"
    />
  ),
};

export const Small: Story = {
  render: () => <ToggleWrapper label="Compact mode" size="sm" />,
};

export const Large: Story = {
  render: () => <ToggleWrapper label="Large toggle" size="lg" />,
};

export const Disabled: Story = {
  render: () => <ToggleWrapper label="Disabled toggle" disabled />,
};

export const Enabled: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(true);
    return (
      <Toggle
        enabled={enabled}
        onChange={setEnabled}
        label="Enabled by default"
      />
    );
  },
};
