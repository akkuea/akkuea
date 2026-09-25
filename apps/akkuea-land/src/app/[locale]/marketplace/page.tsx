import { getTranslations } from "next-intl/server";
import { GameShell } from "@/components/layout/GameShell";
import { MarketplaceBody } from "./MarketplaceBody";

export async function generateMetadata() {
  const t = await getTranslations("Marketplace");
  return {
    title: t("pageTitle"),
  };
}

export default function MarketplacePage() {
  return (
    <GameShell>
      <MarketplaceBody />
    </GameShell>
  );
}
