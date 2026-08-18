import React, { useState } from "react";
import { Coins, ArrowUpRight, ShieldCheck } from "lucide-react";
import { PropertyPanelLayout } from "./PropertyPanelLayout";
import { GameProperty, BuildingLevel } from "../../../types/game.types";
import { usePropertyActions } from "../../../hooks/usePropertyActions";
import { abbreviateAddress } from "./shared";

interface OwnedPanelProps {
  property: GameProperty;
  viewerAddress: string;
  isConnected: boolean;
  onPropertyUpdate: (updated: GameProperty) => void;
  copyToClipboard: () => void;
  copied: boolean;
  coordinates: string;
  buildingLevel: BuildingLevel;
}

export const OwnedPanel: React.FC<OwnedPanelProps> = ({
  property,
  viewerAddress,
  isConnected,
  onPropertyUpdate,
  copyToClipboard,
  copied,
  coordinates,
  buildingLevel,
}) => {
  const [listPrice, setListPrice] = useState("");
  const {
    improveProperty,
    listForSale,
    claimIncome,
    pendingAction,
    error,
    success,
  } = usePropertyActions(
    property,
    onPropertyUpdate,
    viewerAddress,
    isConnected,
  );

  const theme = {
    bgGrad: "from-land-success/20 to-land-accent/5",
    border: "border-land-success/30",
    text: "text-land-success",
    glow: "shadow-land-success/10",
    badge: "bg-land-success/10 border-land-success text-land-success",
    title: "Owned by You",
  };

  const footer = (
    <div className="space-y-4">
      {/* Improve Button */}
      {buildingLevel < 3 ? (
        <div>
          <button
            onClick={improveProperty}
            disabled={!!pendingAction}
            className="w-full bg-gradient-to-r from-land-accent-fill to-tile-listed-fill hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-land-on-accent font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 border border-land-accent-fill/20"
          >
            <ArrowUpRight size={16} />
            Improve (Cost: {property.improveCost || 100} LAND)
          </button>
          <span className="text-[9px] text-land-fg-muted text-center block mt-1">
            Upgrades building to Level {buildingLevel + 1}
          </span>
        </div>
      ) : (
        <div className="text-center py-2.5 bg-land-surface/40 rounded-xl border border-land-border/80">
          <span className="text-[10px] text-land-fg-muted font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-land-accent" />
            Max Development Reached
          </span>
        </div>
      )}

      {/* List for Sale form */}
      <div className="p-3.5 bg-land-surface/60 rounded-xl border border-land-border space-y-2.5">
        <span className="text-[10px] font-bold text-land-fg-muted uppercase tracking-wider block">
          List for Sale
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = parseFloat(listPrice);
            if (!isNaN(p) && p > 0) {
              listForSale(p);
            }
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="Price (LAND)"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              disabled={!!pendingAction}
              className="w-full bg-land-bg border border-land-border focus:border-land-accent rounded-lg px-3 py-2 text-xs text-land-fg placeholder-land-fg-subtle focus:outline-none transition-colors"
              min="1"
            />
            <Coins
              size={12}
              className="absolute right-2.5 top-3 text-land-fg-subtle"
            />
          </div>
          <button
            type="submit"
            disabled={
              !!pendingAction || !listPrice || parseFloat(listPrice) <= 0
            }
            className="bg-land-surface-raised hover:bg-land-border-hover disabled:opacity-40 disabled:hover:bg-land-surface-raised text-land-fg font-semibold text-xs px-3.5 rounded-lg border border-land-border-hover transition-colors"
          >
            List
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <PropertyPanelLayout
      property={property}
      theme={theme}
      abbreviateAddress={abbreviateAddress}
      copyToClipboard={copyToClipboard}
      copied={copied}
      coordinates={coordinates}
      buildingLevel={buildingLevel}
      error={error}
      success={success}
      pendingAction={pendingAction}
      footer={footer}
    >
      {/* Accrued Rental Income */}
      <div className="bg-land-success/5 p-3.5 rounded-xl border border-land-success/20 mt-1 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-land-success/80 font-bold uppercase tracking-wider block">
            Accrued Rental Income
          </span>
          <span className="text-lg font-extrabold text-land-fg flex items-center gap-1.5 mt-0.5">
            <Coins size={16} className="text-land-success" />
            {property.earnedIncome ?? 0} LAND
          </span>
        </div>
        <button
          onClick={claimIncome}
          disabled={!!pendingAction || (property.earnedIncome ?? 0) <= 0}
          className="text-xs font-bold bg-land-success-fill hover:bg-land-success-fill/90 disabled:opacity-40 disabled:hover:bg-land-success-fill text-land-on-accent px-3 py-1.5 rounded-lg border border-land-success-fill/30 transition-all duration-200 shadow-md shadow-land-success-fill/10 flex items-center gap-1"
        >
          Claim
        </button>
      </div>
    </PropertyPanelLayout>
  );
};
