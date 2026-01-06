'use client';

import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = '20px', rounded = 'md' }) => {
  return (
    <div
      className={`bg-muted animate-pulse rounded-${rounded}`}
      style={{ width, height }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Skeleton;
