"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Listing, LEVEL_LABELS } from "./types";
import { Button } from "@/components/ui/button";

interface BuyModalProps {
  listing: Listing;
  balance: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function BuyModal({
  listing,
  balance,
  onClose,
  onConfirm,
}: BuyModalProps) {
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canAfford = balance >= listing.price;
  const deficit = listing.price - balance;

  // Focus close button on open; close on Escape
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <motion.div
        key="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl"
          initial={{ scale: 0.95, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 16 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            ref={closeRef}
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Tile preview */}
          <div
            className="h-24 rounded-t-2xl flex items-center justify-center text-5xl"
            style={{ backgroundColor: listing.tileColor }}
            aria-hidden="true"
          >
            {listing.level === 0
              ? "🏕"
              : listing.level === 1
                ? "🏠"
                : listing.level === 2
                  ? "🏡"
                  : listing.level === 3
                    ? "🏛"
                    : listing.level === 4
                      ? "🏢"
                      : "🏙"}
          </div>

          <div className="p-5 space-y-4">
            <h2 id="buy-modal-title" className="text-lg font-semibold">
              Confirm Purchase
            </h2>

            {/* Property details */}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-mono">
                  ({listing.coords.x}, {listing.coords.y})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Building</dt>
                <dd>{LEVEL_LABELS[listing.level]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Income</dt>
                <dd>
                  {listing.incomeRate > 0
                    ? `+${listing.incomeRate} LAND/hr`
                    : "None"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Seller</dt>
                <dd className="font-mono text-xs">{listing.seller}</dd>
              </div>
            </dl>

            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your balance</span>
                <span
                  className={canAfford ? "text-green-500" : "text-destructive"}
                >
                  {balance.toLocaleString()} LAND
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Price</span>
                <span className="text-primary">
                  {listing.price.toLocaleString()} LAND
                </span>
              </div>
              {!canAfford && (
                <p className="text-xs text-destructive" role="alert">
                  You need {deficit.toLocaleString()} more LAND to buy this
                  property.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={!canAfford || loading}
                aria-disabled={!canAfford || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buying…
                  </>
                ) : (
                  "Confirm Purchase"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
