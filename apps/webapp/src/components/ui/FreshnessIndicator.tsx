"use client";

import { useEffect, useMemo, useState } from "react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import { getTimeSinceUpdate } from "@/hooks/useLiveUpdates";

interface FreshnessIndicatorProps {
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  isPolling?: boolean;
  onRefresh?: () => void;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<
  ConnectionStatus,
  { color: string; bgColor: string; label: string }
> = {
  connected: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    label: "Live",
  },
  connecting: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    label: "Connecting",
  },
  disconnected: {
    color: "text-neutral-500",
    bgColor: "bg-neutral-500/10 border-neutral-500/30",
    label: "Offline",
  },
};

export function FreshnessIndicator({
  lastUpdatedAt,
  connectionStatus,
  isPolling = false,
  onRefresh,
  className,
  showLabel = true,
}: FreshnessIndicatorProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const timeSince = useMemo(() => {
    void tick;
    return getTimeSinceUpdate(lastUpdatedAt);
  }, [lastUpdatedAt, tick]);

  const config = statusConfig[connectionStatus];
  const StatusIcon =
    connectionStatus === "disconnected"
      ? WifiOff
      : connectionStatus === "connecting"
        ? RefreshCw
        : Wifi;

  const isStale = connectionStatus === "disconnected" && lastUpdatedAt !== null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1",
        config.bgColor,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`Data status: ${isStale ? "stale, " : ""}${config.label}. Last updated: ${timeSince}`}
    >
      {isStale && (
        <AlertTriangle
          className="h-3 w-3 text-amber-400"
          aria-hidden="true"
        />
      )}
      <StatusIcon
        className={cn(
          "h-3 w-3",
          config.color,
          connectionStatus === "connecting" && "animate-spin",
        )}
        aria-hidden="true"
      />

      {showLabel && (
        <span className={cn("text-[10px] font-medium", config.color)}>
          {isPolling && connectionStatus === "connected"
            ? "Polling"
            : isStale
              ? `Stale (${config.label})`
              : config.label}
        </span>
      )}

      <span className="text-[10px] text-neutral-500">
        {isStale ? `stale ${timeSince} ago` : timeSince}
      </span>

      {onRefresh && connectionStatus !== "connecting" && (
        <button
          onClick={onRefresh}
          className="ml-1 rounded p-0.5 hover:bg-white/10 transition-colors"
          aria-label="Refresh data"
        >
          <RefreshCw className="h-3 w-3 text-neutral-500 hover:text-white" />
        </button>
      )}
    </div>
  );
}
