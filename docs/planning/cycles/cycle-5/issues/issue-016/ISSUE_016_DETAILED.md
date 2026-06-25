# C5-016: Build Player Onboarding and Starter Property Claim

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-016         |
| Area            | GAME           |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | C5-007, C5-008 |
| Estimated Lines | 300-400        |

## Onboarding Completion State

```typescript
// src/lib/onboarding.ts
const key = (address: string) => `akkuea-land:onboarded:${address}`;

export const onboarding = {
  isComplete: (address: string) =>
    typeof window !== "undefined" &&
    localStorage.getItem(key(address)) === "true",
  markComplete: (address: string) => localStorage.setItem(key(address), "true"),
};
```

## Trigger in Root Layout

After login, the app root layout checks onboarding state and redirects:

```typescript
// In src/app/layout.tsx (client wrapper)
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useGameWallet } from '@/hooks/useGameWallet';
import { onboarding } from '@/lib/onboarding';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useGameWallet();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      isConnected &&
      address &&
      !onboarding.isComplete(address) &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/login')
    ) {
      router.replace('/onboarding');
    }
  }, [isConnected, address, pathname]);

  return <>{children}</>;
}
```

## OnboardingFlow Component

```tsx
// src/app/onboarding/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameWallet } from "@/hooks/useGameWallet";
import { onboarding } from "@/lib/onboarding";
import { WelcomeStep } from "@/components/game/onboarding/WelcomeStep";
import { ClaimLandStep } from "@/components/game/onboarding/ClaimLandStep";
import { ClaimPropertyStep } from "@/components/game/onboarding/ClaimPropertyStep";

type Step = "welcome" | "claim-land" | "claim-property";

const STEPS: Step[] = ["welcome", "claim-land", "claim-property"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const { address } = useGameWallet();
  const router = useRouter();

  const complete = () => {
    if (address) onboarding.markComplete(address);
    router.replace("/map");
  };

  const skipAll = () => complete();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 p-4">
      <div className="w-full max-w-lg">
        {/* Progress + Skip */}
        <div className="mb-8 flex items-center justify-between">
          <StepDots current={step} steps={STEPS} />
          <button
            onClick={skipAll}
            className="text-xs text-surface-600 hover:text-white transition"
          >
            Skip setup
          </button>
        </div>

        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("claim-land")} />
        )}
        {step === "claim-land" && (
          <ClaimLandStep
            onNext={() => setStep("claim-property")}
            onSkip={() => setStep("claim-property")}
          />
        )}
        {step === "claim-property" && (
          <ClaimPropertyStep onComplete={complete} onSkip={complete} />
        )}
      </div>
    </div>
  );
}

function StepDots({ current, steps }: { current: Step; steps: Step[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex gap-2">
      {steps.map((_, i) => (
        <div
          key={i}
          className={[
            "h-1.5 rounded-full transition-all",
            i <= idx ? "w-6 bg-land-500" : "w-1.5 bg-surface-700",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
```

## WelcomeStep

```tsx
// src/components/game/onboarding/WelcomeStep.tsx
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      {/* City grid illustration: a 5x5 mini grid as visual */}
      <div
        className="mx-auto mb-8 grid gap-1 rounded-2xl bg-surface-800 p-4 w-fit"
        style={{ gridTemplateColumns: "repeat(5, 2.5rem)" }}
      >
        {SAMPLE_TILES.map((color, i) => (
          <div
            key={i}
            className="h-10 w-10 rounded-lg"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <h1 className="mb-3 text-3xl font-bold text-white">
        Welcome to Akkuea Land
      </h1>
      <p className="mb-3 text-sm text-surface-600 max-w-sm mx-auto">
        Buy virtual properties on Stellar. Earn passive income every few
        minutes. Trade with other players in a live marketplace.
      </p>
      <p className="mb-8 text-sm text-surface-600 max-w-sm mx-auto">
        Your Stellar wallet is already set up. You don't need to know anything
        about crypto to play.
      </p>
      <button
        onClick={onNext}
        className="rounded-xl bg-land-500 px-10 py-3.5 text-sm font-semibold text-white hover:bg-land-400 transition active:scale-95"
      >
        Get Started
      </button>
    </div>
  );
}

// Sample tile colors for the illustration
const SAMPLE_TILES = [
  "#2d2a85",
  "#4a47e8",
  "#2d2a85",
  "#5c63f5",
  "#2d2a85",
  "#5c63f5",
  "#3c36cf",
  "#4a47e8",
  "#2d2a85",
  "#3c36cf",
  "#2d2a85",
  "#5c63f5",
  "#4a47e8",
  "#3c36cf",
  "#5c63f5",
  "#3c36cf",
  "#2d2a85",
  "#5c63f5",
  "#4a47e8",
  "#2d2a85",
  "#4a47e8",
  "#3c36cf",
  "#2d2a85",
  "#5c63f5",
  "#3c36cf",
];
```

## ClaimLandStep

```tsx
// src/components/game/onboarding/ClaimLandStep.tsx
"use client";

import { useState } from "react";
import { useGameWallet } from "@/hooks/useGameWallet";

type Status = "idle" | "pending" | "done" | "error";

const STATUS_MESSAGE: Record<Status, string> = {
  idle: "Claim 1,000 LAND",
  pending: "Preparing your wallet on Stellar...",
  done: "1,000 LAND received!",
  error: "Something went wrong. Try again.",
};

export function ClaimLandStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const { signAndSubmitTx } = useGameWallet();
  const [status, setStatus] = useState<Status>("idle");

  const handleClaim = async () => {
    setStatus("pending");
    try {
      await signAndSubmitTx("placeholder-faucet-xdr"); // wired in C5-013
      setStatus("done");
      setTimeout(onNext, 1_200);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-land-500/10 text-3xl">
        L
      </div>
      <h2 className="mb-3 text-2xl font-bold text-white">
        Get your starter LAND
      </h2>
      <p className="mb-8 text-sm text-surface-600 max-w-sm mx-auto">
        LAND is the in-game currency. The testnet faucet gives new players 1,000
        LAND tokens. This is a one-time claim.
      </p>

      {status === "done" ? (
        <div className="rounded-xl bg-green-900/30 border border-green-700/40 p-4 mb-6">
          <p className="text-sm font-semibold text-green-400">
            1,000 LAND added to your wallet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={handleClaim}
            disabled={status === "pending"}
            className="w-full rounded-xl bg-land-500 py-3.5 text-sm font-semibold text-white hover:bg-land-400 disabled:opacity-60 transition"
          >
            {STATUS_MESSAGE[status]}
          </button>
          {status === "idle" && (
            <button
              onClick={onSkip}
              className="w-full text-xs text-surface-600 hover:text-white transition"
            >
              Skip this step
            </button>
          )}
          {status === "error" && (
            <button
              onClick={() => setStatus("idle")}
              className="w-full text-xs text-surface-600 hover:text-white"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

## ClaimPropertyStep

```tsx
// src/components/game/onboarding/ClaimPropertyStep.tsx
"use client";

import { useState } from "react";
import { useGameWallet } from "@/hooks/useGameWallet";
import { tileColor } from "@/lib/tileColors";

const STARTER_PROPERTIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // first 10 tiles

export function ClaimPropertyStep({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { signAndSubmitTx, address } = useGameWallet();
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "celebrating">(
    "idle",
  );

  const handleClaim = async () => {
    if (selected === null) return;
    setStatus("pending");
    try {
      await signAndSubmitTx("placeholder-starter-claim-xdr"); // wired in C5-013
      setStatus("celebrating");
      setTimeout(onComplete, 2_500);
    } catch {
      setStatus("idle");
    }
  };

  if (status === "celebrating") {
    return <CelebrationScreen />;
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-white text-center">
        Claim your first property
      </h2>
      <p className="mb-6 text-sm text-surface-600 text-center max-w-sm mx-auto">
        Pick any property below. It's yours free as a new player.
      </p>

      {/* Mini property grid */}
      <div className="mb-6 grid grid-cols-5 gap-2 mx-auto max-w-xs">
        {STARTER_PROPERTIES.map((id) => {
          const x = id % 20;
          const y = Math.floor(id / 20);
          const isSelected = selected === id;
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={[
                "aspect-square rounded-xl transition-all",
                "bg-surface-700 hover:scale-105",
                isSelected ? "ring-2 ring-white scale-110" : "",
              ].join(" ")}
            >
              <span className="text-xs text-white/50">
                {x},{y}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <button
          onClick={handleClaim}
          disabled={selected === null || status === "pending"}
          className="w-full rounded-xl bg-land-500 py-3.5 text-sm font-semibold text-white hover:bg-land-400 disabled:opacity-50 transition"
        >
          {status === "pending" ? "Claiming..." : "Claim Free Property"}
        </button>
        <button
          onClick={onSkip}
          className="w-full text-xs text-surface-600 hover:text-white transition"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}

function CelebrationScreen() {
  return (
    <div className="text-center animate-fade-in">
      <div className="mb-4 text-6xl">🎉</div>
      <h2 className="text-2xl font-bold text-white">You own a property!</h2>
      <p className="mt-2 text-sm text-surface-600">
        Heading to the city map...
      </p>
    </div>
  );
}
```

## Definition of Done

- Onboarding renders after first login and not on subsequent sessions.
- WelcomeStep, ClaimLandStep, and ClaimPropertyStep are functional.
- Faucet claim shows correct loading messages.
- Property selection and claim works end-to-end.
- Celebration animation plays after property claim.
- Skip works at every step.
- All CI workflows pass on the pull request.
