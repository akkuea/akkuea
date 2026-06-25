"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Coins,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MapPin,
  Building2,
  Sparkles,
  ArrowRight,
  History,
  Wallet,
  ArrowUpRight,
  Home,
} from "lucide-react";
import {
  EPOCH_LEDGERS,
  BASE_RENTAL_RATE,
  HOUSE_MULTIPLIER,
  APARTMENT_MULTIPLIER,
  SKYSCRAPER_MULTIPLIER,
} from "@akkuea/shared";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { GameProperty, BuildingLevel } from "@/types/game.types";
import { getWalletKit } from "@/lib/walletKit";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardProperty = GameProperty & { lastClaimedLedger: number };

type EventType = "buy" | "improve" | "list" | "claim";

interface GameEventEntry {
  id: string;
  eventType: EventType;
  coordinates: [number, number];
  amount?: number;
  ledger: number;
  timestamp: string;
}

interface ClaimProgress {
  current: number;
  total: number;
  failures: string[];
  done: boolean;
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const LEVEL_MULTIPLIER: Record<BuildingLevel, number> = {
  0: 1,
  1: HOUSE_MULTIPLIER,
  2: APARTMENT_MULTIPLIER,
  3: SKYSCRAPER_MULTIPLIER,
};

const LEVEL_LABEL: Record<BuildingLevel, string> = {
  0: "Empty",
  1: "House",
  2: "Apartment",
  3: "Skyscraper",
};

const LEVEL_COLOR: Record<BuildingLevel, string> = {
  0: "from-slate-500/10 to-slate-600/5 border-slate-700/60",
  1: "from-sky-500/15 to-sky-600/5 border-sky-600/40",
  2: "from-violet-500/15 to-violet-600/5 border-violet-600/40",
  3: "from-amber-500/15 to-amber-600/5 border-amber-600/40",
};

const EVENT_LABELS: Record<EventType, string> = {
  buy: "Purchased",
  improve: "Improved",
  list: "Listed for Sale",
  claim: "Claimed Income",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEWER_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_VIEWER_ADDRESS ?? '';
const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const EVENTS_PAGE_SIZE = 5;

// ─── Mock data ─────────────────────────────────────────────────────────────────
// Reflects the same wallet/player from the sandbox page.
// lastClaimedLedger values are fixed historic ledger numbers so that
// computeAccruedIncome produces non-zero results once the RPC sequence arrives.

const MOCK_PROPERTIES: DashboardProperty[] = [
  {
    id: "prop-1",
    name: "Oasis Ridge Estate",
    description: "Residential estate with panoramic views.",
    propertyType: "residential",
    location: {
      address: "Ridge Drive 12",
      city: "Oasis City",
      country: "Stellar Core",
      coordinates: { latitude: 4.71, longitude: -74.0 },
    },
    totalValue: "1200000",
    tokenAddress: "GCOWNED1XXXXXX",
    totalShares: 5000,
    availableShares: 0,
    pricePerShare: "150",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-01T00:00:00Z",
    owner: VIEWER_ADDRESS,
    buildingLevel: 1,
    improveCost: 300,
    earnedIncome: 0,
    lastClaimedLedger: 17_480,
  },
  {
    id: "prop-2",
    name: "Neo Tokyo Sector 9",
    description: "Commercial district hub with high foot traffic.",
    propertyType: "commercial",
    location: {
      address: "District 9B",
      city: "Neo Tokyo",
      country: "Japan",
      coordinates: { latitude: 35.68, longitude: 139.65 },
    },
    totalValue: "3500000",
    tokenAddress: "GCOWNED2XXXXXX",
    totalShares: 10000,
    availableShares: 0,
    pricePerShare: "320",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-04-15T00:00:00Z",
    owner: VIEWER_ADDRESS,
    buildingLevel: 2,
    improveCost: 1000,
    earnedIncome: 0,
    lastClaimedLedger: 480,
  },
  {
    id: "prop-3",
    name: "Metropolis Central Tower",
    description: "Premium skyscraper in the heart of the city.",
    propertyType: "commercial",
    location: {
      address: "City Centre Plaza",
      city: "Metropolis",
      country: "Akkuea Land",
      coordinates: { latitude: 51.51, longitude: -0.13 },
    },
    totalValue: "9000000",
    tokenAddress: "GCOWNED3XXXXXX",
    totalShares: 20000,
    availableShares: 0,
    pricePerShare: "800",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-03-20T00:00:00Z",
    owner: VIEWER_ADDRESS,
    buildingLevel: 3,
    improveCost: 0,
    earnedIncome: 0,
    lastClaimedLedger: 35_180,
  },
  {
    id: "prop-4",
    name: "Desert Dunes Parcel",
    description: "Vacant land in the desert outskirts.",
    propertyType: "land",
    location: {
      address: "Dune Road 45",
      city: "Sandstorm Vale",
      country: "Akkuea Land",
      coordinates: { latitude: 24.1, longitude: 55.2 },
    },
    totalValue: "450000",
    tokenAddress: "GCOWNED4XXXXXX",
    totalShares: 2000,
    availableShares: 0,
    pricePerShare: "75",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-05-10T00:00:00Z",
    owner: VIEWER_ADDRESS,
    buildingLevel: 0,
    improveCost: 100,
    earnedIncome: 0,
    lastClaimedLedger: 32_480,
  },
];

const MOCK_EVENTS: GameEventEntry[] = [
  {
    id: "e1",
    eventType: "claim",
    coordinates: [3, 5],
    amount: 120,
    ledger: 52480,
    timestamp: "2026-05-28T10:00:00Z",
  },
  {
    id: "e2",
    eventType: "improve",
    coordinates: [1, 2],
    amount: 300,
    ledger: 51900,
    timestamp: "2026-05-27T15:30:00Z",
  },
  {
    id: "e3",
    eventType: "buy",
    coordinates: [4, 0],
    amount: 75,
    ledger: 51200,
    timestamp: "2026-05-26T09:45:00Z",
  },
  {
    id: "e4",
    eventType: "list",
    coordinates: [2, 3],
    ledger: 50800,
    timestamp: "2026-05-25T14:00:00Z",
  },
  {
    id: "e5",
    eventType: "claim",
    coordinates: [1, 2],
    amount: 20,
    ledger: 50400,
    timestamp: "2026-05-24T11:15:00Z",
  },
  {
    id: "e6",
    eventType: "buy",
    coordinates: [3, 5],
    amount: 800,
    ledger: 49600,
    timestamp: "2026-05-23T08:30:00Z",
  },
  {
    id: "e7",
    eventType: "improve",
    coordinates: [2, 3],
    amount: 100,
    ledger: 48900,
    timestamp: "2026-05-22T16:45:00Z",
  },
  {
    id: "e8",
    eventType: "claim",
    coordinates: [2, 3],
    amount: 50,
    ledger: 48100,
    timestamp: "2026-05-21T13:20:00Z",
  },
];

// ─── Income helpers ────────────────────────────────────────────────────────────

/**
 * Client-side accrual calculation matching the on-chain formula:
 *   claimable = floor((currentLedger − lastClaimedLedger) / EPOCH_LEDGERS)
 *               × BASE_RENTAL_RATE
 *               × rentalRateMultiplier
 */
function computeAccruedIncome(
  property: DashboardProperty,
  currentLedger: number,
): number {
  const elapsed = currentLedger - property.lastClaimedLedger;
  if (elapsed <= 0) return 0;
  const epochs = Math.floor(elapsed / EPOCH_LEDGERS);
  return epochs * BASE_RENTAL_RATE * LEVEL_MULTIPLIER[property.buildingLevel];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventTypeIcon({ type }: { type: EventType }) {
  switch (type) {
    case "buy":
      return <ArrowRight size={14} className="text-amber-400" />;
    case "improve":
      return <ArrowUpRight size={14} className="text-indigo-400" />;
    case "list":
      return <Building2 size={14} className="text-purple-400" />;
    case "claim":
      return <Coins size={14} className="text-emerald-400" />;
  }
}

function eventBadgeClass(type: EventType): string {
  switch (type) {
    case "buy":
      return "bg-amber-950/40 border-amber-500/20 text-amber-300";
    case "improve":
      return "bg-indigo-950/40 border-indigo-500/20 text-indigo-300";
    case "list":
      return "bg-purple-950/40 border-purple-500/20 text-purple-300";
    case "claim":
      return "bg-emerald-950/40 border-emerald-500/20 text-emerald-300";
  }
}

function eventAmountSign(type: EventType): string {
  return type === "buy" || type === "improve" ? "−" : "+";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [isConnected] = useState(true);
  const [landBalance, setLandBalance] = useState(4_250);
  const [currentLedger, setCurrentLedger] = useState(0);
  const [properties, setProperties] =
    useState<DashboardProperty[]>(MOCK_PROPERTIES);
  const [claimProgress, setClaimProgress] = useState<ClaimProgress | null>(
    null,
  );
  const [eventPage, setEventPage] = useState(1);

  // Poll the Soroban RPC for the latest ledger every 5 s so accrued income
  // is always computed against a fresh on-chain sequence number.
  useEffect(() => {
    const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

    async function fetchLatestLedger() {
      try {
        const { sequence } = await server.getLatestLedger();
        setCurrentLedger(sequence);
      } catch {
        // keep the current value on transient network errors
      }
    }

    fetchLatestLedger();
    const id = setInterval(fetchLatestLedger, 5_000);
    return () => clearInterval(id);
  }, []);

  // Recompute accrued income from lastClaimedLedger on every ledger tick.
  const propertiesWithIncome = useMemo(
    () =>
      properties.map((p) => ({
        ...p,
        earnedIncome: computeAccruedIncome(p, currentLedger),
      })),
    [properties, currentLedger],
  );

  const totalAccruedIncome = useMemo(
    () => propertiesWithIncome.reduce((sum, p) => sum + p.earnedIncome, 0),
    [propertiesWithIncome],
  );

  const claimableProperties = useMemo(
    () => propertiesWithIncome.filter((p) => p.earnedIncome > 0),
    [propertiesWithIncome],
  );

  // Claim All: processes every claimable property sequentially,
  // continues even if a single claim fails, reports failures at the end.
  const handleClaimAll = useCallback(async () => {
    if (claimableProperties.length === 0) return;

    const total = claimableProperties.length;
    setClaimProgress({ current: 0, total, failures: [], done: false });

    const kit = typeof window !== "undefined" ? getWalletKit() : null;
    let totalClaimed = 0;
    const failures: string[] = [];

    for (let i = 0; i < claimableProperties.length; i++) {
      const prop = claimableProperties[i];

      setClaimProgress({
        current: i,
        total,
        failures: [...failures],
        done: false,
      });

      try {
        if (kit) {
          // TODO: replace with real Soroban claim_rental XDR for prop.id
          const mockXdr = "AAAAAgAAAAD5r+Hl5S94D......";
          await kit.signTransaction(mockXdr, {
            networkPassphrase: "Test SDF Network ; September 2015",
            address: VIEWER_ADDRESS,
          });
        } else {
          await new Promise<void>((r) => setTimeout(r, 600));
        }

        totalClaimed += prop.earnedIncome;

        // Reset lastClaimedLedger so income display zeroes out immediately.
        setProperties((prev) =>
          prev.map((p) =>
            p.id === prop.id ? { ...p, lastClaimedLedger: currentLedger } : p,
          ),
        );
      } catch {
        failures.push(prop.name);
      }
    }

    if (totalClaimed > 0) {
      setLandBalance((prev) => prev + totalClaimed);
    }

    setClaimProgress({ current: total, total, failures, done: true });
  }, [claimableProperties, currentLedger]);

  const paginatedEvents = MOCK_EVENTS.slice(0, eventPage * EVENTS_PAGE_SIZE);
  const hasMoreEvents = paginatedEvents.length < MOCK_EVENTS.length;

  const isClaimRunning = !!claimProgress && !claimProgress.done;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ── Sticky header ── */}
      <header className="border-b border-slate-900 bg-slate-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-indigo-400" />
            <span className="font-extrabold tracking-tight text-white">
              Akkuea Land
            </span>
            <span className="text-slate-700 mx-1">/</span>
            <span className="text-slate-400 text-sm">Dashboard</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`}
            />
            <span className="text-xs font-mono text-slate-400 hidden sm:block">
              {isConnected
                ? `${VIEWER_ADDRESS.slice(0, 6)}...${VIEWER_ADDRESS.slice(-6)}`
                : "Disconnected"}
            </span>
            <a
              href="/"
              className="ml-1 text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Home size={13} />
              <span className="hidden sm:inline">City Map</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-10">
        {/* ── Section 1: Portfolio Summary ── */}
        <section aria-label="Portfolio summary">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">
            Portfolio Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* LAND Balance */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Wallet size={13} className="text-indigo-400" />
                LAND Balance
              </div>
              <div className="text-3xl font-extrabold text-white tabular-nums">
                {landBalance.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">LAND tokens</div>
            </div>

            {/* Accrued Income */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <TrendingUp size={13} className="text-emerald-400" />
                Accrued Income
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 tabular-nums">
                {totalAccruedIncome.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                across {propertiesWithIncome.length} properties · ledger{" "}
                {currentLedger.toLocaleString()}
              </div>
            </div>

            {/* Claim All */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Coins size={13} className="text-amber-400" />
                Quick Claim
              </div>

              {/* Progress indicator while claiming */}
              {isClaimRunning && claimProgress && (
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <RefreshCw
                    size={12}
                    className="animate-spin text-indigo-400 shrink-0"
                  />
                  Claiming {claimProgress.current + 1} of {claimProgress.total}…
                </div>
              )}

              {/* Result after claiming */}
              {claimProgress?.done && (
                <div className="space-y-1">
                  {claimProgress.failures.length === 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 size={13} />
                      All {claimProgress.total} claims succeeded
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 size={13} />
                        {claimProgress.total -
                          claimProgress.failures.length}{" "}
                        claimed
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-rose-400">
                        <XCircle size={13} className="mt-0.5 shrink-0" />
                        <span>Failed: {claimProgress.failures.join(", ")}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={handleClaimAll}
                disabled={claimableProperties.length === 0 || isClaimRunning}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 border border-emerald-400/20"
              >
                <Coins size={15} />
                {claimableProperties.length > 0
                  ? `Claim All (${claimableProperties.length})`
                  : "Nothing to Claim"}
              </button>
            </div>
          </div>
        </section>

        {/* ── Section 2: Property Grid ── */}
        <section aria-label="Owned properties">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">
            Your Properties
          </h2>

          {propertiesWithIncome.length === 0 ? (
            // Empty state
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
              <MapPin size={42} className="text-slate-700" />
              <div>
                <h3 className="font-bold text-slate-300">No Properties Yet</h3>
                <p className="text-sm text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                  You don&apos;t own any land tiles yet. Head to the city map to
                  claim your starter property from the treasury!
                </p>
              </div>
              <a
                href="/"
                className="mt-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                <MapPin size={14} />
                Open City Map
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {propertiesWithIncome.map((prop) => {
                const hasIncome = prop.earnedIncome > 0;
                const coords = prop.location.coordinates;
                const coordLabel = coords
                  ? `[${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}]`
                  : prop.location.city;

                return (
                  <button
                    key={prop.id}
                    onClick={() =>
                      router.push(`/?property=${encodeURIComponent(prop.id)}`)
                    }
                    aria-label={`View ${prop.name} on city map`}
                    className={`text-left p-4 rounded-2xl border bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] flex flex-col gap-3 relative overflow-hidden group ${LEVEL_COLOR[prop.buildingLevel]} ${
                      hasIncome
                        ? "shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20"
                        : ""
                    }`}
                  >
                    {/* Subtle green glow overlay for properties with unclaimed income */}
                    {hasIncome && (
                      <div className="absolute inset-0 rounded-2xl bg-emerald-500/[0.04] pointer-events-none" />
                    )}

                    {/* Level badge + income badge */}
                    <div className="flex justify-between items-start relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800/60">
                        {LEVEL_LABEL[prop.buildingLevel]}
                      </span>
                      {hasIncome && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          +{prop.earnedIncome} LAND
                        </span>
                      )}
                    </div>

                    {/* Property name + coords */}
                    <div className="relative z-10">
                      <h4 className="font-bold text-white text-sm group-hover:text-indigo-200 transition-colors line-clamp-1">
                        {prop.name}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                        <MapPin size={10} />
                        <span className="font-mono truncate">{coordLabel}</span>
                      </div>
                    </div>

                    {/* Accrued income footer */}
                    <div className="mt-auto flex justify-between items-center text-[11px] bg-slate-950/50 p-2 rounded-lg border border-slate-900/60 relative z-10">
                      <span className="text-slate-500">Accrued</span>
                      <span
                        className={`font-mono font-bold ${
                          hasIncome ? "text-emerald-400" : "text-slate-600"
                        }`}
                      >
                        {prop.earnedIncome} LAND
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors relative z-10">
                      <ChevronRight size={10} />
                      View on map
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 3: Transaction History ── */}
        <section aria-label="Transaction history">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <History size={13} />
            Transaction History
          </h2>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            {paginatedEvents.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                No transactions yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {paginatedEvents.map((event) => {
                  const badgeClass = eventBadgeClass(event.eventType);
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-900/60 transition-colors"
                    >
                      {/* Icon badge */}
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${badgeClass}`}
                      >
                        <EventTypeIcon type={event.eventType} />
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-200">
                            {EVENT_LABELS[event.eventType]}
                          </span>
                          <span className="text-xs text-slate-500 font-mono bg-slate-800/60 px-1.5 py-0.5 rounded">
                            [{event.coordinates[0]}, {event.coordinates[1]}]
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Ledger #{event.ledger.toLocaleString()} ·{" "}
                          {new Date(event.timestamp).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      {event.amount != null && (
                        <div
                          className={`text-sm font-bold tabular-nums shrink-0 ${badgeClass.split(" ")[2]}`}
                        >
                          {eventAmountSign(event.eventType)}
                          {event.amount} LAND
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Load more */}
            {hasMoreEvents && (
              <div className="px-5 py-3 border-t border-slate-800/60">
                <button
                  onClick={() => setEventPage((p) => p + 1)}
                  className="w-full text-xs font-bold text-slate-400 hover:text-white py-2 rounded-xl hover:bg-slate-800/60 transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
