"use client";

import { useTranslations } from "next-intl";

export function MarketplaceBody() {
  const t = useTranslations("Marketplace");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-2xl font-bold text-land-fg">{t("heading")}</h1>
      <p className="text-land-fg-muted">{t("description")}</p>
    </div>
  );
}
