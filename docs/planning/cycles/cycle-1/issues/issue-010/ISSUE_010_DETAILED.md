# C1-010: Add Date and Number Formatting Utilities

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                    |
| --------------- | ---------------------------------------- |
| Issue ID        | C1-010                                   |
| Title           | Add date and number formatting utilities |
| Area            | SHARED                                   |
| Difficulty      | Trivial                                  |
| Labels          | shared, utilities, trivial               |
| Dependencies    | None                                     |
| Estimated Lines | 50-80                                    |

## Overview

Consistent formatting across the application improves user experience and code maintainability. These utilities provide standardized ways to display financial data, dates, and numbers.

## Implementation Steps

### Step 1: Create Formatting Utilities

Create `apps/shared/src/utils/format.ts`:

```typescript
/**
 * Format options for currency
 */
export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  value: number | string,
  options: CurrencyFormatOptions = {},
): string {
  const {
    currency = "USD",
    locale = "en-US",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return "$0.00";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numValue);
}

/**
 * Format a number as percentage
 */
export function formatPercent(
  value: number | string,
  decimals: number = 2,
  locale: string = "en-US",
): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return "0%";
  }

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(
  value: number | string,
  decimals: number = 0,
  locale: string = "en-US",
): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return "0";
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

/**
 * Abbreviate large numbers (e.g., 1.5M, 2.3B)
 */
export function abbreviateNumber(value: number | string): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return "0";
  }

  const absValue = Math.abs(numValue);
  const sign = numValue < 0 ? "-" : "";

  if (absValue >= 1_000_000_000) {
    return sign + (absValue / 1_000_000_000).toFixed(1) + "B";
  }
  if (absValue >= 1_000_000) {
    return sign + (absValue / 1_000_000).toFixed(1) + "M";
  }
  if (absValue >= 1_000) {
    return sign + (absValue / 1_000).toFixed(1) + "K";
  }

  return sign + absValue.toFixed(0);
}

/**
 * Date format options
 */
export type DateFormatStyle = "short" | "medium" | "long" | "full";

/**
 * Format a date
 */
export function formatDate(
  date: Date | string | number,
  style: DateFormatStyle = "medium",
  locale: string = "en-US",
): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const options: Intl.DateTimeFormatOptions = {
    short: { month: "numeric", day: "numeric", year: "2-digit" },
    medium: { month: "short", day: "numeric", year: "numeric" },
    long: { month: "long", day: "numeric", year: "numeric" },
    full: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  }[style];

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format a date with time
 */
export function formatDateTime(
  date: Date | string | number,
  locale: string = "en-US",
): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: string = "en-US",
): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, "second");
  }
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, "hour");
  }
  if (Math.abs(diffDay) < 30) {
    return rtf.format(diffDay, "day");
  }
  if (Math.abs(diffMonth) < 12) {
    return rtf.format(diffMonth, "month");
  }

  return rtf.format(diffYear, "year");
}

/**
 * Format a Stellar address for display (truncated)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address || address.length < chars * 2 + 3) {
    return address || "";
  }

  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: string | number,
  decimals: number = 7,
  displayDecimals: number = 2,
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return "0";
  }

  return formatNumber(numAmount, displayDecimals);
}
```

### Step 2: Update Utils Index

Update `apps/shared/src/utils/index.ts`:

```typescript
export * from "./validation";
export * from "./format";
```

## Usage Examples

### In React Components

```typescript
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  abbreviateNumber,
} from '@akkuea/shared';

function PropertyCard({ property }) {
  return (
    <div>
      <h3>{property.name}</h3>
      <p>Value: {formatCurrency(property.totalValue)}</p>
      <p>Price per share: {formatCurrency(property.pricePerShare)}</p>
      <p>APY: {formatPercent(property.apy)}</p>
      <p>Total value: {abbreviateNumber(property.totalValue)}</p>
      <p>Listed {formatRelativeTime(property.listedAt)}</p>
    </div>
  );
}
```

### In API Responses

```typescript
import { formatDate, formatCurrency } from "@akkuea/shared";

function formatPropertyResponse(property) {
  return {
    ...property,
    formattedValue: formatCurrency(property.totalValue),
    formattedDate: formatDate(property.listedAt, "long"),
  };
}
```

## Testing Guidelines

### Unit Tests

```typescript
import { describe, it, expect } from "bun:test";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelativeTime,
  abbreviateNumber,
  formatAddress,
} from "../src/utils/format";

describe("formatCurrency", () => {
  it("formats USD correctly", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles large numbers", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(0.1234)).toBe("12.34%");
  });

  it("formats with custom decimals", () => {
    expect(formatPercent(0.1, 0)).toBe("10%");
  });
});

describe("abbreviateNumber", () => {
  it("abbreviates thousands", () => {
    expect(abbreviateNumber(1500)).toBe("1.5K");
  });

  it("abbreviates millions", () => {
    expect(abbreviateNumber(1500000)).toBe("1.5M");
  });

  it("abbreviates billions", () => {
    expect(abbreviateNumber(1500000000)).toBe("1.5B");
  });
});

describe("formatRelativeTime", () => {
  it("formats past dates", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 hours ago");
  });
});

describe("formatAddress", () => {
  it("truncates address", () => {
    const address =
      "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    expect(formatAddress(address)).toBe("GBXX...XXXX");
  });
});
```

## Related Resources

| Resource                | Link                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Intl.NumberFormat       | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat       |
| Intl.DateTimeFormat     | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat     |
| Intl.RelativeTimeFormat | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat |

## Verification Checklist

| Item                        | Status |
| --------------------------- | ------ |
| Currency formatting working |        |
| Percent formatting working  |        |
| Date formatting working     |        |
| Relative time working       |        |
| Number abbreviation working |        |
| Tests passing               |        |
| Exported from shared        |        |
