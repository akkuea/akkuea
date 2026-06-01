"use client";

import React, { useState } from "react";
import { PropertyPanel } from "../components/game/PropertyPanel";
import { GameProperty, BuildingLevel } from "../types/game.types";
import { Wallet, Sparkles, MapPin, Grid, Layers, Shield, HelpCircle } from "lucide-react";
import { useGameWallet } from "../hooks/useGameWallet";

// Mock coordinates and details
const mockPropertiesList: GameProperty[] = [
  {
    id: "tile-1-treasury",
    name: "Neo Tokyo Treasury Sector",
    description: "Highly coveted unowned sector in the central business district.",
    propertyType: "residential",
    location: {
      address: "District 1A",
      city: "Neo Tokyo",
      country: "Japan",
      coordinates: { latitude: 35.6762, longitude: 139.6503 }
    },
    totalValue: "850000",
    tokenAddress: "GCTREASURYXXXXXX",
    totalShares: 1000,
    availableShares: 1000,
    pricePerShare: "250",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-27T00:00:00Z",
    owner: "GBTREASURY",
    buildingLevel: 0,
    improveCost: 100,
    earnedIncome: 0,
  },
  {
    id: "tile-2-owned",
    name: "Akkuea Oasis Ridge",
    description: "Your primary residential estate with beautiful panoramic views.",
    propertyType: "residential",
    location: {
      address: "Ridge Drive 12",
      city: "Oasis City",
      country: "Stellar Core",
      coordinates: { latitude: 4.7128, longitude: -74.006 }
    },
    totalValue: "1200000",
    tokenAddress: "GCOWNEDXXXXXX",
    totalShares: 5000,
    availableShares: 0,
    pricePerShare: "150",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-27T00:00:00Z",
    owner: "GDVIEWER1234567890123456789012345678901234567890123456",
    buildingLevel: 1,
    improveCost: 150,
    earnedIncome: 750,
  },
  {
    id: "tile-3-listed",
    name: "Commercial Plaza West",
    description: "Premium retail lot currently listed for sale by another player.",
    propertyType: "commercial",
    location: {
      address: "West End Boulevard",
      city: "Metropolis",
      country: "Akkuea Land",
      coordinates: { latitude: 51.5074, longitude: -0.1278 }
    },
    totalValue: "2500000",
    tokenAddress: "GCLISTEDXXXXXX",
    totalShares: 10000,
    availableShares: 0,
    pricePerShare: "320",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-27T00:00:00Z",
    owner: "GDOTHER9876543210987654321098765432109876543210987654",
    buildingLevel: 2,
    improveCost: 400,
    earnedIncome: 0,
    isListed: true,
  },
];

export default function SandboxPage() {
  const [properties, setProperties] = useState<GameProperty[]>(mockPropertiesList);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  
  // Consuming global simulated wallet hook
  const { isConnected, address, login, logout } = useGameWallet();

  const handlePropertyUpdate = (updated: GameProperty) => {
    setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  // Helper to determine tile color on the map grid
  const getTileBorderClass = (p: GameProperty) => {
    if (!isConnected) return "border-slate-800 hover:border-slate-700 bg-slate-900/40";
    if (p.owner === address) return "border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20";
    if (p.owner === "GBTREASURY") return "border-amber-500/40 hover:border-amber-400 bg-amber-950/20";
    return "border-purple-500/40 hover:border-purple-400 bg-purple-950/20";
  };

  const getTileBadge = (p: GameProperty) => {
    if (!isConnected) return <span className="text-slate-500">Not Connected</span>;
    if (p.owner === address) return <span className="text-emerald-400">Owned by You</span>;
    if (p.owner === "GBTREASURY") return <span className="text-amber-400">Treasury</span>;
    return <span className="text-purple-400">Listed (Other)</span>;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 md:p-8 font-sans overflow-hidden">
      {/* Top Banner */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4 mb-8 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles size={12} />
              Metaverse Sandbox
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent mt-2">
            Akkuea Land Grid Panel
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Test and interact with property panels across all four dynamic blockchain ownership states.
          </p>
        </div>

        {/* Live Wallet Emulator */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Stellar Connection Emulator
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              {isConnected && address ? `${address.slice(0, 8)}...${address.slice(-8)}` : "Disconnected"}
            </p>
          </div>
          <button
            onClick={() => isConnected ? logout() : login()}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 border ${
              isConnected
                ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-750"
                : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30 shadow-lg shadow-indigo-600/10"
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
          <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-900 backdrop-blur-md">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Grid size={16} className="text-indigo-400" />
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
                      p
                    )} ${isSelected ? "ring-2 ring-indigo-500 scale-102 shadow-xl shadow-indigo-950/20" : ""}`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-950/80 px-2 py-0.5 rounded border border-slate-900/60">
                          Level {p.buildingLevel}
                        </span>
                        <span className="text-[10px] font-semibold">{getTileBadge(p)}</span>
                      </div>
                      <h4 className="font-bold text-white group-hover:text-indigo-300 transition-colors mt-3 text-sm">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-900/60 mt-auto">
                      <span className="text-[10px] text-slate-500">Value</span>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {p.pricePerShare} LAND
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sandbox Helper Notes */}
          <div className="bg-indigo-950/10 p-5 rounded-3xl border border-indigo-950/30 flex items-start gap-4">
            <HelpCircle className="text-indigo-400 shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                How to test the states:
              </h4>
              <ul className="text-xs text-slate-400 space-y-2 mt-2 list-disc list-inside">
                <li>
                  <strong className="text-slate-200">Unowned State</strong>: Click the Amber tile. Connect wallet to purchase from the treasury.
                </li>
                <li>
                  <strong className="text-slate-200">Owned State</strong>: Click the Green tile. Upgrading building level or creating a sale listing triggers the signature simulator.
                </li>
                <li>
                  <strong className="text-slate-200">Listed State</strong>: Click the Purple tile. If wallet is connected, purchase is available.
                </li>
                <li>
                  <strong className="text-slate-200">Signature Guard State</strong>: Click <strong className="text-slate-200">Disconnect Wallet</strong> at the top. Notice that all transaction buttons are strictly hidden behind the wallet connect guard!
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Info Space */}
        <div className="lg:col-span-1 bg-slate-900/20 p-8 rounded-3xl border border-slate-900/60 text-center min-h-[300px] flex flex-col items-center justify-center gap-3">
          <Layers className="text-slate-700 animate-pulse" size={42} />
          <h4 className="font-bold text-slate-400 text-sm">No Property Selected</h4>
          <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
            Click on any land tile in the grid to slide in the real-time interaction property panel.
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
