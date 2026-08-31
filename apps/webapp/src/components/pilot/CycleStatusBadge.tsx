"use client";

import { useTranslations } from "next-intl";
import type { PilotCycleStatus } from "@real-estate-defi/shared";
import { Badge } from "@/components/ui";

/**
 * Status vocabulary for a single income cycle.
 *
 * Kept in one place so the timeline, the review queue, and the holdings summary
 * cannot drift into describing the same on-chain fact differently.
 */
const STATUS_VARIANTS: Record<
  PilotCycleStatus,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  on_time: "success",
  late: "warning",
  disputed: "danger",
  not_received: "danger",
  pending: "info",
};

interface CycleStatusBadgeProps {
  status: PilotCycleStatus;
  className?: string;
}

export function CycleStatusBadge({ status, className }: CycleStatusBadgeProps) {
  const t = useTranslations("Pilot");

  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className} dot>
      {t(`cycleStatus.${status}`)}
    </Badge>
  );
}
