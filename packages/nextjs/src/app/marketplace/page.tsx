'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import Link from 'next/link';
import { MapPin, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListingCard } from './ListingCard';
import { BuyModal } from './BuyModal';
import {
  Listing,
  BuildingLevel,
  SortOption,
  LEVEL_LABELS,
  MOCK_LISTINGS,
  MOCK_BALANCE,
} from './types';

// Simulates pollar.signAndSubmitTx()
async function signAndSubmitTx(_listingId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 1500));
}

const ALL_LEVELS: BuildingLevel[] = [0, 1, 2, 3, 4, 5];

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>(MOCK_LISTINGS);
  const [selectedLevels, setSelectedLevels] = useState<Set<BuildingLevel>>(new Set());
  const [sort, setSort] = useState<SortOption>('newest');
  const [activeListing, setActiveListing] = useState<Listing | null>(null);

  const toggleLevel = (level: BuildingLevel) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const clearFilters = () => setSelectedLevels(new Set());

  const filtered = useMemo(() => {
    let result = selectedLevels.size > 0
      ? listings.filter((l) => selectedLevels.has(l.level))
      : listings;

    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      return b.listedAt.getTime() - a.listedAt.getTime(); // newest
    });
  }, [listings, selectedLevels, sort]);

  const handleConfirmPurchase = async () => {
    if (!activeListing) return;
    await signAndSubmitTx(activeListing.id);
    const bought = activeListing;
    setActiveListing(null);
    setListings((prev) => prev.filter((l) => l.id !== bought.id));
    toast.success(`You now own (${bought.coords.x}, ${bought.coords.y})!`, {
      description: `${bought.price.toLocaleString()} LAND deducted from your balance.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and buy properties listed by other players.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 flex-1" role="group" aria-label="Filter by building level">
            <span className="flex items-center gap-1 text-sm text-muted-foreground self-center">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter:
            </span>
            {ALL_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                aria-pressed={selectedLevels.has(level)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedLevels.has(level)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/50'
                }`}
              >
                {LEVEL_LABELS[level]}
              </button>
            ))}
          </div>

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-44 shrink-0" aria-label="Sort listings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="price-asc">Price: low to high</SelectItem>
              <SelectItem value="price-desc">Price: high to low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid / Empty states */}
        {listings.length === 0 ? (
          // No listings at all
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
            <div>
              <p className="font-semibold text-lg">No listings yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Be the first to list a property for sale.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/map">Go to City Map</Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          // Filters produce no results
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <SlidersHorizontal className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
            <div>
              <p className="font-semibold text-lg">No listings match</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters.
              </p>
            </div>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <ul
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            aria-label="Property listings"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((listing) => (
                <li key={listing.id}>
                  <ListingCard
                    listing={listing}
                    onClick={() => setActiveListing(listing)}
                  />
                </li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Buy modal */}
      {activeListing && (
        <BuyModal
          listing={activeListing}
          balance={MOCK_BALANCE}
          onClose={() => setActiveListing(null)}
          onConfirm={handleConfirmPurchase}
        />
      )}

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
