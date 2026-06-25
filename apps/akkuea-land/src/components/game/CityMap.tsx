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

// ── Component ────────────────────────────────────────────────────────────────

export function CityMap() {
    // ── State ────────────────────────────────────────────────────────────────
    const [properties, setProperties] = useState<GameProperty[]>(() =>
        generateMockGrid(),
    );
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);

    // ── Derived ──────────────────────────────────────────────────────────────
    const selectedProperty = useMemo(
        () =>
            selectedId
                ? (properties.find((p) => p.id === selectedId) ?? null)
                : null,
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

    // ── Event delegation click handler ───────────────────────────────────────
    const handleGridClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const target = (e.target as HTMLElement).closest<HTMLElement>(
                "[data-property-id]",
            );
            if (!target) return;

            const propertyId = target.dataset.propertyId!;

            // Toggle selection: clicking same tile deselects
            setSelectedId((prev) => (prev === propertyId ? null : propertyId));
        },
        [],
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
                    role="grid"
                    aria-label="Akkuea City property grid"
                >
                    {properties.map((prop) => {
                        const { row, col } = getGridCoords(prop.id);
                        const bgColor = addressToHSL(prop.owner);
                        const glowColor = addressToGlow(prop.owner);
                        const isSelected = prop.id === selectedId;
                        const isTreasury =
                            !prop.owner || prop.owner === "GBTREASURY";
                        const isUnowned = !prop.owner;

                        // Build tooltip text
                        const tooltipLines = [
                            `📍 (${row}, ${col})`,
                            `👤 ${abbreviateAddress(prop.owner)}`,
                            `🏗 ${BUILDING_NAMES[prop.buildingLevel]}`,
                        ];
                        if (prop.isListed) {
                            tooltipLines.push(`💰 ${prop.pricePerShare} LAND`);
                        }
                        const tooltip = tooltipLines.join("\n");

                        const tileClasses = [
                            "city-tile",
                            isSelected && "tile-selected",
                        ]
                            .filter(Boolean)
                            .join(" ");

                        return (
                            <div
                                key={prop.id}
                                data-property-id={prop.id}
                                data-tooltip={tooltip}
                                className={tileClasses}
                                style={
                                    {
                                        backgroundColor: isUnowned
                                            ? "var(--tile-empty)"
                                            : bgColor,
                                        "--tile-glow-color": glowColor,
                                        opacity: isUnowned
                                            ? 0.45
                                            : isTreasury
                                              ? 0.7
                                              : 1,
                                    } as React.CSSProperties
                                }
                                role="gridcell"
                                aria-label={`Tile ${row},${col} — ${abbreviateAddress(prop.owner)} — ${BUILDING_NAMES[prop.buildingLevel]}${prop.isListed ? " — For Sale" : ""}`}
                            >
                                {/* Building Level Badge */}
                                {prop.buildingLevel > 0 && (
                                    <span
                                        className={`tile-badge tile-badge-${prop.buildingLevel}`}
                                    >
                                        {BUILDING_LABELS[prop.buildingLevel]}
                                    </span>
                                )}

                                {/* Vacant label for level 0 — only on non-empty tiles to reduce clutter */}
                                {prop.buildingLevel === 0 &&
                                    !isUnowned &&
                                    !isTreasury && (
                                        <span className="tile-badge tile-badge-0">
                                            {BUILDING_LABELS[0]}
                                        </span>
                                    )}

                                {/* Listed-for-sale amber dot */}
                                {prop.isListed && (
                                    <span className="tile-listed-dot" />
                                )}
                            </div>
                        );
                    })}
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
