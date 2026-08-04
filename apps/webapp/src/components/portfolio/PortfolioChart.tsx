"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  usePortfolioPerformance,
  type TimeRange,
} from "@/hooks/usePortfolioPerformance";

interface PortfolioChartProps {
  walletAddress: string | null | undefined;
  className?: string;
}

/** Format a USD value compactly: 1 250 000 → $1.25M */
function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

/** Format a collateral ratio percentage */
function formatRatio(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Short month-day label for the x-axis */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const TIME_RANGES: TimeRange[] = ["1M", "3M", "ALL"];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div
      className="w-full h-64 rounded-lg bg-[#1a1a1a] animate-pulse"
      role="status"
      aria-label="Loading chart"
    />
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

interface ChartErrorProps {
  message: string;
  onRetry: () => void;
}

function ChartError({ message, onRetry }: ChartErrorProps) {
  return (
    <div
      className="w-full h-64 flex flex-col items-center justify-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5"
      role="alert"
    >
      <AlertCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
      <p className="text-xs text-red-400 text-center max-w-xs">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs text-red-400 underline hover:text-red-300 transition-colors"
        aria-label="Retry loading chart data"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (wallet connected but no data yet)
// ---------------------------------------------------------------------------

function ChartEmpty() {
  return (
    <div className="w-full h-64 flex flex-col items-center justify-center gap-3 rounded-lg border border-[#262626] bg-[#0a0a0a]">
      <TrendingUp className="w-8 h-8 text-neutral-700" aria-hidden="true" />
      <p className="text-xs text-neutral-500">No performance data yet</p>
      <p className="text-[10px] text-neutral-600">
        Data will appear once you hold tokenised properties
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recharts custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#111111] p-3 shadow-xl text-xs space-y-1.5">
      <p className="text-neutral-400 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-neutral-400">{entry.name}:</span>
          <span className="font-mono font-medium text-white">
            {entry.dataKey === "holdingsValue"
              ? formatUSD(entry.value)
              : formatRatio(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PortfolioChart({
  walletAddress,
  className,
}: PortfolioChartProps) {
  const [range, setRange] = useState<TimeRange>("3M");
  const { data, isLoading, error, refetch } = usePortfolioPerformance(
    walletAddress,
    range,
  );

  // Decide how many x-axis ticks to show based on range
  const tickCount = range === "1M" ? 6 : range === "3M" ? 7 : 8;

  // Build evenly-spaced tick indexes
  const tickIndexes = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * Math.max(data.length - 1, 0)),
  );
  const xTicks = tickIndexes
    .map((idx) => data[idx]?.date)
    .filter((d): d is string => Boolean(d));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Portfolio Performance</CardTitle>

          {/* Time-range switcher */}
          <div
            className="flex items-center gap-1 p-0.5 rounded-lg bg-[#1a1a1a] border border-[#262626]"
            role="group"
            aria-label="Select time range"
          >
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  range === r
                    ? "bg-[#262626] text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Legend row */}
        {!isLoading && !error && data.length > 0 && (
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#00ff88] inline-block rounded" />
              <span className="text-[10px] text-neutral-500">
                Holdings Value
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#ff3e00] inline-block rounded" />
              <span className="text-[10px] text-neutral-500">
                Collateral Ratio
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : error ? (
          <ChartError message={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={data}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="portfolioGreenGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="portfolioOrangeGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#ff3e00" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ff3e00" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1a1a1a"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                ticks={xTicks}
                tickFormatter={formatDate}
                tick={{ fill: "#737373", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />

              {/* Left y-axis: holdings value */}
              <YAxis
                yAxisId="holdings"
                orientation="left"
                tickFormatter={formatUSD}
                tick={{ fill: "#737373", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />

              {/* Right y-axis: collateral ratio */}
              <YAxis
                yAxisId="ratio"
                orientation="right"
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "#737373", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={["auto", "auto"]}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "#333333", strokeWidth: 1 }}
              />

              {/* Hidden Legend — we render our own above */}
              <Legend wrapperStyle={{ display: "none" }} />

              <Area
                yAxisId="holdings"
                type="monotone"
                dataKey="holdingsValue"
                name="Holdings Value"
                stroke="#00ff88"
                strokeWidth={1.5}
                fill="url(#portfolioGreenGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "#00ff88" }}
              />

              <Area
                yAxisId="ratio"
                type="monotone"
                dataKey="collateralRatio"
                name="Collateral Ratio"
                stroke="#ff3e00"
                strokeWidth={1.5}
                fill="url(#portfolioOrangeGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "#ff3e00" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
