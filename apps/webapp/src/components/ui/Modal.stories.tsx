import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const meta: Meta<typeof Modal> = {
  title: "UI/Modal",
  component: Modal,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg", "xl"] },
    showCloseButton: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

function ModalWrapper({
  children,
  ...props
}: Partial<React.ComponentProps<typeof Modal>>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button variant="accent" onClick={() => setIsOpen(true)}>
        Open Modal
      </Button>
      <Modal {...props} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        {children}
      </Modal>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <ModalWrapper
      title="Example Modal"
      description="This is a sample modal dialog."
    >
      <p className="text-sm text-neutral-300">
        Modal content goes here. You can put any React nodes inside.
      </p>
    </ModalWrapper>
  ),
};

export const Small: Story = {
  render: () => (
    <ModalWrapper title="Confirm Action" size="sm" description="Are you sure?">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button variant="danger" size="sm">
          Delete
        </Button>
      </div>
    </ModalWrapper>
  ),
};

export const Large: Story = {
  render: () => (
    <ModalWrapper
      title="Details"
      size="lg"
      description="Detailed information view."
    >
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-zinc-800/50" />
        ))}
      </div>
    </ModalWrapper>
  ),
};

export const NoCloseButton: Story = {
  render: () => (
    <ModalWrapper title="No Close Button" showCloseButton={false}>
      <p className="text-sm text-neutral-300">The close button is hidden.</p>
    </ModalWrapper>
  ),
};

export const WithoutDescription: Story = {
  render: () => (
    <ModalWrapper title="Simple Modal">
      <p className="text-sm text-neutral-300">A modal without a description.</p>
    </ModalWrapper>
  ),
};
