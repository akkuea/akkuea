import { GameShell } from "@/components/layout/GameShell";

export const metadata = {
  title: "Marketplace | Akkuea Land",
};

export default function MarketplacePage() {
  return (
    <GameShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h1 className="text-2xl font-bold text-land-fg">Marketplace</h1>
        <p className="text-land-fg-muted">
          Listed land parcels and active auctions will appear here.
        </p>
      </div>
    </GameShell>
  );
}
