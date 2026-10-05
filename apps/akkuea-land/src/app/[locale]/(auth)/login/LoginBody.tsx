"use client";

import { useTranslations } from "next-intl";

export function LoginBody() {
  const t = useTranslations("Login");

  return (
    <div className="min-h-screen bg-land-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-land-surface border border-land-border rounded-2xl p-8 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-land-fg">{t("heading")}</h1>
          <p className="text-land-fg-muted text-sm mt-1">{t("subtitle")}</p>
        </div>
        <button
          className="w-full py-3 rounded-xl bg-land-accent-fill text-land-on-accent font-bold text-sm hover:opacity-90 transition-opacity"
          type="button"
        >
          {t("connectWallet")}
        </button>
        <p className="text-center text-xs text-land-fg-subtle">
          {t("poweredBy")}
        </p>
      </div>
    </div>
  );
}
