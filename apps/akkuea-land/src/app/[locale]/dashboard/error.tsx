"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageErrorFallback } from "@/components/ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-land-bg">
      <PageErrorFallback
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        onReset={reset}
      />
    </div>
  );
}
