"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { useWallet } from "@/components/auth/hooks";
import { Footer, Navbar } from "@/components/layout";
import { InvestModal } from "@/components/marketplace/InvestModal";
import {
  filterAndSortProperties,
  getFundingProgress,
  getPropertyImage,
  getPropertyRegion,
  getPropertyTypeLabel,
  getPropertyTypes,
  getRegions,
  MARKETPLACE_ALL_REGIONS,
  MARKETPLACE_ALL_TYPES,
  sortOptions,
  type MarketplaceSortOption,
} from "@/components/marketplace/marketplace.utils";
import {
  Badge,
  Button,
  Card,
  ErrorBoundary,
  FreshnessIndicator,
  Input,
  SkeletonPropertyCard,
} from "@/components/ui";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/animations";
import { formatCurrency } from "@/lib/utils";
import { useProperties } from "@/hooks/useProperties";

function PropertyGridSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <motion.div key={index} variants={staggerItem}>
          <SkeletonPropertyCard />
        </motion.div>
      ))}
    </>
  );
}

interface ErrorStateProps {
  error: string;
  onRetry: () => Promise<void>;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center"
    >
      <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-300" />
      <h2 className="mb-2 text-lg font-semibold text-white">
        Could not load the marketplace
      </h2>
      <p className="mx-auto mb-6 max-w-xl text-sm text-red-100/80">{error}</p>
      <Button
        variant="accent"
        onClick={() => void onRetry()}
        leftIcon={<RefreshCw className="h-4 w-4" />}
      >
        Retry
      </Button>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div variants={staggerItem} className="py-16 text-center">
      <Building2 className="mx-auto mb-4 h-16 w-16 text-neutral-700" />
      <h3 className="mb-2 text-lg font-semibold text-white">
        No properties found
      </h3>
      <p className="text-sm text-neutral-500">
        Try adjusting your filters or search query
      </p>
    </motion.div>
  );
}

function PropertyCard({
  property,
  onSelect,
}: {
  property: PropertyInfo;
  onSelect: (property: PropertyInfo) => void;
}) {
  const fundingProgress = getFundingProgress(property);
  const soldShares = property.totalShares - property.availableShares;

  return (
    <motion.div variants={staggerItem}>
      <Card
        noPadding
        hoverable
        className="group overflow-hidden"
        onClick={() => onSelect(property)}
      >
        <div className="relative h-48 overflow-hidden">
          <Image
            src={getPropertyImage(property)}
            alt={property.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant="outline">
              {getPropertyRegion(property.location.country)}
            </Badge>
            {property.verified && <Badge variant="success">Verified</Badge>}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
        </div>

        <div className="p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white transition-colors group-hover:text-[#ff3e00]">
                {property.name}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                <MapPin className="h-3 w-3" />
                {property.location.city}, {property.location.country}
              </p>
            </div>
            <Badge variant="outline">
              {getPropertyTypeLabel(property.propertyType)}
            </Badge>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-neutral-500">Funding Progress</span>
              <span className="font-mono font-medium text-white">
                {fundingProgress}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[#1a1a1a]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fundingProgress}%` }}
                transition={{ duration: 1, delay: 0.2 }}
                className="h-full bg-gradient-to-r from-[#ff3e00] to-[#00ff88]"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#1a1a1a] pt-4">
            <div className="text-center">
              <p className="font-mono text-sm font-bold text-white">
                {formatCurrency(parseFloat(property.pricePerShare))}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">
                Per Share
              </p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-bold text-white">
                {soldShares.toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">
                Sold
              </p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-bold text-white">
                {property.availableShares.toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">
                Available
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">
                Listed
              </p>
              <p className="text-xs font-medium text-white">
                {new Date(property.listedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#00ff88]" />
          </div>

          <Button className="mt-4 w-full" size="sm">
            Invest Now
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function MarketplacePage() {
  const {
    properties,
    isLoading,
    error,
    refetch,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
  } = useProperties();
  const { isConnected, connect, address, refreshBalance } = useWallet();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(MARKETPLACE_ALL_REGIONS);
  const [selectedType, setSelectedType] = useState(MARKETPLACE_ALL_TYPES);
  const [sortBy, setSortBy] = useState<MarketplaceSortOption>("Recently Added");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyInfo | null>(
    null,
  );

  const filteredProperties = useMemo(
    () =>
      filterAndSortProperties(properties, {
        searchQuery,
        selectedRegion,
        selectedType,
        sortBy,
      }),
    [properties, searchQuery, selectedRegion, selectedType, sortBy],
  );

  const regions = useMemo(() => getRegions(properties), [properties]);
  const propertyTypes = useMemo(
    () => getPropertyTypes(properties),
    [properties],
  );

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-black"
    >
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <ErrorBoundary>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            <motion.div variants={staggerItem}>
              <h1 className="text-2xl font-bold text-white">Marketplace</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Discover verified tokenized real estate and invest directly from
                your connected wallet.
              </p>
            </motion.div>

            <motion.div variants={staggerItem} className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <Input
                    placeholder="Search properties..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    leftIcon={<Search className="h-5 w-5" />}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters((current) => !current)}
                  leftIcon={<SlidersHorizontal className="h-4 w-4" />}
                >
                  Filters
                </Button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid gap-4 rounded-lg border border-[#262626] bg-[#0a0a0a] p-4 sm:grid-cols-3"
                  >
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-wider text-neutral-500">
                        Region
                      </label>
                      <select
                        value={selectedRegion}
                        onChange={(event) =>
                          setSelectedRegion(event.target.value)
                        }
                        className="w-full cursor-pointer rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#404040] focus:outline-none"
                      >
                        {regions.map((region) => (
                          <option key={region} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-wider text-neutral-500">
                        Property Type
                      </label>
                      <select
                        value={selectedType}
                        onChange={(event) =>
                          setSelectedType(event.target.value)
                        }
                        className="w-full cursor-pointer rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#404040] focus:outline-none"
                      >
                        {propertyTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-wider text-neutral-500">
                        Sort By
                      </label>
                      <select
                        value={sortBy}
                        onChange={(event) =>
                          setSortBy(event.target.value as MarketplaceSortOption)
                        }
                        className="w-full cursor-pointer rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#404040] focus:outline-none"
                      >
                        {sortOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              variants={staggerItem}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <p className="font-mono text-xs text-neutral-500">
                  Showing{" "}
                  <span className="font-medium text-white">
                    {filteredProperties.length}
                  </span>{" "}
                  properties
                </p>
                <FreshnessIndicator
                  lastUpdatedAt={lastUpdatedAt}
                  connectionStatus={connectionStatus}
                  isPolling={isPolling}
                  onRefresh={() => void refetch()}
                />
              </div>
              {!isConnected && (
                <p className="text-xs text-neutral-500">
                  Connect your wallet to unlock investing.
                </p>
              )}
            </motion.div>

            {error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : (
              <>
                <motion.div
                  variants={staggerContainer}
                  className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {isLoading ? (
                    <PropertyGridSkeleton />
                  ) : (
                    filteredProperties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onSelect={setSelectedProperty}
                      />
                    ))
                  )}
                </motion.div>

                {!isLoading && filteredProperties.length === 0 && (
                  <EmptyState />
                )}
              </>
            )}
          </motion.div>
        </ErrorBoundary>
      </main>
      <Footer />

      {selectedProperty && (
        <InvestModal
          property={selectedProperty}
          isOpen={selectedProperty !== null}
          onClose={() => setSelectedProperty(null)}
          isConnected={isConnected}
          walletAddress={address}
          onConnectWallet={connect}
          onInvestmentSuccess={() => {
            refetch();
            void refreshBalance();
          }}
        />
      )}
    </motion.div>
  );
}
