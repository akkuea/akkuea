import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { GridBackground } from "@/components/landing";
import { ErrorBoundary } from "@/components/ui";
import { WhitelistReviewQueue } from "@/components/pilot/WhitelistReviewQueue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pilot" });
  const tAdmin = await getTranslations({ locale, namespace: "PilotAdmin" });
  return {
    title: `${t("whitelist.review.metadataTitle")} | ${tAdmin("title")}`,
  };
}

export default function PilotReviewWhitelistPage() {
  const t = useTranslations("Pilot.whitelist.review");

  return (
    <div className="noise-bg w-full h-full min-h-screen relative py-20 px-[4%]">
      <GridBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <h1 className="text-3xl font-bold text-white mb-8">{t("pageTitle")}</h1>
        <ErrorBoundary>
          <WhitelistReviewQueue />
        </ErrorBoundary>
      </div>
    </div>
  );
}
