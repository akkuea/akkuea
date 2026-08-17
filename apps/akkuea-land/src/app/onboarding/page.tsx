"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameWallet } from "@/hooks/useGameWallet";
import { onboarding } from "@/lib/onboarding";
import { WelcomeStep } from "@/components/game/onboarding/WelcomeStep";
import { ClaimLandStep } from "@/components/game/onboarding/ClaimLandStep";
import { ClaimPropertyStep } from "@/components/game/onboarding/ClaimPropertyStep";
import { motion, AnimatePresence } from "framer-motion";

type Step = "welcome" | "claim-land" | "claim-property";

const STEPS: Step[] = ["welcome", "claim-land", "claim-property"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const { address } = useGameWallet();
  const router = useRouter();

  const complete = () => {
    if (address) {
      onboarding.markComplete(address);
    }
    router.replace("/");
  };

  const skipAll = () => complete();

  return (
    <div className="flex min-h-screen items-center justify-center bg-land-bg px-4 py-12 relative overflow-hidden font-game">
      {/* Visual background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-land-accent/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg bg-land-surface/40 border border-land-border backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-2xl relative z-10">
        {/* Progress + Skip */}
        <div className="mb-10 flex items-center justify-between border-b border-land-border/40 pb-5">
          <StepDots current={step} steps={STEPS} />
          <button
            onClick={skipAll}
            className="text-xs text-land-fg-muted hover:text-land-fg transition duration-150 font-bold uppercase tracking-wider"
          >
            Skip setup
          </button>
        </div>

        <div className="min-h-[320px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <WelcomeStep key="welcome" onNext={() => setStep("claim-land")} />
            )}
            {step === "claim-land" && (
              <ClaimLandStep
                key="claim-land"
                onNext={() => setStep("claim-property")}
                onSkip={() => setStep("claim-property")}
              />
            )}
            {step === "claim-property" && (
              <ClaimPropertyStep
                key="claim-property"
                onComplete={complete}
                onSkip={complete}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepDots({ current, steps }: { current: Step; steps: Step[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex gap-2">
      {steps.map((stepName, i) => (
        <div
          key={stepName}
          className={[
            "h-1.5 rounded-full transition-all duration-300",
            i <= idx ? "w-6 bg-land-accent" : "w-1.5 bg-land-surface-raised",
          ].join(" ")}
          title={`Step ${i + 1}: ${stepName}`}
        />
      ))}
    </div>
  );
}
