"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Building2,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  TrendingUp,
} from "lucide-react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { Badge, Button, Card } from "@/components/ui";
import { PropertyViewer3DDynamic } from "./PropertyViewer3D.dynamic";
import { formatCurrency } from "@/lib/utils";
import {
  getPropertyImage,
  getPropertyTypeLabel,
} from "@/components/marketplace/marketplace.utils";

interface PropertyDetailProps {
  property: PropertyInfo;
  onInvestClick?: () => void;
  compact?: boolean;
}

export function PropertyDetail({
  property,
  onInvestClick,
  compact = false,
}: PropertyDetailProps) {
  const [viewer3DEnabled, setViewer3DEnabled] = useState(true);

  const displayImage = getPropertyImage(property);
  const fundingPercentage = Math.round(
    ((property.totalShares - property.availableShares) / property.totalShares) *
      100,
  );

  return (
    <div className={`space-y-4 ${compact ? "space-y-3" : "space-y-6"}`}>
      {/* 3D Viewer Section */}
      {property.splatUrl && viewer3DEnabled && (
        <Card className="p-0 overflow-hidden">
          <PropertyViewer3DDynamic
            splatUrl={property.splatUrl}
            propertyName={property.name}
            onError={(error) => {
              console.error("3D viewer error:", error);
              setViewer3DEnabled(false);
            }}
          />
        </Card>
      )}

      {/* Image Section (fallback if no 3D viewer) */}
      {(!property.splatUrl || !viewer3DEnabled) && (
        <Card noPadding className="overflow-hidden">
          <div className="relative h-64 w-full">
            <Image
              src={displayImage}
              alt={property.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Card>
      )}

      {/* Header Info */}
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">{property.name}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
              <MapPin className="h-4 w-4" />
              {property.location.address}
            </p>
            <p className="text-xs text-neutral-500">
              {property.location.city}, {property.location.country}
              {property.location.postalCode &&
                ` ${property.location.postalCode}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge>{getPropertyTypeLabel(property.propertyType)}</Badge>
            {property.verified && <Badge variant="success">Verified</Badge>}
          </div>
        </div>

        <p className={`text-neutral-400 ${compact ? "text-xs" : "text-sm"}`}>
          {property.description}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#ff3e00]" />
            <div>
              <p className="text-xs text-neutral-500">Total Value</p>
              <p className="font-mono font-bold text-white">
                {formatCurrency(parseFloat(property.totalValue))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#00ff88]" />
            <div>
              <p className="text-xs text-neutral-500">Price per Share</p>
              <p className="font-mono font-bold text-white">
                {formatCurrency(parseFloat(property.pricePerShare))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#00ccff]" />
            <div>
              <p className="text-xs text-neutral-500">Available</p>
              <p className="font-mono font-bold text-white">
                {property.availableShares.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xs text-neutral-500">Listed</p>
              <p className="font-mono font-bold text-white">
                {new Date(property.listedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Funding Progress */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-neutral-500" />
            <span className="text-sm font-medium text-white">
              Funding Progress
            </span>
          </div>
          <span className="font-mono text-sm font-bold text-[#00ff88]">
            {fundingPercentage}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
          <div
            className="h-full bg-gradient-to-r from-[#ff3e00] to-[#00ff88] transition-all duration-500"
            style={{ width: `${fundingPercentage}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {property.totalShares - property.availableShares} of{" "}
          {property.totalShares} shares sold
        </p>
      </Card>

      {/* Documents Section */}
      {property.documents.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <FileText className="h-4 w-4" />
            Property Documents
          </h3>
          <div className="space-y-2">
            {property.documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3 transition-colors hover:border-[#ff3e00]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {doc.name}
                  </p>
                  <p className="text-xs text-neutral-500 capitalize">
                    {doc.type}
                    {doc.verified && " • Verified"}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Action Button */}
      {onInvestClick && (
        <Button className="w-full" onClick={onInvestClick}>
          Proceed to Investment
        </Button>
      )}
    </div>
  );
}
