import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  animation?: 'pulse' | 'wave' | 'none';
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  animation = 'pulse',
}) => {
  let baseClasses = '';

  switch (variant) {
    case 'circular':
      baseClasses += 'rounded-full';
      break;
    case 'text':
      baseClasses += 'h-4 rounded';
      break;
    case 'rectangular':
    default:
      baseClasses += 'rounded';
      break;
  }

  switch (animation) {
    case 'pulse':
      baseClasses += ' animate-pulse';
      break;
    case 'wave':
      baseClasses +=
        ' relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent';
      break;
    case 'none':
    default:
      break;
  }

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 ${baseClasses} ${className}`}
      role="status"
      aria-label="loading"
    />
  );
};

export default Skeleton;
