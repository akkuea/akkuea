"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { GameShell } from "@/components/layout/GameShell";
import { PageErrorFallback } from "@/components/ui";

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error("[MarketplaceError]", error);
  }, [error]);

  return (
    <GameShell>
      <PageErrorFallback
        title={t("marketplace.title")}
        description={t("marketplace.description")}
        onReset={reset}
      />
    </GameShell>
  );
}
