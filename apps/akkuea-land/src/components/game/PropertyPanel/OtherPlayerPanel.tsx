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
    bgGrad: "from-land-surface-raised/10 to-land-surface-raised/5",
    border: "border-land-border",
    text: "text-land-fg-muted",
    glow: "shadow-none",
    badge: "bg-land-bg/80 border-land-border text-land-fg-muted",
    title: "Other Player Property",
  };

  const footer = (
    <div className="text-center p-3.5 bg-land-surface/60 rounded-2xl border border-land-border/80 space-y-1.5">
      <span className="text-xs font-bold text-land-fg">
        Property Not for Sale
      </span>
      <p className="text-[10px] text-land-fg-muted leading-normal">
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
