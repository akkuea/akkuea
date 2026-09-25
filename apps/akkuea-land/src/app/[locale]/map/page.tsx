import { getTranslations } from "next-intl/server";
import { GameShell } from "@/components/layout/GameShell";
import { CityMap } from "@/components/game/CityMap";

export async function generateMetadata() {
  const t = await getTranslations("Map");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default function MapPage() {
  return (
    <GameShell>
      <CityMap />
    </GameShell>
  );
}
