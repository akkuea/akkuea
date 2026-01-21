import React, { CSSProperties } from 'react';
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
