"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { AnimatePresence } from "framer-motion";
import "./CityMap.css";
import { GameProperty } from "../../types/game.types";
import { PropertyPanel } from "./PropertyPanel";
import { addressToHSL, addressToGlow } from "../../lib/colorHash";
import {
  generateMockGrid,
  BUILDING_LABELS,
  BUILDING_NAMES,
  abbreviateAddress,
  getGridCoords,
} from "../../lib/mockProperties";
import { useMapEvents } from "../../hooks/useMapEvents";

// ── Constants ────────────────────────────────────────────────────────────────

const FLASH_DURATION = 700; // ms — matches CSS animation duration

// ── PropertyTile ─────────────────────────────────────────────────────────────

interface PropertyTileProps {
  property: GameProperty;
  isSelected: boolean;
  isFocusable: boolean;
  onFocus: (propertyId: string) => void;
}

const GRID_SIZE = 20;

function getTileStatus(property: GameProperty): string {
  if (!property.owner) return "Unowned";
  if (property.owner === "GBTREASURY") return "Treasury";
  return `Owned by ${abbreviateAddress(property.owner)}`;
}

function getTileAriaLabel(property: GameProperty): string {
  const { row, col } = getGridCoords(property.id);
  const status = getTileStatus(property);
  const saleStatus = property.isListed
    ? `, listed for ${property.pricePerShare} LAND per share`
    : ", not listed for sale";

  return `${property.name}, row ${row + 1}, column ${col + 1}, ${status}, ${BUILDING_NAMES[property.buildingLevel]}${saleStatus}`;
}

const PropertyTile = React.memo(function PropertyTile({
  property,
  isSelected,
  isFocusable,
  onFocus,
}: PropertyTileProps) {
  const { row, col } = getGridCoords(property.id);
  const bgColor = addressToHSL(property.owner);
  const glowColor = addressToGlow(property.owner);
  const isTreasury = !property.owner || property.owner === "GBTREASURY";
  const isUnowned = !property.owner;

  const tooltipLines = [
    `📍 (${row}, ${col})`,
    `👤 ${abbreviateAddress(property.owner)}`,
    `🏗 ${BUILDING_NAMES[property.buildingLevel]}`,
  ];
  if (property.isListed) {
    tooltipLines.push(`💰 ${property.pricePerShare} LAND`);
  }
  const tooltip = tooltipLines.join("\n");

  const tileClasses = ["city-tile", isSelected && "tile-selected"]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      key={property.id}
      data-property-id={property.id}
      data-tooltip={tooltip}
      className={tileClasses}
      style={
        {
          backgroundColor: isUnowned ? "var(--tile-empty)" : bgColor,
          "--tile-glow-color": glowColor,
          opacity: isUnowned ? 0.45 : isTreasury ? 0.7 : 1,
        } as React.CSSProperties
      }
      role="gridcell"
      aria-label={getTileAriaLabel(property)}
      aria-selected={isSelected}
      aria-rowindex={row + 1}
      aria-colindex={col + 1}
      tabIndex={isFocusable ? 0 : -1}
      onFocus={() => onFocus(property.id)}
    >
      {property.buildingLevel > 0 && (
        <span className={`tile-badge tile-badge-${property.buildingLevel}`}>
          {BUILDING_LABELS[property.buildingLevel]}
        </span>
      )}

      {property.buildingLevel === 0 && !isUnowned && !isTreasury && (
        <span className="tile-badge tile-badge-0">{BUILDING_LABELS[0]}</span>
      )}

      {property.isListed && <span className="tile-listed-dot" />}
    </div>
  );
});

// ── Component ────────────────────────────────────────────────────────────────

export function CityMap() {
  // ── State ────────────────────────────────────────────────────────────────
  const [properties, setProperties] = useState<GameProperty[]>(() =>
    generateMockGrid(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string>(
    () => properties[0]?.id ?? "",
  );
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedProperty = useMemo(
    () =>
      selectedId ? (properties.find((p) => p.id === selectedId) ?? null) : null,
    [selectedId, properties],
  );

  const stats = useMemo(() => {
    let owned = 0;
    let listed = 0;
    let treasury = 0;
    for (const p of properties) {
      if (!p.owner || p.owner === "GBTREASURY") {
        treasury++;
      } else {
        owned++;
        if (p.isListed) listed++;
      }
    }
    return { owned, listed, treasury, total: properties.length };
  }, [properties]);

  // ── Property update handler ──────────────────────────────────────────────
  const handlePropertyChange = useCallback((updated: GameProperty) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  }, []);

  // ── Real-time events ────────────────────────────────────────────────────
  const { lastEvent } = useMapEvents(properties, handlePropertyChange);

  // Flash the tile via direct DOM manipulation (avoids setState in effect)
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.propertyId === selectedId) return;

    const grid = gridRef.current;
    if (!grid) return;

    const tile = grid.querySelector<HTMLElement>(
      `[data-property-id="${lastEvent.propertyId}"]`,
    );
    if (!tile) return;

    tile.classList.add("tile-flash");

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = setTimeout(() => {
      tile.classList.remove("tile-flash");
    }, FLASH_DURATION);
  }, [lastEvent, selectedId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const selectTile = useCallback((propertyId: string) => {
    // Toggle selection: activating same tile deselects
    setSelectedId((prev) => (prev === propertyId ? null : propertyId));
  }, []);

  const focusTile = useCallback((propertyId: string) => {
    setFocusedId(propertyId);
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-property-id="${propertyId}"]`)
      ?.focus();
  }, []);

  // ── Event delegation click handler ───────────────────────────────────────
  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-property-id]",
      );
      if (!target) return;

      const propertyId = target.dataset.propertyId!;
      setFocusedId(propertyId);
      selectTile(propertyId);
    },
    [selectTile],
  );

  // ── Keyboard navigation handler ──────────────────────────────────────────
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-property-id]",
      );
      if (!target) return;

      const propertyId = target.dataset.propertyId!;
      const currentIndex = properties.findIndex((p) => p.id === propertyId);
      if (currentIndex === -1) return;

      const keyOffsets: Record<string, number> = {
        ArrowUp: -GRID_SIZE,
        ArrowDown: GRID_SIZE,
        ArrowLeft: -1,
        ArrowRight: 1,
      };

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectTile(propertyId);
        return;
      }

      const offset = keyOffsets[e.key];
      if (!offset) return;

      e.preventDefault();
      const { row, col } = getGridCoords(propertyId);
      const isBlockedHorizontal =
        (e.key === "ArrowLeft" && col === 0) ||
        (e.key === "ArrowRight" && col === GRID_SIZE - 1);
      const isBlockedVertical =
        (e.key === "ArrowUp" && row === 0) ||
        (e.key === "ArrowDown" && row === GRID_SIZE - 1);
      if (isBlockedHorizontal || isBlockedVertical) return;

      const nextProperty = properties[currentIndex + offset];
      if (nextProperty) focusTile(nextProperty.id);
    },
    [focusTile, properties, selectTile],
  );

  // ── Close panel ──────────────────────────────────────────────────────────
  const handleClosePanel = useCallback(() => {
    setSelectedId(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 flex flex-col">
      {/* ── Map Header ──────────────────────────────────────────────────── */}
      <div className="map-header">
        <h1>
          <span className="text-land-accent mr-2">◈</span>
          City Map
        </h1>
        <div className="map-stats">
          <div className="map-stat">
            <span className="map-stat-value">{stats.owned}</span>
            <span className="map-stat-label">Owned</span>
          </div>
          <div className="map-stat">
            <span className="map-stat-value">{stats.listed}</span>
            <span className="map-stat-label">Listed</span>
          </div>
          <div className="map-stat">
            <span className="map-stat-value">{stats.treasury}</span>
            <span className="map-stat-label">Treasury</span>
          </div>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-swatch bg-(--land-gold)" />
          Treasury
        </div>
        <div className="legend-item">
          <div className="legend-swatch bg-(--tile-empty)" />
          Unowned
        </div>
        <div className="legend-item">
          <div className="legend-swatch bg-[hsl(210, 60%, 42%)]" />
          Player-owned
        </div>
        <div className="legend-item">
          <div className="legend-swatch bg-(--land-gold) rounded-[50%] w-2 h-2" />
          For Sale
        </div>
        <div className="legend-item ml-auto">
          <span className="text-land-fg-subtle text-[9px]">
            V=Vacant · R=Residential · C=Commercial · S=Skyscraper
          </span>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div className="city-map-wrapper">
        {/* Single click handler on the container — event delegation */}
        <div
          ref={gridRef}
          className="city-grid"
          onClick={handleGridClick}
          onKeyDown={handleGridKeyDown}
          role="grid"
          aria-label="Akkuea City property grid"
        >
          {properties.map((prop) => (
            <PropertyTile
              key={prop.id}
              property={prop}
              isSelected={prop.id === selectedId}
              isFocusable={prop.id === focusedId}
              onFocus={setFocusedId}
            />
          ))}
        </div>
      </div>

      {/* ── Property Detail Panel ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProperty && (
          <PropertyPanel
            key={selectedProperty.id}
            property={selectedProperty}
            onPropertyUpdate={handlePropertyChange}
            viewerAddress={null}
            isConnected={false}
            onClose={handleClosePanel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
