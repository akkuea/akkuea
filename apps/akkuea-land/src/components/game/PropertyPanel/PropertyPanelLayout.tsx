import React from "react";
import { BuildingLevelBar } from "./shared";
import { Coins, User, Check, Copy, MapPin, Sparkles } from "lucide-react";
import { GameProperty, BuildingLevel } from "../../../types/game.types";

interface PropertyPanelLayoutProps {
  property: GameProperty;
  theme: {
    bgGrad: string;
    border: string;
    glow: string;
    badge: string;
    title: string;
  };
  abbreviateAddress: (addr: string) => string;
  copyToClipboard: () => void;
  copied: boolean;
  coordinates: string;
  buildingLevel: BuildingLevel;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  error?: string | null;
  success?: string | null;
  pendingAction?: string | null;
}

export const PropertyPanelLayout: React.FC<PropertyPanelLayoutProps> = ({
  property,
  theme,
  abbreviateAddress,
  copyToClipboard,
  copied,
  coordinates,
  buildingLevel,
  children,
  footer,
  error,
  success,
  pendingAction,
}) => {
  return (
    <>
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Top Section: Miniature tile preview and status badge */}
        <div
          className={`relative p-5 rounded-2xl border bg-gradient-to-br ${theme.bgGrad} ${theme.border} shadow-lg ${theme.glow} transition-all duration-300 overflow-hidden group`}
        >
          <div className="absolute -right-6 -bottom-6 text-slate-500/10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
            <Sparkles size={110} />
          </div>

          {/* Grid Preview Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors duration-200">
                  {property.name}
                </h3>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1 font-medium">
                  <MapPin size={12} className="text-slate-500" />
                  <span>
                    {property.location.city}, {property.location.country}
                  </span>
                </div>
              </div>
              <span
                className={`text-[9px] px-2.5 py-1 rounded-full border font-extrabold tracking-wider uppercase ${theme.badge}`}
              >
                {theme.title}
              </span>
            </div>

            {/* Grid Location / Coords Bar */}
            <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/60 text-xs mt-1">
              <span className="text-slate-400 font-medium">Coordinates</span>
              <span className="font-mono text-indigo-400 font-semibold">
                {coordinates}
              </span>
            </div>

            {/* Owner Address Section with Copy Option */}
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <User size={13} className="text-slate-500" />
                Owner
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-200 font-medium bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/60">
                  {abbreviateAddress(property.owner)}
                </span>
                {property.owner && (
                  <button
                    onClick={copyToClipboard}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors"
                    title="Copy Address"
                  >
                    {copied ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Building Level shown as a progression bar */}
            <BuildingLevelBar buildingLevel={buildingLevel} />

            {children}
          </div>
        </div>

        {/* Inline notification states */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fadeIn">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-rose-500 shrink-0" />
            <div>
              <span className="font-bold text-rose-200 block mb-0.5">
                Transaction Error
              </span>
              <span className="text-rose-300/90 leading-relaxed">
                {error}
              </span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fadeIn">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <span className="font-bold text-emerald-200 block mb-0.5">
                Success!
              </span>
              <span className="text-emerald-300/90 leading-relaxed">
                {success}
              </span>
            </div>
          </div>
        )}

        {/* Pending details state string */}
        {pendingAction && (
          <div className="bg-slate-900 border border-slate-800 text-xs p-4 rounded-xl flex flex-col items-center justify-center gap-3 text-center animate-pulse">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                Processing Blockchain Tx
              </span>
              <p className="text-[11px] text-slate-400 font-medium px-4">
                {pendingAction}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Action flows contextually rendered */}
      <div className="px-5 py-4 border-t border-slate-900/60 bg-slate-950/80">
        {footer}
      </div>
    </>
  );
};
