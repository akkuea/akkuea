'use client';

import React from 'react';

interface SpinnerProps {
  size?: string;
  colorClass?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = '40px', colorClass = 'text-primary' }) => {
  return (
    <div role="status" aria-live="polite" className="flex justify-center items-center">
      <svg
        className={`animate-spin ${colorClass}`}
        width={size}
        height={size}
        viewBox="0 0 50 50"
        fill="none"
      >
        <circle className="opacity-25 stroke-current" cx="25" cy="25" r="20" strokeWidth="5" />
        <path
          className="opacity-75 fill-current"
          d="M25 5a20 20 0 0 1 20 20h-5a15 15 0 0 0-15-15V5z"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
