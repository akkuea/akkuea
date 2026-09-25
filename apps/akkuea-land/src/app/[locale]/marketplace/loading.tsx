import { getTranslations } from "next-intl/server";

export default async function MarketplaceLoading() {
  const t = await getTranslations("Loading");

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-land-bg flex flex-col"
    >
      <span className="sr-only">{t("label")}</span>
      <div
        className="h-14 bg-land-surface border-b border-land-border animate-shimmer"
        aria-hidden="true"
      />
      <div
        className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        aria-hidden="true"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl bg-land-surface animate-shimmer"
          />
        ))}
      </div>
    </div>
  );
}
