import { getTranslations } from "next-intl/server";
import { GridBackground } from "@/components/landing";
import { ErrorBoundary } from "@/components/ui";
import { WhitelistReviewQueue } from "@/components/pilot/WhitelistReviewQueue";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "PilotAdmin" });
  return {
    title: `Whitelist Review | ${t("title", { fallback: "Admin" })}`,
  };
}

export default function PilotReviewWhitelistPage() {
  return (
    <div className="noise-bg w-full h-full min-h-screen relative py-20 px-[4%]">
      <GridBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <h1 className="text-3xl font-bold text-white mb-8">Pilot Whitelist Queue</h1>
        <ErrorBoundary>
          <WhitelistReviewQueue />
        </ErrorBoundary>
      </div>
    </div>
  );
}
