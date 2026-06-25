"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  GameProperty,
  BuildingLevel,
  PropertyOwnershipState,
} from "../../../types/game.types";

import { EmptyPanel } from "./EmptyPanel";
import { NotConnectedPanel } from "./NotConnectedPanel";
import { UnownedPanel } from "./UnownedPanel";
import { OwnedPanel } from "./OwnedPanel";
import { ListedPanel } from "./ListedPanel";
import { OtherPlayerPanel } from "./OtherPlayerPanel";

export { BuildingLevelBar } from "./shared";

export interface PropertyPanelProps {
  property: GameProperty | null;
  onPropertyUpdate: (updated: GameProperty) => void;
  viewerAddress: string | null;
  isConnected: boolean;
  onConnect?: () => void;
  onClose: () => void;
  buildingLevel?: BuildingLevel;
}

/**
 * Resolves the ownership state.
 */
export const getOwnershipState = (
  property: GameProperty,
  viewerAddress: string | null | undefined,
  isConnected: boolean,
): PropertyOwnershipState => {
  if (!isConnected || !viewerAddress) {
    return { type: "not_connected", property };
  }
  if (property.owner === viewerAddress) {
    return { type: "owned_by_viewer", property, viewerAddress };
  }
  const isTreasury =
    !property.owner ||
    property.owner === "GBTREASURY" ||
    property.owner.toLowerCase() === "treasury" ||
    property.owner.toLowerCase() === "system";
  if (isTreasury) {
    return { type: "unowned", property, viewerAddress };
  }
  // Check if it's listed (in this mock/simple logic, we might need a property.isListed,
  // but the original code seems to treat non-treasury, non-viewer as 'listed_by_other' or just 'other')
  // Original code returned 'listed_by_other' for all other cases.
  return { type: "listed_by_other", property, viewerAddress };
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
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const copyToClipboard = () => {
    if (!property?.owner) return;
    navigator.clipboard.writeText(property.owner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const coordinates = property?.location.coordinates
    ? `[${property.location.coordinates.latitude.toFixed(4)}, ${property.location.coordinates.longitude.toFixed(4)}]`
    : `[40.7128, -74.0060]`;

  const buildingLevel =
    buildingLevelProp !== undefined
      ? buildingLevelProp
      : (property?.buildingLevel ?? 0);

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

  const renderContent = () => {
    if (!property) return <EmptyPanel onClose={onClose} />;

    const state = getOwnershipState(property, viewerAddress, isConnected);

    const commonProps = {
      property,
      copyToClipboard,
      copied,
      coordinates,
      buildingLevel: buildingLevel as BuildingLevel,
    };

    switch (state.type) {
      case "not_connected":
        return <NotConnectedPanel {...commonProps} onConnect={onConnect} />;
      case "unowned":
        return (
          <UnownedPanel
            {...commonProps}
            viewerAddress={viewerAddress!}
            isConnected={isConnected}
            onPropertyUpdate={onPropertyUpdate}
          />
        );
      case "owned_by_viewer":
        return (
          <OwnedPanel
            {...commonProps}
            viewerAddress={viewerAddress!}
            isConnected={isConnected}
            onPropertyUpdate={onPropertyUpdate}
          />
        );
      case "listed_by_other":
        return (
          <ListedPanel
            {...commonProps}
            viewerAddress={viewerAddress!}
            isConnected={isConnected}
            onPropertyUpdate={onPropertyUpdate}
          />
        );
      default:
        return <OtherPlayerPanel {...commonProps} />;
    }
  };

  return (
    <AnimatePresence>
      {property && (
        <motion.div
          key="property-panel"
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
          {isMobile && (
            <div className="w-full flex justify-center py-3.5">
              <div className="w-12 h-1 bg-slate-800 rounded-full" />
            </div>
          )}

          <div className="flex justify-between items-center px-5 py-4 border-b border-slate-900/60 shrink-0">
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

          {renderContent()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
