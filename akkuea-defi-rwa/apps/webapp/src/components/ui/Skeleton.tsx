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
