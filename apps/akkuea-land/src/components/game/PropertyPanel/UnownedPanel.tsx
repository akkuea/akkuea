import React from "react";
import { Coins } from "lucide-react";
import { PropertyPanelLayout } from "./PropertyPanelLayout";
import { GameProperty, BuildingLevel } from "../../../types/game.types";
import { usePropertyActions } from "../../../hooks/usePropertyActions";
import { abbreviateAddress } from "./shared";

interface UnownedPanelProps {
  property: GameProperty;
  viewerAddress: string;
  isConnected: boolean;
  onPropertyUpdate: (updated: GameProperty) => void;
  copyToClipboard: () => void;
  copied: boolean;
  coordinates: string;
  buildingLevel: BuildingLevel;
}

export const UnownedPanel: React.FC<UnownedPanelProps> = ({
  property,
  viewerAddress,
  isConnected,
  onPropertyUpdate,
  copyToClipboard,
  copied,
  coordinates,
  buildingLevel,
}) => {
  const { buyFromTreasury, pendingAction, error, success } = usePropertyActions(
    property,
    onPropertyUpdate,
    viewerAddress,
    isConnected,
  );

  const theme = {
    bgGrad: "from-land-gold/20 to-land-gold/5",
    border: "border-land-gold/30",
    text: "text-land-gold",
    glow: "shadow-land-gold/10",
    badge: "bg-land-gold/10 border-land-gold text-land-gold",
    title: "Treasury Property",
  };

  const footer = (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-land-surface/50 p-3 rounded-xl border border-land-border">
        <span className="text-xs text-land-fg-muted font-medium">
          Treasury Cost
        </span>
        <span className="text-sm font-extrabold text-land-fg flex items-center gap-1">
          <Coins size={14} className="text-land-gold" />
          {property.pricePerShare} LAND
        </span>
      </div>
      <button
        onClick={buyFromTreasury}
        disabled={!!pendingAction}
        className="w-full bg-gradient-to-r from-land-gold to-land-warning hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-land-bg font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-land-gold/5 flex items-center justify-center gap-2 border border-land-gold/20"
      >
        Buy from Treasury
      </button>
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
    />
  );
};
