"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageErrorFallback } from "@/components/ui";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors.page");

  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-land-bg">
      <PageErrorFallback
        title={t("title")}
        description={t("description")}
        onReset={reset}
      />
    </div>
  );
}
