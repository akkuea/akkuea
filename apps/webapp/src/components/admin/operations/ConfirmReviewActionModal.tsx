"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { ReviewAction } from "@/services/api/adminOperations";

const actionLabels: Record<
  ReviewAction,
  { title: string; description: string; confirm: string }
> = {
  approve: {
    title: "Approve property",
    description:
      "This marks the asset as verified for marketplace eligibility and sets review status to approved. Confirm you have completed operational checks.",
    confirm: "Approve",
  },
  reject: {
    title: "Reject property",
    description:
      "The asset will remain off-market and owners will need a new submission. This action is recorded for audit.",
    confirm: "Reject",
  },
  request_changes: {
    title: "Request changes",
    description:
      "Sends the listing back to the owner with a request for updates. Review status becomes changes requested.",
    confirm: "Request changes",
  },
  hold: {
    title: "Place on operational hold",
    description:
      "Pauses launch readiness for this asset without rejecting it. Use for compliance or data gaps.",
    confirm: "Place on hold",
  },
};

interface ConfirmReviewActionModalProps {
  isOpen: boolean;
  action: ReviewAction | null;
  propertyName: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmReviewActionModal({
  isOpen,
  action,
  propertyName,
  isSubmitting,
  onCancel,
  onConfirm,
}: ConfirmReviewActionModalProps) {
  if (!action) return null;

  const copy = actionLabels[action];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={copy.title}
      description={propertyName}
      size="md"
    >
      <p className="mb-6 text-sm leading-relaxed text-zinc-400">
        {copy.description}
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="accent" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Working…" : copy.confirm}
        </Button>
      </div>
    </Modal>
  );
}
