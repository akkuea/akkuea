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
    bgGrad: "from-amber-500/20 to-orange-500/5",
    border: "border-amber-500/30",
    text: "text-amber-400",
    glow: "shadow-amber-500/10",
    badge: "bg-amber-950/80 border-amber-800 text-amber-300",
    title: "Treasury Property",
  };

  const footer = (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">
          Treasury Cost
        </span>
        <span className="text-sm font-extrabold text-white flex items-center gap-1">
          <Coins size={14} className="text-amber-400" />
          {property.pricePerShare} LAND
        </span>
      </div>
      <button
        onClick={buyFromTreasury}
        disabled={!!pendingAction}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-amber-500/5 flex items-center justify-center gap-2 border border-amber-400/20"
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
