import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Improved ID generation with persistence
export function generateMessageId(prefix = 'msg'): string {
  // Get the counter from localStorage or initialize it
  let counter: number;

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('messageIdCounter');
    counter = stored ? Number.parseInt(stored, 10) : 0;
    counter++;
    localStorage.setItem('messageIdCounter', counter.toString());
  } else {
    // Fallback for server-side rendering
    counter = Date.now();
  }

  // Combine timestamp and counter for uniqueness
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${counter}`;
}

// Add consistent timestamp generation
export function getFormattedTime() {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

/**
 * Formats an address string to show the first 7 and last 4 characters with ellipses
 * @param address The address string to format
 * @returns Formatted address string (e.g., "0x12345...6789")
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 11) return address;
  return `${address.slice(0, 7)}...${address.slice(-4)}`;
}

export const TIME_CONSTS = {
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
} as const;

// Generate sample heatmap data for user dashboard activity
export function generateHeatmapData(): number[][] {
  const months = TIME_CONSTS.months;
  return Array(TIME_CONSTS.weekdays.length)
    .fill(0)
    .map(() =>
      Array(months.length)
        .fill(0)
        .map(() => Math.floor(Math.random() * 5))
    );
}
