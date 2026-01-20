"use client";

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
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: index === currentStep ? 1.1 : 1,
                  backgroundColor:
                    index < currentStep
                      ? "rgb(16, 185, 129)"
                      : index === currentStep
                        ? "rgb(16, 185, 129)"
                        : "rgb(39, 39, 42)",
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2",
                  index < currentStep
                    ? "border-emerald-500"
                    : index === currentStep
                      ? "border-emerald-500 shadow-lg shadow-emerald-500/30"
                      : "border-zinc-700",
                )}
              >
                {index < currentStep ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      index === currentStep ? "text-white" : "text-zinc-500",
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </motion.div>
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
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4 h-0.5 bg-zinc-800 relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: index < currentStep ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-emerald-500"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
