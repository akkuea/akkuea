import { getTranslations } from "next-intl/server";

export default async function DashboardLoading() {
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
      <div className="flex-1 p-6 space-y-4" aria-hidden="true">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-land-surface animate-shimmer"
            />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-land-surface animate-shimmer" />
      </div>
    </div>
  );
}
