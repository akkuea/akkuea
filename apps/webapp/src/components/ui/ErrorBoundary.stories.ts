import type { Meta, StoryObj } from "@storybook/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof ErrorBoundary> = {
  title: "UI/ErrorBoundary",
  component: ErrorBoundary,
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

function BuggyComponent() {
  throw new Error("Simulated render error");
}

export const WithDefaultFallback: Story = {
  render: () => (
    <ErrorBoundary onReset={action("reset")}>
      <BuggyComponent />
    </ErrorBoundary>
  ),
};

export const CustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-sm text-red-400">Custom fallback UI</p>
        </div>
      }
    >
      <BuggyComponent />
    </ErrorBoundary>
  ),
};
