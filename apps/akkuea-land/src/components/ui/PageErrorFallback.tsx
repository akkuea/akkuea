"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/routing";

interface PageErrorFallbackProps {
  /** Segment-specific heading, e.g. "The city map couldn't load". */
  title: string;
  /** Segment-specific description of what happened. */
  description: string;
  /** Called when the user clicks "Try again". */
  onReset?: () => void;
}

/**
 * Full-page error fallback for Akkuea Land route segments, styled with the
 * `--land-*` token layer so it reads as the same product as the rest of the
 * game (mirrors the webapp's PageErrorFallback, which cannot be imported
 * directly since Akkuea Land does not consume the webapp's component
 * library, only its design tokens).
 */
export function PageErrorFallback({
  title,
  description,
  onReset,
}: PageErrorFallbackProps) {
  const t = useTranslations("Errors.page");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-lg bg-land-danger/10 border border-land-danger/20 flex items-center justify-center mb-6">
        <AlertTriangle
          className="w-8 h-8 text-land-danger"
          aria-hidden="true"
        />
      </div>

      <h2 className="text-2xl font-bold text-land-fg mb-3">{title}</h2>

      <p className="text-sm text-land-fg-muted max-w-md mb-8">{description}</p>

      <div className="flex items-center gap-3">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 bg-land-accent-fill hover:bg-land-accent-fill/90 text-land-on-accent font-bold py-2.5 px-5 rounded-xl text-sm transition-colors"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t("retry")}
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-land-border hover:border-land-border-hover text-land-fg font-bold py-2.5 px-5 rounded-xl text-sm transition-colors"
        >
          <Home size={14} aria-hidden="true" />
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
