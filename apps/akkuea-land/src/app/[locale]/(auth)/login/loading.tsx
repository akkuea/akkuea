import { getTranslations } from "next-intl/server";

export default async function LoginLoading() {
  const t = await getTranslations("Loading");

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-land-bg flex items-center justify-center p-4"
    >
      <span className="sr-only">{t("label")}</span>
      <div
        className="w-full max-w-sm bg-land-surface border border-land-border rounded-2xl p-8 space-y-4"
        aria-hidden="true"
      >
        <div className="h-8 rounded-lg bg-land-surface-raised animate-shimmer" />
        <div className="h-4 rounded bg-land-surface-raised animate-shimmer w-2/3 mx-auto" />
        <div className="h-12 rounded-xl bg-land-surface-raised animate-shimmer mt-4" />
      </div>
    </div>
  );
}
