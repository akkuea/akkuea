import React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton base component props
 */
interface SkeletonProps {
  className?: string;
  variant?: "default" | "circular" | "rectangular";
  animation?: "pulse" | "wave" | "none";
  width?: string | number;
  height?: string | number;
}

/**
 * Base skeleton component with animation
 */
export function Skeleton({
  className,
  variant = "default",
  animation = "pulse",
  width,
  height,
}: SkeletonProps) {
  const variantStyles = {
    default: "rounded-md",
    circular: "rounded-full",
    rectangular: "rounded-none",
  };

  const animationStyles = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        "bg-white/10",
        variantStyles[variant],
        animationStyles[animation],
        className,
      )}
      style={style}
      role="status"
      aria-label="Loading..."
    />
  );
}

/**
 * Skeleton for text content
 */
interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 1,
  className,
  lastLineWidth = "75%",
}: SkeletonTextProps) {
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-label="Loading text..."
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-4"
          width={index === lines - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for card content
 */
interface SkeletonCardProps {
  className?: string;
  hasImage?: boolean;
  imageHeight?: number;
  lines?: number;
}

export function SkeletonCard({
  className,
  hasImage = true,
  imageHeight = 200,
  lines = 3,
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/5 overflow-hidden",
        className,
      )}
      role="status"
      aria-label="Loading card..."
    >
      {hasImage && (
        <Skeleton
          className="w-full"
          height={imageHeight}
          variant="rectangular"
        />
      )}
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <SkeletonText lines={lines} />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows
 */
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-label="Loading table..."
    >
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-white/10">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1"
              width={colIndex === 0 ? "60%" : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for avatar
 */
interface SkeletonAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SkeletonAvatar({
  size = "md",
  className,
}: SkeletonAvatarProps) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return <Skeleton variant="circular" className={cn(sizes[size], className)} />;
}

/**
 * Skeleton for property card
 */
export function SkeletonPropertyCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/5 overflow-hidden",
        className,
      )}
      role="status"
      aria-label="Loading property..."
    >
      <Skeleton className="w-full h-48" variant="rectangular" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <Skeleton className="h-10 w-full mt-2" />
      </div>
    </div>
  );
}

/**
 * Skeleton for lending pool card
 */
export function SkeletonPoolCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/5 p-4 space-y-4",
        className,
      )}
      role="status"
      aria-label="Loading pool..."
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="lg" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}
