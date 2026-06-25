import React from "react";
import { PropertyPanelLayout } from "./PropertyPanelLayout";
import { GameProperty, BuildingLevel } from "../../../types/game.types";
import { abbreviateAddress } from "./shared";

interface OtherPlayerPanelProps {
  property: GameProperty;
  copyToClipboard: () => void;
  copied: boolean;
  coordinates: string;
  buildingLevel: BuildingLevel;
}

export const OtherPlayerPanel: React.FC<OtherPlayerPanelProps> = ({
  property,
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
    title: "Other Player Property",
  };

  const footer = (
    <div className="text-center p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-1.5">
      <span className="text-xs font-bold text-slate-300">
        Property Not for Sale
      </span>
      <p className="text-[10px] text-slate-500 leading-normal">
        This property is currently owned by another player and is not listed in
        the marketplace.
      </p>
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
