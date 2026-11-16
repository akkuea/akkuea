import { getTranslations } from "next-intl/server";
import { GridBackground } from "@/components/landing";
import { ErrorBoundary } from "@/components/ui";
import { WhitelistReviewQueue } from "@/components/pilot/WhitelistReviewQueue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tReview = await getTranslations({
    locale,
    namespace: "Pilot.whitelistReview",
  });
  const tAdmin = await getTranslations({ locale, namespace: "PilotAdmin" });
  return {
    title: `${tReview("metaTitle")} | ${tAdmin("title")}`,
  };
}

export default async function PilotReviewWhitelistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Pilot.whitelistReview",
  });

  return (
    <div className="noise-bg w-full h-full min-h-screen relative py-20 px-[4%]">
      <GridBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          {t("pageTitle")}
        </h1>
        <ErrorBoundary>
          <WhitelistReviewQueue />
        </ErrorBoundary>
      </div>
    </div>
  );
}
