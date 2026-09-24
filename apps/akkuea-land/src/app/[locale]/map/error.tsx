"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { GameShell } from "@/components/layout/GameShell";
import { PageErrorFallback } from "@/components/ui";

export default function MapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error("[MapError]", error);
  }, [error]);

  return (
    <GameShell>
      <PageErrorFallback
        title={t("map.title")}
        description={t("map.description")}
        onReset={reset}
      />
    </GameShell>
  );
}
