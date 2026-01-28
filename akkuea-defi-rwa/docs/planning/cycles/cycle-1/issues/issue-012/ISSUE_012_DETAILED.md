# C1-012: Add Loading Skeleton Components

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                           |
| --------------- | ------------------------------- |
| Issue ID        | C1-012                          |
| Title           | Add loading skeleton components |
| Area            | WEBAPP                          |
| Difficulty      | Trivial                         |
| Labels          | frontend, ui, trivial           |
| Dependencies    | None                            |
| Estimated Lines | 60-100                          |

## Overview

Skeleton components display placeholder content while data is loading. They maintain layout stability and provide visual feedback that content is being fetched.

## Implementation Steps

### Step 1: Create Skeleton Component

Create `apps/webapp/src/components/ui/Skeleton.tsx`:

```typescript
import { cn } from '@/lib/utils';

/**
 * Skeleton base component props
 */
interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
  width?: string | number;
  height?: string | number;
}

/**
 * Base skeleton component with animation
 */
export function Skeleton({
  className,
  variant = 'default',
  animation = 'pulse',
  width,
  height,
}: SkeletonProps) {
  const variantStyles = {
    default: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        'bg-white/10',
        variantStyles[variant],
        animationStyles[animation],
        className
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
  lastLineWidth = '75%',
}: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading text...">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-4"
          width={index === lines - 1 ? lastLineWidth : '100%'}
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
        'rounded-xl border border-white/10 bg-white/5 overflow-hidden',
        className
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
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading table...">
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
              width={colIndex === 0 ? '60%' : undefined}
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
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <Skeleton
      variant="circular"
      className={cn(sizes[size], className)}
    />
  );
}

/**
 * Skeleton for property card
 */
export function SkeletonPropertyCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 overflow-hidden',
        className
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
        'rounded-xl border border-white/10 bg-white/5 p-4 space-y-4',
        className
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
```

### Step 2: Add Shimmer Animation

Add to `apps/webapp/src/app/globals.css`:

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Step 3: Update UI Index

Update `apps/webapp/src/components/ui/index.ts`:

```typescript
export { Button } from "./Button";
export { Card } from "./Card";
export { Badge } from "./Badge";
export { Input } from "./Input";
export { Modal } from "./Modal";
export { Toggle } from "./Toggle";
export { Stepper } from "./Stepper";
export { Loader } from "./Loader";
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonAvatar,
  SkeletonPropertyCard,
  SkeletonPoolCard,
} from "./Skeleton";
```

## Usage Examples

### Loading Property Grid

```typescript
import { SkeletonPropertyCard } from '@/components/ui';

function PropertyGrid({ loading, properties }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonPropertyCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
```

### Loading Table

```typescript
import { SkeletonTable } from '@/components/ui';

function TransactionTable({ loading, transactions }) {
  if (loading) {
    return <SkeletonTable rows={10} columns={5} />;
  }

  return (
    <table>
      {/* ... table content ... */}
    </table>
  );
}
```

## Related Resources

| Resource            | Link                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| Skeleton Loading UI | https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a |
| CSS Animations      | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations              |

## Verification Checklist

| Item                            | Status |
| ------------------------------- | ------ |
| Base Skeleton component created |        |
| SkeletonText working            |        |
| SkeletonCard working            |        |
| SkeletonTable working           |        |
| Animations smooth               |        |
| Accessibility labels added      |        |
| Exported from ui index          |        |
