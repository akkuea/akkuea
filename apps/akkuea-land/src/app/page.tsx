"use client";

import React, { useState } from "react";
import { PropertyPanel } from "../components/game/PropertyPanel";
import { GameProperty, BuildingLevel } from "../types/game.types";
import {
  Wallet,
  Sparkles,
  MapPin,
  Grid,
  Layers,
  Shield,
  HelpCircle,
} from "lucide-react";
import { TREASURY_ADDRESS } from "@/lib/soroban-tx";
import { useGameWallet } from "../hooks/useGameWallet";

// Distinct mock addresses to demonstrate the three ownership states on the sandbox:
//   1. Treasury/unowned  → TREASURY_ADDRESS  (amber tile)
//   2. Viewer-owned      → MOCK_VIEWER_ADDRESS  (green tile - matches useGameWallet
//      when wallet is connected; see dashboard for the env-var-based VIEWER_ADDRESS)
//   3. Other player      → MOCK_OTHER_ADDRESS  (purple tile - "Listed (Other)")
const MOCK_VIEWER_ADDRESS =
  "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const MOCK_OTHER_ADDRESS =
  "GABC1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZ56";

const mockPropertiesList: GameProperty[] = [
  {
    id: "tile-1-treasury",
    name: "Neo Tokyo Treasury Sector",
    description:
      "Highly coveted unowned sector in the central business district.",
    propertyType: "residential",
    location: {
      address: "District 1A",
      city: "Neo Tokyo",
      country: "Japan",
      coordinates: { latitude: 35.6762, longitude: 139.6503 },
    },
    totalValue: "850000",
    tokenAddress: "CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE", // GAME_PROPERTY_NFT
    totalShares: 1000,
    availableShares: 1000,
    pricePerShare: "250",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-27T00:00:00Z",
    owner: TREASURY_ADDRESS,
    buildingLevel: 0,
    improveCost: 100,
    earnedIncome: 0,
  },
  {
    id: "tile-2-owned",
    name: "Akkuea Oasis Ridge",
    description:
      "Your primary residential estate with beautiful panoramic views.",
    propertyType: "residential",
    location: {
      address: "Ridge Drive 12",
      city: "Oasis City",
      country: "Stellar Core",
      coordinates: { latitude: 4.7128, longitude: -74.006 },
    },
    totalValue: "1200000",
    tokenAddress: "CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE", // GAME_PROPERTY_NFT
    totalShares: 5000,
    availableShares: 0,
    pricePerShare: "150",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-27T00:00:00Z",
    owner: MOCK_VIEWER_ADDRESS,
    buildingLevel: 1,
    improveCost: 150,
    earnedIncome: 750,
  },
  {
    id: "tile-3-listed",
    name: "Commercial Plaza West",
    description:
      "Premium retail lot currently listed for sale by another player.",
    propertyType: "commercial",
    location: {
      address: "West End Boulevard",
      city: "Metropolis",
      country: "Akkuea Land",
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
    },
    totalValue: "2500000",
    tokenAddress: "CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3", // GAME_MARKETPLACE
    totalShares: 10000,
    availableShares: 0,
    pricePerShare: "320",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-27T00:00:00Z",
    owner: MOCK_OTHER_ADDRESS,
    buildingLevel: 2,
    improveCost: 400,
    earnedIncome: 0,
    isListed: true,
  },
];

export default function SandboxPage() {
  const [properties, setProperties] =
    useState<GameProperty[]>(mockPropertiesList);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );

  // Consuming global simulated wallet hook
  const { isConnected, address, login, logout } = useGameWallet();

  const handlePropertyUpdate = (updated: GameProperty) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  // Helper to determine tile color on the map grid
  const getTileBorderClass = (p: GameProperty) => {
    if (!isConnected)
      return "border-land-border hover:border-land-border-hover bg-land-surface/40";
    if (p.owner === address)
      return "border-land-success/40 hover:border-land-success bg-land-success/10";
    if (p.owner === TREASURY_ADDRESS)
      return "border-land-gold/40 hover:border-land-gold bg-land-gold/10";
    return "border-tile-listed/40 hover:border-tile-listed bg-tile-listed/10";
  };

  const getTileBadge = (p: GameProperty) => {
    if (!isConnected)
      return <span className="text-land-fg-muted">Not Connected</span>;
    if (p.owner === address)
      return <span className="text-land-success">Owned by You</span>;
    if (p.owner === TREASURY_ADDRESS)
      return <span className="text-land-gold">Treasury</span>;
    return <span className="text-tile-listed">Listed (Other)</span>;
  };

  return (
    <main className="min-h-screen bg-land-bg text-land-fg flex flex-col items-center justify-start p-4 md:p-8 font-game overflow-hidden">
      {/* Top Banner */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4 mb-8 border-b border-land-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-land-accent/20 border border-land-accent/30 text-land-accent text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles size={12} />
              Metaverse Sandbox
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-land-fg to-land-accent bg-clip-text text-transparent mt-2">
            Akkuea Land Grid Panel
          </h1>
          <p className="text-land-fg-muted text-sm mt-1">
            Test and interact with property panels across all four dynamic
            blockchain ownership states.
          </p>
        </div>

        {/* Live Wallet Emulator */}
        <div className="bg-land-surface/80 p-4 rounded-2xl border border-land-border flex items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-land-success" : "bg-land-danger"}`}
              />
              <span className="text-xs text-land-fg-muted font-bold uppercase tracking-wider">
                Stellar Connection Emulator
              </span>
            </div>
            <p className="text-xs font-mono text-land-fg-muted">
              {isConnected && address
                ? `${address.slice(0, 8)}...${address.slice(-8)}`
                : "Disconnected"}
            </p>
          </div>
          <button
            onClick={() => (isConnected ? logout() : login())}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 border ${
              isConnected
                ? "bg-land-surface-raised hover:bg-land-border-hover text-land-fg border-land-border-hover"
                : "bg-land-accent-fill hover:bg-land-accent-fill/90 text-land-on-accent border-land-accent-fill/30 shadow-lg shadow-land-accent-fill/10"
            }`}
          >
            <Wallet size={14} />
            {isConnected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Map View Grid */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-land-surface/40 p-5 rounded-3xl border border-land-border backdrop-blur-md">
            <h3 className="text-sm font-bold text-land-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Grid size={16} className="text-land-accent" />
              Simulated World Map
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {properties.map((p) => {
                const isSelected = selectedPropertyId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPropertyId(p.id)}
                    className={`text-left p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group ${getTileBorderClass(
                      p,
                    )} ${isSelected ? "ring-2 ring-land-accent scale-102 shadow-xl shadow-land-accent/20" : ""}`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-land-bg/80 px-2 py-0.5 rounded border border-land-border/60">
                          Level {p.buildingLevel}
                        </span>
                        <span className="text-[10px] font-semibold">
                          {getTileBadge(p)}
                        </span>
                      </div>
                      <h4 className="font-bold text-land-fg group-hover:text-land-accent transition-colors mt-3 text-sm">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-land-fg-muted mt-1 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <div className="flex justify-between items-center bg-land-bg/40 p-2 rounded-lg border border-land-border/60 mt-auto">
                      <span className="text-[10px] text-land-fg-muted">
                        Value
                      </span>
                      <span className="text-xs font-mono font-bold text-land-accent">
                        {p.pricePerShare} LAND
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sandbox Helper Notes */}
          <div className="bg-land-accent/5 p-5 rounded-3xl border border-land-accent/30 flex items-start gap-4">
            <HelpCircle
              className="text-land-accent shrink-0 mt-0.5"
              size={20}
            />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-land-accent uppercase tracking-wider">
                How to test the states:
              </h4>
              <ul className="text-xs text-land-fg-muted space-y-2 mt-2 list-disc list-inside">
                <li>
                  <strong className="text-land-fg">Unowned State</strong>: Click
                  the Amber tile. Connect wallet to purchase from the treasury.
                </li>
                <li>
                  <strong className="text-land-fg">Owned State</strong>: Click
                  the Green tile. Upgrading building level or creating a sale
                  listing triggers the signature simulator.
                </li>
                <li>
                  <strong className="text-land-fg">Listed State</strong>: Click
                  the Purple tile. If wallet is connected, purchase is
                  available.
                </li>
                <li>
                  <strong className="text-land-fg">
                    Signature Guard State
                  </strong>
                  : Click{" "}
                  <strong className="text-land-fg">Disconnect Wallet</strong> at
                  the top. Notice that all transaction buttons are strictly
                  hidden behind the wallet connect guard!
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Info Space */}
        <div className="lg:col-span-1 bg-land-surface/20 p-8 rounded-3xl border border-land-border/60 text-center min-h-[300px] flex flex-col items-center justify-center gap-3">
          <Layers className="text-land-fg-subtle animate-pulse" size={42} />
          <h4 className="font-bold text-land-fg-muted text-sm">
            No Property Selected
          </h4>
          <p className="text-xs text-land-fg-muted max-w-[200px] mx-auto leading-relaxed">
            Click on any land tile in the grid to slide in the real-time
            interaction property panel.
          </p>
        </div>
      </div>

      {/* Render selected Property Panel */}
      {selectedProperty && (
        <PropertyPanel
          property={selectedProperty}
          onPropertyUpdate={handlePropertyUpdate}
          viewerAddress={isConnected ? address : null}
          isConnected={isConnected}
          onConnect={login}
          onClose={() => setSelectedPropertyId(null)}
        />
      )}
    </main>
  );
}
