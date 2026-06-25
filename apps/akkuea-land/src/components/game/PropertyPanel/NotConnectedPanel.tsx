import React from "react";
import { Wallet } from "lucide-react";
import { PropertyPanelLayout } from "./PropertyPanelLayout";
import { GameProperty, BuildingLevel } from "../../../types/game.types";
import { abbreviateAddress } from "./shared";

interface NotConnectedPanelProps {
  property: GameProperty;
  onConnect?: () => void;
  copyToClipboard: () => void;
  copied: boolean;
  coordinates: string;
  buildingLevel: BuildingLevel;
}

export const NotConnectedPanel: React.FC<NotConnectedPanelProps> = ({
  property,
  onConnect,
  copyToClipboard,
  copied,
  coordinates,
  buildingLevel,
}) => {
  const theme = {
    bgGrad: "from-slate-500/10 to-slate-500/5",
    border: "border-slate-800",
    text: "text-slate-400",
    glow: "shadow-none",
    badge: "bg-slate-950/80 border-slate-800 text-slate-400",
    title: "Unowned Tile",
  };

  const footer = (
    <div className="space-y-3">
      <div className="text-center p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-1.5">
        <span className="text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5">
          <Wallet size={14} className="text-indigo-400" />
          Stellar Wallet Required
        </span>
        <p className="text-[10px] text-slate-500 leading-normal">
          Connect your Stellar wallet to purchase tiles, make improvements, or
          claim rental incomes.
        </p>
      </div>
      <button
        onClick={onConnect}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 border border-indigo-400/20 active:scale-98"
      >
        <Wallet size={16} />
        Connect Wallet
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
      footer={footer}
    />
  );
};
