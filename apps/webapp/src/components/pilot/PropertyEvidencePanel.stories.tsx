import type { Meta, StoryObj } from "@storybook/react";
import { PropertyEvidencePanel } from "./PropertyEvidencePanel";

const meta: Meta<typeof PropertyEvidencePanel> = {
  title: "Pilot/PropertyEvidencePanel",
  component: PropertyEvidencePanel,
  parameters: { layout: "padded" },
  args: { splatUrl: null, propertyName: "Pilot property" },
};

export default meta;
type Story = StoryObj<typeof PropertyEvidencePanel>;

/** The pilot ally may have no 3D capture yet, so this is the default state. */
export const NoCaptureYet: Story = {};

export const WithCapture: Story = {
  args: { splatUrl: "https://example.org/captures/pilot-property.splat" },
};
