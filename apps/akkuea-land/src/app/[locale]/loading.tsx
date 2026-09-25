import { getTranslations } from "next-intl/server";

export default async function HomeLoading() {
  const t = await getTranslations("Loading");

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-land-bg flex flex-col items-center justify-center gap-6 p-8"
    >
      <span className="sr-only">{t("label")}</span>
      <div
        className="h-10 w-48 rounded-xl bg-land-surface animate-shimmer"
        aria-hidden="true"
      />
      <div
        className="h-5 w-72 rounded-lg bg-land-surface animate-shimmer"
        aria-hidden="true"
      />
      <div
        className="h-12 w-40 rounded-xl bg-land-surface animate-shimmer"
        aria-hidden="true"
      />
    </div>
  );
}
