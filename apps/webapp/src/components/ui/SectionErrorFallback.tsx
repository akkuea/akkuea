"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

interface SectionErrorFallbackProps {
  /** Called when the user clicks "Retry". */
  onReset?: () => void;
  /** Optional custom message. Defaults to "This section couldn't load". */
  message?: string;
}

/**
 * A compact, card-based inline error fallback for wrapping individual sections
 * within a page. Use this instead of `<PageErrorFallback>` when you want to
 * show an error for a subsection (e.g., stats grid, properties list) without
 * replacing the entire page content.
 */
export function SectionErrorFallback({
  onReset,
  message = "This section couldn't load",
}: SectionErrorFallbackProps) {
  return (
    <Card variant="bordered" className="py-8">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{message}</p>
          <p className="text-xs text-neutral-500 mt-1">
            An unexpected error occurred in this section.
          </p>
        </div>
        {onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Retry
          </Button>
        )}
      </div>
    </Card>
  );
}
