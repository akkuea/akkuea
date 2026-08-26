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
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-land-border">
        {/* Top Section: Miniature tile preview and status badge */}
        <div
          className={`relative p-5 rounded-2xl border bg-gradient-to-br ${theme.bgGrad} ${theme.border} shadow-lg ${theme.glow} transition-all duration-300 overflow-hidden group`}
        >
          <div className="absolute -right-6 -bottom-6 text-land-fg-muted/10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
            <Sparkles size={110} />
          </div>

          {/* Grid Preview Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(var(--land-border)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-land-fg group-hover:text-land-accent transition-colors duration-200">
                  {property.name}
                </h3>
                <div className="flex items-center gap-1 text-[11px] text-land-fg-muted mt-1 font-medium">
                  <MapPin size={12} className="text-land-fg-muted" />
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
            <div className="flex justify-between items-center bg-land-bg/60 p-2.5 rounded-lg border border-land-border/60 text-xs mt-1">
              <span className="text-land-fg-muted font-medium">
                Coordinates
              </span>
              <span className="font-mono text-land-accent font-semibold">
                {coordinates}
              </span>
            </div>

            {/* Owner Address Section with Copy Option */}
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-land-fg-muted font-medium flex items-center gap-1.5">
                <User size={13} className="text-land-fg-muted" />
                Owner
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-land-fg font-medium bg-land-surface/80 px-2 py-0.5 rounded border border-land-border/60">
                  {abbreviateAddress(property.owner)}
                </span>
                {property.owner && (
                  <button
                    onClick={copyToClipboard}
                    className="p-1 rounded bg-land-surface hover:bg-land-surface-raised text-land-fg-muted hover:text-land-fg border border-land-border/80 transition-colors"
                    title="Copy Address"
                  >
                    {copied ? (
                      <Check size={11} className="text-land-success" />
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
          <div className="bg-land-danger/5 border border-land-danger/20 text-land-danger text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fadeIn">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-land-danger shrink-0" />
            <div>
              <span className="font-bold text-land-danger block mb-0.5">
                Transaction Error
              </span>
              <span className="text-land-danger/90 leading-relaxed">
                {error}
              </span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-land-success/5 border border-land-success/20 text-land-success text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fadeIn">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-land-success shrink-0" />
            <div>
              <span className="font-bold text-land-success block mb-0.5">
                Success!
              </span>
              <span className="text-land-success/90 leading-relaxed">
                {success}
              </span>
            </div>
          </div>
        )}

        {/* Pending details state string */}
        {pendingAction && (
          <div className="bg-land-surface border border-land-border text-xs p-4 rounded-xl flex flex-col items-center justify-center gap-3 text-center animate-pulse">
            <div className="w-5 h-5 border-2 border-land-accent border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <span className="font-bold text-land-fg block text-xs uppercase tracking-wider">
                Processing Blockchain Tx
              </span>
              <p className="text-[11px] text-land-fg-muted font-medium px-4">
                {pendingAction}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Action flows contextually rendered */}
      <div className="px-5 py-4 border-t border-land-border/60 bg-land-bg/80">
        {footer}
      </div>
    </>
  );
};
