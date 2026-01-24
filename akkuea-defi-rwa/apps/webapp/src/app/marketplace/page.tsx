"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Building2,
  DollarSign,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Navbar, Footer } from "@/components/layout";
import { Card, Button, Badge, Input, Modal } from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/animations";

// Mock property data
const properties = [
  {
    id: 1,
    name: "Lagos Marina Towers",
    location: "Lagos, Nigeria",
    region: "Africa",
    type: "Residential",
    price: 2500000,
    tokenPrice: 100,
    totalTokens: 25000,
    soldTokens: 18750,
    yield: 8.5,
    minInvestment: 100,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    featured: true,
    verified: true,
  },
  {
    id: 2,
    name: "Mexico City Business Center",
    location: "CDMX, Mexico",
    region: "Latin America",
    type: "Commercial",
    price: 5000000,
    tokenPrice: 250,
    totalTokens: 20000,
    soldTokens: 15000,
    yield: 7.2,
    minInvestment: 250,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    featured: true,
    verified: true,
  },
  {
    id: 3,
    name: "Nairobi Tech Park",
    location: "Nairobi, Kenya",
    region: "Africa",
    type: "Commercial",
    price: 3200000,
    tokenPrice: 160,
    totalTokens: 20000,
    soldTokens: 12000,
    yield: 9.1,
    minInvestment: 160,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    featured: false,
    verified: true,
  },
  {
    id: 4,
    name: "Accra Luxury Villas",
    location: "Accra, Ghana",
    region: "Africa",
    type: "Residential",
    price: 1800000,
    tokenPrice: 90,
    totalTokens: 20000,
    soldTokens: 8000,
    yield: 7.8,
    minInvestment: 90,
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
    featured: false,
    verified: true,
  },
  {
    id: 5,
    name: "Bogota Residential Complex",
    location: "Bogota, Colombia",
    region: "Latin America",
    type: "Residential",
    price: 2100000,
    tokenPrice: 105,
    totalTokens: 20000,
    soldTokens: 14000,
    yield: 8.0,
    minInvestment: 105,
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    featured: false,
    verified: true,
  },
  {
    id: 6,
    name: "Johannesburg Office Tower",
    location: "Johannesburg, South Africa",
    region: "Africa",
    type: "Commercial",
    price: 4500000,
    tokenPrice: 225,
    totalTokens: 20000,
    soldTokens: 16500,
    yield: 6.9,
    minInvestment: 225,
    image: "https://images.unsplash.com/photo-1577495508326-19a1b3cf65b7?w=800",
    featured: true,
    verified: true,
  },
];

const regions = ["All Regions", "Africa", "Latin America"];
const propertyTypes = ["All Types", "Residential", "Commercial"];
const sortOptions = [
  "Highest Yield",
  "Lowest Price",
  "Most Funded",
  "Recently Added",
];

interface InvestModalProps {
  property: (typeof properties)[0];
  isOpen: boolean;
  onClose: () => void;
}

function InvestModal({ property, isOpen, onClose }: InvestModalProps) {
  const [tokens, setTokens] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"usdc" | "fiat">("usdc");

  const totalCost = tokens * property.tokenPrice;
  const estimatedYield = (totalCost * property.yield) / 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invest in Property"
      size="lg"
    >
      <div className="space-y-6">
        {/* Property Summary */}
        <div className="flex gap-4 p-4 bg-[#1a1a1a] border border-[#262626] rounded-lg">
          {/* When we use images from db, we use Image component from next/image */}
          <div className="relative w-20 h-20 rounded-lg overflow-hidden">
            <Image
              src={property.image}
              alt={property.name}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="font-semibold text-white">{property.name}</h3>
            <p className="text-sm text-neutral-500">{property.location}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success">{property.yield}% APY</Badge>
              <Badge variant="outline">{property.type}</Badge>
            </div>
          </div>
        </div>

        {/* Token Amount */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
            Number of Tokens
          </label>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTokens(Math.max(1, tokens - 1))}
              disabled={tokens <= 1}
            >
              -
            </Button>
            <Input
              type="number"
              value={tokens}
              onChange={(e) =>
                setTokens(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="text-center w-24"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTokens(tokens + 1)}
            >
              +
            </Button>
          </div>
          <p className="text-[10px] text-neutral-600 mt-2 font-mono">
            Price per token: {formatCurrency(property.tokenPrice)}
          </p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod("usdc")}
              className={cn(
                "p-4 rounded-lg border-2 transition-all text-left cursor-pointer",
                paymentMethod === "usdc"
                  ? "border-[#00ff88] bg-[#00ff88]/10"
                  : "border-[#262626] hover:border-[#404040]",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                  $
                </div>
                <span className="font-medium text-white">USDC</span>
              </div>
              <p className="text-xs text-neutral-500">Pay with stablecoin</p>
            </button>
            <button
              onClick={() => setPaymentMethod("fiat")}
              className={cn(
                "p-4 rounded-lg border-2 transition-all text-left cursor-pointer",
                paymentMethod === "fiat"
                  ? "border-[#00ff88] bg-[#00ff88]/10"
                  : "border-[#262626] hover:border-[#404040]",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-6 h-6 text-[#00ff88]" />
                <span className="font-medium text-white">Fiat</span>
              </div>
              <p className="text-xs text-neutral-500">Card / Bank transfer</p>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Tokens</span>
            <span className="text-white font-mono">{tokens}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Price per Token</span>
            <span className="text-white font-mono">
              {formatCurrency(property.tokenPrice)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Est. Annual Yield</span>
            <span className="text-[#00ff88] font-mono">
              {formatCurrency(estimatedYield)}
            </span>
          </div>
          <div className="border-t border-[#262626] pt-3 flex justify-between">
            <span className="font-medium text-white">Total</span>
            <span className="font-bold text-xl text-white font-mono">
              {formatCurrency(totalCost)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            isSecure
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Confirm Investment
          </Button>
        </div>

        <p className="text-[10px] text-neutral-600 text-center flex items-center justify-center gap-1 font-mono">
          <Lock className="w-3 h-3" />
          Secured by Stellar blockchain with institutional custody
        </p>
      </div>
    </Modal>
  );
}

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [selectedType, setSelectedType] = useState("All Types");
  const [sortBy, setSortBy] = useState("Highest Yield");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<
    (typeof properties)[0] | null
  >(null);

  // Filter and sort properties
  const filteredProperties = properties
    .filter((p) => {
      if (
        searchQuery &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (selectedRegion !== "All Regions" && p.region !== selectedRegion)
        return false;
      if (selectedType !== "All Types" && p.type !== selectedType) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "Highest Yield":
          return b.yield - a.yield;
        case "Lowest Price":
          return a.tokenPrice - b.tokenPrice;
        case "Most Funded":
          return b.soldTokens / b.totalTokens - a.soldTokens / a.totalTokens;
        default:
          return 0;
      }
    });

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-black"
    >
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={staggerItem}>
            <h1 className="text-2xl font-bold text-white">Marketplace</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Discover and invest in tokenized real estate across emerging
              markets
            </p>
          </motion.div>

          {/* Search and Filters */}
          <motion.div variants={staggerItem} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-5 h-5" />}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                leftIcon={<SlidersHorizontal className="w-4 h-4" />}
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
                  className="grid sm:grid-cols-3 gap-4 p-4 bg-[#0a0a0a] rounded-lg border border-[#262626]"
                >
                  <div>
                    <label className="block text-xs text-neutral-500 mb-2 uppercase tracking-wider">
                      Region
                    </label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-[#404040] cursor-pointer"
                    >
                      {regions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-2 uppercase tracking-wider">
                      Property Type
                    </label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-[#404040] cursor-pointer"
                    >
                      {propertyTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-2 uppercase tracking-wider">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-[#404040] cursor-pointer"
                    >
                      {sortOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Results Count */}
          <motion.div
            variants={staggerItem}
            className="flex items-center justify-between"
          >
            <p className="text-xs text-neutral-500 font-mono">
              Showing{" "}
              <span className="text-white font-medium">
                {filteredProperties.length}
              </span>{" "}
              properties
            </p>
          </motion.div>

          {/* Property Grid */}
          <motion.div
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredProperties.map((property) => (
              <motion.div key={property.id} variants={staggerItem}>
                <Card
                  noPadding
                  hoverable
                  className="overflow-hidden group"
                  onClick={() => setSelectedProperty(property)}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={property.image}
                      alt={property.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {property.featured && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="info">Featured</Badge>
                      </div>
                    )}
                    {property.verified && (
                      <div className="absolute top-3 right-3">
                        <div className="w-8 h-8 rounded-full bg-[#00ff88] flex items-center justify-center">
                          <Lock className="w-4 h-4 text-black" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-[#ff3e00] transition-colors">
                          {property.name}
                        </h3>
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {property.location}
                        </p>
                      </div>
                      <Badge variant="outline">{property.type}</Badge>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-neutral-500">
                          Funding Progress
                        </span>
                        <span className="text-white font-medium font-mono">
                          {Math.round(
                            (property.soldTokens / property.totalTokens) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(property.soldTokens / property.totalTokens) * 100}%`,
                          }}
                          transition={{ duration: 1, delay: 0.3 }}
                          className="h-full bg-gradient-to-r from-[#ff3e00] to-[#00ff88]"
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#1a1a1a]">
                      <div className="text-center">
                        <p className="text-sm font-bold text-white font-mono">
                          {property.yield}%
                        </p>
                        <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                          APY
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white font-mono">
                          ${property.tokenPrice}
                        </p>
                        <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                          Min
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white font-mono">
                          {(
                            property.totalTokens - property.soldTokens
                          ).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                          Left
                        </p>
                      </div>
                    </div>

                    <Button className="w-full mt-4" size="sm">
                      Invest Now
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {filteredProperties.length === 0 && (
            <motion.div variants={staggerItem} className="text-center py-16">
              <Building2 className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No properties found
              </h3>
              <p className="text-sm text-neutral-500">
                Try adjusting your filters or search query
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>
      <Footer />

      {/* Invest Modal */}
      {selectedProperty && (
        <InvestModal
          property={selectedProperty}
          isOpen={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </motion.div>
  );
}
