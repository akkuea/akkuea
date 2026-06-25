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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden font-sans">
      {/* Visual background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/40 border border-slate-900 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-2xl relative z-10">
        {/* Progress + Skip */}
        <div className="mb-10 flex items-center justify-between border-b border-slate-800/40 pb-5">
          <StepDots current={step} steps={STEPS} />
          <button
            onClick={skipAll}
            className="text-xs text-slate-400 hover:text-white transition duration-150 font-bold uppercase tracking-wider"
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
          key={i}
          className={[
            "h-1.5 rounded-full transition-all duration-300",
            i <= idx ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-800",
          ].join(" ")}
          title={`Step ${i + 1}: ${stepName}`}
        />
      ))}
    </div>
  );
}
