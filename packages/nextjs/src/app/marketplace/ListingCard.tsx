"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Listing, LEVEL_LABELS } from "./types";

interface ListingCardProps {
  listing: Listing;
  onClick: () => void;
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const { coords, level, incomeRate, price, seller, listedAt, tileColor } =
    listing;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
      aria-label={`Buy property at (${coords.x}, ${coords.y}) for ${price} LAND`}
    >
      {/* Tile preview */}
      <div
        className="h-28 w-full flex items-center justify-center text-4xl font-bold text-white/80 select-none"
        style={{ backgroundColor: tileColor }}
        aria-hidden="true"
      >
        {level === 0
          ? "🏕"
          : level === 1
            ? "🏠"
            : level === 2
              ? "🏡"
              : level === 3
                ? "🏛"
                : level === 4
                  ? "🏢"
                  : "🏙"}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            ({coords.x}, {coords.y})
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(listedAt, { addSuffix: true })}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: tileColor }}
            aria-hidden="true"
          />
          <span className="text-sm font-medium">{LEVEL_LABELS[level]}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {incomeRate > 0 ? `+${incomeRate} LAND/hr` : "No income"}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="font-semibold text-primary">
            {price.toLocaleString()} LAND
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[80px]">
            {seller}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
