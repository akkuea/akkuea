"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
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
      onClick={toggleLocale}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
        "text-neutral-500 hover:text-white hover:bg-[#1a1a1a]",
        isPending && "opacity-50 cursor-not-allowed"
      )}
      aria-label="Toggle language"
    >
      <Globe className="w-3.5 h-3.5" />
      <span className="uppercase">{locale}</span>
    </button>
  );
}
