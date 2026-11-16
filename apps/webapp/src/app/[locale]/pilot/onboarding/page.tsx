import { getTranslations } from "next-intl/server";
import { GridBackground } from "@/components/landing";
import { ErrorBoundary } from "@/components/ui";
import { WhitelistOnboardingForm } from "@/components/pilot/WhitelistOnboardingForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Pilot.whitelistOnboarding",
  });
  return {
    title: t("metaTitle"),
  };
}

export default async function PilotOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Pilot.whitelistOnboarding",
  });

  return (
    <section
      aria-label={t("title")}
      className="noise-bg w-full h-full min-h-screen relative flex items-center justify-center py-20 px-[4%]"
    >
      <GridBackground />
      <ErrorBoundary>
        <WhitelistOnboardingForm />
      </ErrorBoundary>
    </section>
  );
}
