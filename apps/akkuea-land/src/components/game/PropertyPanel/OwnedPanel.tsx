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
    bgGrad: "from-emerald-500/20 to-teal-500/5",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/10",
    badge: "bg-emerald-950/80 border-emerald-800 text-emerald-300",
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
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 border border-indigo-400/20"
          >
            <ArrowUpRight size={16} />
            Improve (Cost: {property.improveCost || 100} LAND)
          </button>
          <span className="text-[9px] text-slate-500 text-center block mt-1">
            Upgrades building to Level {buildingLevel + 1}
          </span>
        </div>
      ) : (
        <div className="text-center py-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-teal-400" />
            Max Development Reached
          </span>
        </div>
      )}

      {/* List for Sale form */}
      <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
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
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
              min="1"
            />
            <Coins
              size={12}
              className="absolute right-2.5 top-3 text-slate-600"
            />
          </div>
          <button
            type="submit"
            disabled={
              !!pendingAction || !listPrice || parseFloat(listPrice) <= 0
            }
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs px-3.5 rounded-lg border border-slate-750 transition-colors"
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
      <div className="bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-500/20 mt-1 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider block">
            Accrued Rental Income
          </span>
          <span className="text-lg font-extrabold text-white flex items-center gap-1.5 mt-0.5">
            <Coins size={16} className="text-emerald-400" />
            {property.earnedIncome ?? 0} LAND
          </span>
        </div>
        <button
          onClick={claimIncome}
          disabled={!!pendingAction || (property.earnedIncome ?? 0) <= 0}
          className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-lg border border-emerald-400/30 transition-all duration-200 shadow-md shadow-emerald-500/10 flex items-center gap-1"
        >
          Claim
        </button>
      </div>
    </PropertyPanelLayout>
  );
};
