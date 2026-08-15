import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Stepper } from "./Stepper";

const defaultSteps = [
  { id: "info", title: "Property Info", description: "Basic details" },
  { id: "documents", title: "Documents", description: "Upload files" },
  { id: "review", title: "Review", description: "Confirm and submit" },
  { id: "done", title: "Done", description: "Completed" },
];

const meta: Meta<typeof Stepper> = {
  title: "UI/Stepper",
  component: Stepper,
  argTypes: {
    currentStep: { control: { type: "number", min: 0, max: 3 } },
  },
};

export default meta;
type Story = StoryObj<typeof Stepper>;

export const Step0: Story = {
  args: { steps: defaultSteps, currentStep: 0 },
};

export const Step1: Story = {
  args: { steps: defaultSteps, currentStep: 1 },
};

export const Step2: Story = {
  args: { steps: defaultSteps, currentStep: 2 },
};

export const Complete: Story = {
  args: { steps: defaultSteps, currentStep: 4 },
};

function InteractiveStepper() {
  const [step, setStep] = useState(0);
  return (
    <div className="space-y-4">
      <Stepper steps={defaultSteps} currentStep={step} onStepClick={setStep} />
      <p className="text-sm text-neutral-400 text-center">
        Current step: {step} - click completed steps to navigate back
      </p>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveStepper />,
};

export const ManySteps: Story = {
  args: {
    steps: [
      { id: "1", title: "Connect" },
      { id: "2", title: "Configure" },
      { id: "3", title: "Verify" },
      { id: "4", title: "Deploy" },
      { id: "5", title: "Confirm" },
    ],
    currentStep: 2,
  },
};
