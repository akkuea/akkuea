"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/routing";

/** Toggles between the app's supported locales, mirroring the webapp's LanguageSelector. */
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const toggleLocale = () => {
    const nextLocale = locale === "en" ? "es" : "en";
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <button
      type="button"
      onClick={toggleLocale}
      disabled={isPending}
      aria-label={t("toggleLanguage")}
      title={t("toggleLanguage")}
      className="flex items-center justify-center gap-1 h-8 px-2 rounded-lg border border-land-border text-land-fg-muted hover:text-land-fg hover:border-land-border-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Globe size={14} aria-hidden="true" />
      <span className="text-xs font-mono uppercase">{locale}</span>
    </button>
  );
}
