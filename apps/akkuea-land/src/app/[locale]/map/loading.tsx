import { getTranslations } from "next-intl/server";

export default async function MapLoading() {
  const t = await getTranslations("Loading");

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-land-bg flex flex-col"
    >
      <span className="sr-only">{t("label")}</span>
      {/* Nav skeleton */}
      <div
        className="h-14 bg-land-surface border-b border-land-border animate-shimmer"
        aria-hidden="true"
      />
      {/* Tile grid skeleton */}
      <div className="flex-1 p-6" aria-hidden="true">
        <div className="tile-grid">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="w-[var(--tile-size)] h-[var(--tile-size)] rounded-[var(--tile-radius)] bg-land-surface animate-shimmer"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
