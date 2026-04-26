"use client";

import Image from "next/image";
import { Building2, MapPin, TrendingUp, Layers } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { PortfolioProperty } from "@/hooks/usePortfolio";

interface PropertyReportCardProps {
  item: PortfolioProperty;
  showValue: boolean;
}

const TYPE_BADGE: Record<string, "default" | "success" | "info" | "warning"> = {
  residential: "success",
  commercial: "info",
  industrial: "warning",
  land: "default",
  mixed: "default",
};

export function PropertyReportCard({
  item,
  showValue,
}: PropertyReportCardProps) {
  const { property, shares, estimatedValue, yieldRate } = item;
  const image = property.images[0];
  const ownershipPct = (shares / property.totalShares) * 100;
  const pricePerShare = parseFloat(property.pricePerShare);

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-[#0a0a0a] transition-colors cursor-pointer">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-[#1a1a1a] overflow-hidden shrink-0">
        {image ? (
          <Image
            src={image}
            alt={property.name}
            width={56}
            height={56}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-5 h-5 text-neutral-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium text-white truncate">
            {property.name}
          </h3>
          <Badge variant={TYPE_BADGE[property.propertyType] ?? "default"}>
            {property.propertyType}
          </Badge>
        </div>
        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {property.location.city}, {property.location.country}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-neutral-600 font-mono flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {shares.toLocaleString()} shares ({ownershipPct.toFixed(2)}%)
          </span>
          {property.verified && (
            <span className="text-[10px] text-[#00ff88]">✓ Verified</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-medium text-white font-mono">
          {showValue ? formatCurrency(estimatedValue) : "••••••"}
        </p>
        <p className="text-[10px] text-neutral-600 font-mono">
          {showValue ? `${formatCurrency(pricePerShare)} / share` : "••••"}
        </p>
        {yieldRate > 0 ? (
          <Badge variant="success" className="text-[10px]">
            <TrendingUp className="w-3 h-3" />
            {formatPercentage(yieldRate)} APY
          </Badge>
        ) : (
          <span className="text-[10px] text-neutral-600">—</span>
        )}
      </div>
    </div>
  );
}
