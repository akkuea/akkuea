import React from "react";
import { Coins } from "lucide-react";
import { PropertyPanelLayout } from "./PropertyPanelLayout";
import { GameProperty, BuildingLevel } from "../../../types/game.types";
import { usePropertyActions } from "../../../hooks/usePropertyActions";
import { abbreviateAddress } from "./shared";

interface ListedPanelProps {
  property: GameProperty;
  viewerAddress: string;
  isConnected: boolean;
  onPropertyUpdate: (updated: GameProperty) => void;
  copyToClipboard: () => void;
  copied: boolean;
  coordinates: string;
  buildingLevel: BuildingLevel;
}

export const ListedPanel: React.FC<ListedPanelProps> = ({
  property,
  viewerAddress,
  isConnected,
  onPropertyUpdate,
  copyToClipboard,
  copied,
  coordinates,
  buildingLevel,
}) => {
  const { buyFromPlayer, pendingAction, error, success } = usePropertyActions(
    property,
    onPropertyUpdate,
    viewerAddress,
    isConnected,
  );

  const theme = {
    bgGrad: "from-tile-listed/20 to-land-accent/5",
    border: "border-tile-listed/30",
    text: "text-tile-listed",
    glow: "shadow-tile-listed/10",
    badge: "bg-tile-listed/10 border-tile-listed text-tile-listed",
    title: "Listed for Sale",
  };

  const footer = (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-land-surface/50 p-3 rounded-xl border border-land-border">
        <span className="text-xs text-land-fg-muted font-medium">Asking Price</span>
        <span className="text-sm font-extrabold text-land-fg flex items-center gap-1">
          <Coins size={14} className="text-tile-listed" />
          {property.pricePerShare} LAND
        </span>
      </div>
      <button
        onClick={buyFromPlayer}
        disabled={!!pendingAction}
        className="w-full bg-gradient-to-r from-tile-listed to-land-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-land-bg font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-tile-listed/5 flex items-center justify-center gap-2 border border-tile-listed/20"
      >
        Buy Land Tile
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
