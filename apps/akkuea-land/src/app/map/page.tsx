import { GameShell } from "@/components/layout/GameShell";
import { CityMap } from "@/components/game/CityMap";

export const metadata = {
  title: "City Map | Akkuea Land",
  description:
    "Explore the 20×20 Akkuea City grid. Discover, select, and trade virtual land parcels.",
};

export default function MapPage() {
  return (
    <GameShell>
      <CityMap />
    </GameShell>
  );
}
