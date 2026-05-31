"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useGameWallet } from "@/hooks/useGameWallet";
import { onboarding } from "@/lib/onboarding";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useGameWallet();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      isConnected &&
      address &&
      !onboarding.isComplete(address) &&
      !pathname.startsWith("/onboarding") &&
      !pathname.startsWith("/login")
    ) {
      router.replace("/onboarding");
    }
  }, [isConnected, address, pathname, router]);

  return <>{children}</>;
}
