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
    bgGrad: "from-land-surface-raised/10 to-land-surface-raised/5",
    border: "border-land-border",
    text: "text-land-fg-muted",
    glow: "shadow-none",
    badge: "bg-land-bg/80 border-land-border text-land-fg-muted",
    title: "Unowned Tile",
  };

  const footer = (
    <div className="space-y-3">
      <div className="text-center p-3.5 bg-land-surface/60 rounded-2xl border border-land-border/80 space-y-1.5">
        <span className="text-xs font-bold text-land-fg flex items-center justify-center gap-1.5">
          <Wallet size={14} className="text-land-accent" />
          Stellar Wallet Required
        </span>
        <p className="text-[10px] text-land-fg-muted leading-normal">
          Connect your Stellar wallet to purchase tiles, make improvements, or
          claim rental incomes.
        </p>
      </div>
      <button
        onClick={onConnect}
        className="w-full bg-gradient-to-r from-land-accent to-tile-listed hover:opacity-90 text-land-bg font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-land-accent/10 flex items-center justify-center gap-2 border border-land-accent/20 active:scale-98"
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
