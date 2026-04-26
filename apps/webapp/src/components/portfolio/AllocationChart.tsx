"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface AllocationChartProps {
  allocation: Record<string, number>;
  totalValue: number;
  className?: string;
}

const TYPE_COLORS: Record<string, string> = {
  residential: "#00ff88",
  commercial: "#ff3e00",
  industrial: "#3b82f6",
  land: "#a855f7",
  mixed: "#f59e0b",
};

const DEFAULT_COLOR = "#525252";

export function AllocationChart({
  allocation,
  totalValue,
  className,
}: AllocationChartProps) {
  const [cumulative, setCumulative] = useState(0);

  const segments = useMemo(() => {
    if (totalValue === 0) return [];
    return Object.entries(allocation)
      .filter(([, v]) => v > 0)
      .map(([type, value]) => ({
        type,
        value,
        pct: (value / totalValue) * 100,
        color: TYPE_COLORS[type] ?? DEFAULT_COLOR,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allocation, totalValue]);

  if (segments.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-20 text-xs text-neutral-600",
          className,
        )}
      >
        No allocation data
      </div>
    );
  }

  // Build conic-gradient stops
  const stops = segments.map((s) => {
    const start = cumulative;
    setCumulative((prev) => prev + s.pct);
    return `${s.color} ${start.toFixed(1)}% ${cumulative.toFixed(1)}%`;
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Donut */}
      <div className="flex justify-center">
        <div
          className="w-24 h-24 rounded-full"
          style={{
            background: gradient,
            WebkitMask: "radial-gradient(circle, transparent 38%, black 39%)",
            mask: "radial-gradient(circle, transparent 38%, black 39%)",
          }}
          aria-label="Portfolio allocation chart"
          role="img"
        />
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.type} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-xs text-neutral-400 capitalize">
                {s.type}
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-300">
              {s.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
