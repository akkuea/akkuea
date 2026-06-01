"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  MapPin,
  Sparkles,
  RefreshCw,
  Coins,
  ArrowUpRight,
  User,
  ShieldCheck,
  Percent,
} from "lucide-react";
import { GameProperty, BuildingLevel, PropertyOwnershipState } from "../../types/game.types";
import { usePropertyActions } from "../../hooks/usePropertyActions";

export interface PropertyPanelProps {
  property: GameProperty;
  onPropertyUpdate: (updated: GameProperty) => void;
  viewerAddress: string | null;
  isConnected: boolean;
  onConnect?: () => void;
  onClose: () => void;
  buildingLevel?: BuildingLevel; // 9. Accept a buildingLevel: 0|1|2|3 prop
}

/**
 * Resolves the 5-state discriminated union for contextual ownership states.
 */
export const getOwnershipState = (
  property: GameProperty,
  viewerAddress: string | null | undefined,
  isConnected: boolean
): PropertyOwnershipState => {
  if (!isConnected || !viewerAddress) {
    return { type: "not_connected", property };
  }
  if (property.owner === viewerAddress) {
    return { type: "owned_by_viewer", property, viewerAddress };
  }
  // If owner is a known system/treasury address or empty
  const isTreasury =
    !property.owner ||
    property.owner === "GBTREASURY" ||
    property.owner.toLowerCase() === "treasury" ||
    property.owner.toLowerCase() === "system";
  if (isTreasury) {
    return { type: "unowned", property, viewerAddress };
  }
  return { type: "listed_by_other", property, viewerAddress };
};

/**
 * 9. Building development level progression bar (4 steps)
 */
export const BuildingLevelBar: React.FC<{ buildingLevel: BuildingLevel }> = ({ buildingLevel }) => {
  const steps = [
    { label: "Vacant", desc: "Level 0" },
    { label: "Residential", desc: "Level 1" },
    { label: "Commercial", desc: "Level 2" },
    { label: "Skyscraper", desc: "Level 3" },
  ];

  return (
    <div className="w-full bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
      <div className="text-[10px] font-semibold text-slate-400 mb-3 tracking-wider uppercase flex justify-between items-center">
        <span>Development Phase</span>
        <span className="text-xs font-bold text-indigo-400 bg-indigo-950/50 px-2.5 py-0.5 rounded-full border border-indigo-900/50">
          {steps[buildingLevel].label}
        </span>
      </div>
      <div className="relative flex justify-between items-center px-1">
        {/* Line Connector Background */}
        <div className="absolute left-3 right-3 top-3.5 h-[3px] bg-slate-800/80 rounded-full z-0">
          <div
            className="h-full bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${(buildingLevel / 3) * 100}%` }}
          />
        </div>

        {steps.map((step, idx) => {
          const isActive = idx <= buildingLevel;
          const isCurrent = idx === buildingLevel;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-all duration-300 ${
                  isCurrent
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-4 ring-indigo-950/60 scale-110 shadow-lg shadow-indigo-500/30"
                    : isActive
                    ? "bg-indigo-600 text-indigo-100"
                    : "bg-slate-900 text-slate-500 border border-slate-800"
                }`}
              >
                {idx}
              </div>
              <span
                className={`text-[9px] mt-1.5 font-semibold transition-colors duration-300 ${
                  isCurrent
                    ? "text-indigo-400 font-bold"
                    : isActive
                    ? "text-slate-300"
                    : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  property,
  onPropertyUpdate,
  viewerAddress,
  isConnected,
  onConnect,
  onClose,
  buildingLevel: buildingLevelProp,
}) => {
  // Use either the explicitly passed prop or fallback to the property state
  const buildingLevel =
    buildingLevelProp !== undefined ? buildingLevelProp : property.buildingLevel;

  const [copied, setCopied] = useState(false);
  const [listPrice, setListPrice] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Monitor screen width to apply appropriate sidebar/bottom-sheet styling/animations
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const {
    buyFromTreasury,
    improveProperty,
    listForSale,
    claimIncome,
    buyFromPlayer,
    pendingAction,
    error,
    success,
    clearStates,
  } = usePropertyActions(property, onPropertyUpdate, viewerAddress, isConnected);

  const state = getOwnershipState(property, viewerAddress, isConnected);

  const copyToClipboard = () => {
    if (!property.owner) return;
    navigator.clipboard.writeText(property.owner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get color theme based on ownership state
  const getThemeColors = () => {
    switch (state.type) {
      case "owned_by_viewer":
        return {
          bgGrad: "from-emerald-500/20 to-teal-500/5",
          border: "border-emerald-500/30",
          text: "text-emerald-400",
          glow: "shadow-emerald-500/10",
          badge: "bg-emerald-950/80 border-emerald-800 text-emerald-300",
          title: "Owned by You",
        };
      case "listed_by_other":
        return {
          bgGrad: "from-purple-500/20 to-indigo-500/5",
          border: "border-purple-500/30",
          text: "text-purple-400",
          glow: "shadow-purple-500/10",
          badge: "bg-purple-950/80 border-purple-800 text-purple-300",
          title: "Listed for Sale",
        };
      case "unowned":
        return {
          bgGrad: "from-amber-500/20 to-orange-500/5",
          border: "border-amber-500/30",
          text: "text-amber-400",
          glow: "shadow-amber-500/10",
          badge: "bg-amber-950/80 border-amber-800 text-amber-300",
          title: "Treasury Property",
        };
      default:
        return {
          bgGrad: "from-slate-500/10 to-slate-500/5",
          border: "border-slate-800",
          text: "text-slate-400",
          glow: "shadow-none",
          badge: "bg-slate-950/80 border-slate-800 text-slate-400",
          title: "Unowned Tile",
        };
    }
  };

  const theme = getThemeColors();

  // Abbreviated Address Helper
  const abbreviateAddress = (addr: string) => {
    if (!addr) return "N/A";
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  // Coordinates helper (from location or custom coords)
  const coordinates = property.location.coordinates
    ? `[${property.location.coordinates.latitude.toFixed(4)}, ${property.location.coordinates.longitude.toFixed(4)}]`
    : `[40.7128, -74.0060]`; // Premium default coords if not provided

  // Framer Motion Animation Settings
  const sidebarVariants = {
    hidden: { x: "100%", opacity: 0.8 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: "spring", damping: 25, stiffness: 220 },
    },
    exit: {
      x: "100%",
      opacity: 0.8,
      transition: { type: "tween", duration: 0.25 },
    },
  };

  const bottomSheetVariants = {
    hidden: { y: "100%" },
    visible: {
      y: 0,
      transition: { type: "spring", damping: 22, stiffness: 180 },
    },
    exit: {
      y: "100%",
      transition: { type: "tween", duration: 0.25 },
    },
  };

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-label="Property details"
        variants={isMobile ? bottomSheetVariants : sidebarVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`fixed z-50 bg-slate-950/95 border-slate-800/90 text-white shadow-2xl flex flex-col font-sans backdrop-blur-xl ${
          isMobile
            ? "bottom-0 left-0 right-0 h-[70vh] rounded-t-[2.5rem] border-t"
            : "right-0 top-0 bottom-0 h-full w-80 border-l"
        }`}
      >
        {/* 8. Mobile Drag Handle */}
        {isMobile && (
          <div className="w-full flex justify-center py-3.5">
            <div className="w-12 h-1 bg-slate-800 rounded-full" />
          </div>
        )}

        {/* Header Section */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
              Land Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all duration-200"
          >
            <X size={16} />
          </button>
        </div>

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
                <span className="font-mono text-indigo-400 font-semibold">{coordinates}</span>
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
                      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
              </div>

              {/* 9. Building Level shown as a progression bar */}
              <BuildingLevelBar buildingLevel={buildingLevel} />

              {/* Accrued Rental Income if the viewer owns the property */}
              {state.type === "owned_by_viewer" && (
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
                  {/* Guarded internally but reachable because isConnected === true */}
                  <button
                    onClick={claimIncome}
                    disabled={!!pendingAction || (property.earnedIncome ?? 0) <= 0}
                    className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-lg border border-emerald-400/30 transition-all duration-200 shadow-md shadow-emerald-500/10 flex items-center gap-1"
                  >
                    Claim
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Inline notification states */}
          {error && (
            <div className="bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fadeIn">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-rose-500 shrink-0" />
              <div>
                <span className="font-bold text-rose-200 block mb-0.5">Transaction Error</span>
                <span className="text-rose-300/90 leading-relaxed">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fadeIn">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span className="font-bold text-emerald-200 block mb-0.5">Success!</span>
                <span className="text-emerald-300/90 leading-relaxed">{success}</span>
              </div>
            </div>
          )}

          {/* Pending details state string */}
          {pendingAction && (
            <div className="bg-slate-900 border border-slate-800 text-xs p-4 rounded-xl flex flex-col items-center justify-center gap-3 text-center animate-pulse">
              <RefreshCw size={20} className="text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                  Processing Blockchain Tx
                </span>
                {/* 7. Pending state displays descriptive string */}
                <p className="text-[11px] text-slate-400 font-medium px-4">{pendingAction}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Action flows contextually rendered */}
        {/* 10. No action requiring wallet signature is reachable when isConnected === false. Guard at render level. */}
        <div className="px-5 py-4 border-t border-slate-900/60 bg-slate-950/80 space-y-3">
          {state.type === "not_connected" ? (
            <div className="space-y-3">
              <div className="text-center p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-1.5">
                <span className="text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5">
                  <Wallet size={14} className="text-indigo-400" />
                  Stellar Wallet Required
                </span>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Connect your Stellar wallet to purchase tiles, make improvements, or claim rental incomes.
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
          ) : (
            <div className="space-y-3">
              {state.type === "unowned" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">Treasury Cost</span>
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
              )}

              {state.type === "listed_by_other" && (
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
              )}

              {state.type === "owned_by_viewer" && (
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
                        disabled={!!pendingAction || !listPrice || parseFloat(listPrice) <= 0}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs px-3.5 rounded-lg border border-slate-750 transition-colors"
                      >
                        List
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
