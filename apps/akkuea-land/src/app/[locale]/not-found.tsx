"use client";

import { useTranslations } from "next-intl";
import { Compass, Home } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function NotFound() {
  const t = useTranslations("Errors.notFound");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-lg bg-land-accent/10 border border-land-accent/20 flex items-center justify-center mb-6">
        <Compass className="w-8 h-8 text-land-accent" aria-hidden="true" />
      </div>

      <h2 className="text-2xl font-bold text-land-fg mb-3">{t("title")}</h2>

      <p className="text-sm text-land-fg-muted max-w-md mb-8">
        {t("description")}
      </p>

      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-land-accent-fill hover:bg-land-accent-fill/90 text-land-on-accent font-bold py-2.5 px-5 rounded-xl text-sm transition-colors"
      >
        <Home size={14} aria-hidden="true" />
        {t("backHome")}
      </Link>
    </div>
  );
}
