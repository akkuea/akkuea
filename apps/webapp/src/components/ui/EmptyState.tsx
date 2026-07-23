"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

interface EmptyStateProps {
  /** Defaults to a generic "Nothing here yet" message. */
  title?: string;
  description?: string;
  icon?: ReactNode;
  /** Optional action, e.g. "Clear filters". Omit for pages with no recovery action. */
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Card variant="bordered" className="py-12">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          {icon ?? (
            <Inbox className="w-5 h-5 text-neutral-500" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          {description && (
            <p className="text-xs text-neutral-500 mt-1">{description}</p>
          )}
        </div>
        {action && (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}
