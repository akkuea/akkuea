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
    bgGrad: "from-purple-500/20 to-indigo-500/5",
    border: "border-purple-500/30",
    text: "text-purple-400",
    glow: "shadow-purple-500/10",
    badge: "bg-purple-950/80 border-purple-800 text-purple-300",
    title: "Listed for Sale",
  };

  const footer = (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">Asking Price</span>
        <span className="text-sm font-extrabold text-white flex items-center gap-1">
          <Coins size={14} className="text-purple-400" />
          {property.pricePerShare} LAND
        </span>
      </div>
      <button
        onClick={buyFromPlayer}
        disabled={!!pendingAction}
        className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-purple-500/5 flex items-center justify-center gap-2 border border-purple-400/20"
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
