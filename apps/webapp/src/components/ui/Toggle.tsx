"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizes = {
  sm: { track: "w-8 h-5", thumb: "w-3 h-3", translate: "translate-x-3.5" },
  md: { track: "w-11 h-6", thumb: "w-4 h-4", translate: "translate-x-5" },
  lg: { track: "w-14 h-7", thumb: "w-5 h-5", translate: "translate-x-7" },
};

export function Toggle({
  enabled,
  onChange,
  label,
  description,
  size = "md",
  disabled = false,
}: ToggleProps) {
  const { track, thumb, translate } = sizes[size];

  const labelId = useId();
  const descriptionId = useId();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(!enabled);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={!label ? "Toggle" : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
          track,
          enabled ? "bg-emerald-500" : "bg-zinc-700",
          disabled && "cursor-not-allowed",
        )}
      >
        <motion.span
          layout
          className={cn(
            "inline-block rounded-full bg-white shadow-lg",
            thumb,
            "ml-1",
          )}
          animate={{ x: enabled ? parseInt(translate.split("-x-")[1]) * 4 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>

      {(label || description) && (
        <div className="flex flex-col select-none">
          {label && (
            <span id={labelId} className="text-sm font-medium text-white">
              {label}
            </span>
          )}
          {description && (
            <span id={descriptionId} className="text-xs text-zinc-500">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
