"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageErrorFallback } from "@/components/ui";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error("[LoginError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-land-bg">
      <PageErrorFallback
        title={t("login.title")}
        description={t("login.description")}
        onReset={reset}
      />
    </div>
  );
}
