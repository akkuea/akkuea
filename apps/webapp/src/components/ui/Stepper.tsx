"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  /** Optional: pass this to let users navigate back to completed steps via click or keyboard. */
  onStepClick?: (index: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps) {
  const isInteractive = typeof onStepClick === "function";
  const [focusedIndex, setFocusedIndex] = useState(currentStep);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  function canNavigateTo(index: number) {
    return isInteractive && index < currentStep;
  }

  function focusStep(index: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    setFocusedIndex(clamped);
    stepRefs.current[clamped]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (!isInteractive) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusStep(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusStep(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusStep(0);
        break;
      case "End":
        e.preventDefault();
        focusStep(steps.length - 1);
        break;
      case "Enter":
      case " ":
        if (canNavigateTo(index)) {
          e.preventDefault();
          onStepClick?.(index);
        }
        break;
    }
  }

  return (
    <nav aria-label="Form progress" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between list-none p-0 m-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const clickable = canNavigateTo(index);

          const circle = (
            <motion.div
              initial={false}
              animate={{
                scale: isActive ? 1.1 : 1,
                backgroundColor:
                  isCompleted || isActive
                    ? "rgb(16, 185, 129)"
                    : "rgb(39, 39, 42)",
              }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                isCompleted
                  ? "border-emerald-500"
                  : isActive
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/30"
                    : "border-zinc-700",
              )}
            >
              {isCompleted ? (
                <Check className="w-5 h-5 text-white" aria-hidden="true" />
              ) : (
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? "text-white" : "text-zinc-500",
                  )}
                >
                  {index + 1}
                </span>
              )}
            </motion.div>
          );

          const labelBlock = (
            <div className="mt-2 text-center">
              <p
                className={cn(
                  "text-sm font-medium",
                  index <= currentStep ? "text-white" : "text-zinc-500",
                )}
              >
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-zinc-500 mt-0.5 hidden sm:block">
                  {step.description}
                </p>
              )}
            </div>
          );

          return (
            <li
              key={step.id}
              className="flex items-center flex-1"
              aria-current={isActive ? "step" : undefined}
            >
              {isInteractive ? (
                <button
                  type="button"
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  tabIndex={index === focusedIndex ? 0 : -1}
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick?.(index)}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  aria-label={`${step.title}${
                    isCompleted
                      ? " (completed)"
                      : isActive
                        ? " (current step)"
                        : " (upcoming)"
                  }`}
                  className={cn(
                    "flex flex-col items-center rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                    clickable ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  {circle}
                  {labelBlock}
                </button>
              ) : (
                <div
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  className="flex flex-col items-center rounded-xl p-1"
                >
                  {circle}
                  {labelBlock}
                </div>
              )}

              {index < steps.length - 1 && (
                <div
                  className="flex-1 mx-4 h-0.5 bg-zinc-800 relative"
                  aria-hidden="true"
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isCompleted ? "100%" : "0%" }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-emerald-500"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
