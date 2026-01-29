# C1-014: Add Pagination Types and Utilities

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                              |
| --------------- | ---------------------------------- |
| Issue ID        | C1-014                             |
| Title           | Add pagination types and utilities |
| Area            | SHARED                             |
| Difficulty      | Trivial                            |
| Labels          | shared, utilities, trivial         |
| Dependencies    | None                               |
| Estimated Lines | 40-60                              |

## Overview

Consistent pagination across the application ensures predictable API responses and simplifies frontend integration. This issue establishes shared types and utilities for pagination.

## Implementation Steps

### Step 1: Create Pagination Types

Create `apps/shared/src/types/pagination.ts`:

```typescript
/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of items for current page */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Cursor-based pagination params (for infinite scroll)
 */
export interface CursorPaginationParams {
  /** Cursor for next page */
  cursor?: string;
  /** Items per page */
  limit: number;
  /** Sort direction */
  direction?: "forward" | "backward";
}

/**
 * Cursor-based pagination response
 */
export interface CursorPaginatedResponse<T> {
  /** Array of items */
  data: T[];
  /** Cursor for next page (null if no more) */
  nextCursor: string | null;
  /** Cursor for previous page (null if at start) */
  prevCursor: string | null;
  /** Whether there are more items */
  hasMore: boolean;
}
```

### Step 2: Create Pagination Utilities

Create `apps/shared/src/utils/pagination.ts`:

```typescript
import type {
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
} from "../types/pagination";

/**
 * Default pagination values
 */
export const PAGINATION_DEFAULTS = {
  /** Default page number */
  page: 1,
  /** Default items per page */
  limit: 20,
  /** Maximum items per page */
  maxLimit: 100,
  /** Default sort order */
  sortOrder: "desc" as const,
} as const;

/**
 * Calculate database offset from page and limit
 */
export function calculateOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * limit;
}

/**
 * Calculate total number of pages
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / Math.max(1, limit));
}

/**
 * Create pagination metadata from params and total
 */
export function createPaginationMeta(
  params: Pick<PaginationParams, "page" | "limit">,
  total: number,
): PaginationMeta {
  const totalPages = calculateTotalPages(total, params.limit);

  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  params: Pick<PaginationParams, "page" | "limit">,
  total: number,
): PaginatedResponse<T> {
  return {
    data,
    pagination: createPaginationMeta(params, total),
  };
}

/**
 * Normalize pagination params with defaults
 */
export function normalizePaginationParams(
  params: Partial<PaginationParams>,
): PaginationParams {
  return {
    page: Math.max(1, params.page || PAGINATION_DEFAULTS.page),
    limit: Math.min(
      PAGINATION_DEFAULTS.maxLimit,
      Math.max(1, params.limit || PAGINATION_DEFAULTS.limit),
    ),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder || PAGINATION_DEFAULTS.sortOrder,
  };
}

/**
 * Get pagination range display (e.g., "1-20 of 100")
 */
export function getPaginationRange(meta: PaginationMeta): {
  start: number;
  end: number;
  total: number;
} {
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  return { start, end, total: meta.total };
}

/**
 * Format pagination range as string
 */
export function formatPaginationRange(meta: PaginationMeta): string {
  const { start, end, total } = getPaginationRange(meta);

  if (total === 0) {
    return "No results";
  }

  return `${start}-${end} of ${total}`;
}

/**
 * Generate page numbers for pagination UI
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5,
): (number | "ellipsis")[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const halfVisible = Math.floor(maxVisible / 2);

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  let start = Math.max(2, currentPage - halfVisible);
  let end = Math.min(totalPages - 1, currentPage + halfVisible);

  // Adjust if at edges
  if (currentPage <= halfVisible + 1) {
    end = Math.min(totalPages - 1, maxVisible - 1);
  } else if (currentPage >= totalPages - halfVisible) {
    start = Math.max(2, totalPages - maxVisible + 2);
  }

  // Add ellipsis if needed before range
  if (start > 2) {
    pages.push("ellipsis");
  }

  // Add page numbers in range
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Add ellipsis if needed after range
  if (end < totalPages - 1) {
    pages.push("ellipsis");
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
```

### Step 3: Update Type Index

Update `apps/shared/src/types/index.ts`:

```typescript
export * from "./property";
export * from "./lending";
export * from "./user";
export * from "./pagination";
```

### Step 4: Update Utils Index

Update `apps/shared/src/utils/index.ts`:

```typescript
export * from "./validation";
export * from "./format";
export * from "./pagination";
```

## Usage Examples

### In API

```typescript
import {
  normalizePaginationParams,
  createPaginatedResponse,
  calculateOffset,
} from "@akkuea/shared";

async function getProperties(query: any) {
  const params = normalizePaginationParams(query);
  const offset = calculateOffset(params.page, params.limit);

  const [data, total] = await Promise.all([
    db.query.properties.findMany({
      offset,
      limit: params.limit,
    }),
    db.query.properties.count(),
  ]);

  return createPaginatedResponse(data, params, total);
}
```

### In Frontend

```typescript
import {
  formatPaginationRange,
  generatePageNumbers,
  type PaginationMeta,
} from '@akkuea/shared';

function Pagination({ meta }: { meta: PaginationMeta }) {
  const pages = generatePageNumbers(meta.page, meta.totalPages);

  return (
    <div>
      <span>{formatPaginationRange(meta)}</span>
      <div>
        {pages.map((page, i) =>
          page === 'ellipsis' ? (
            <span key={i}>...</span>
          ) : (
            <button key={page}>{page}</button>
          )
        )}
      </div>
    </div>
  );
}
```

## Testing Guidelines

### Unit Tests

```typescript
import { describe, it, expect } from "bun:test";
import {
  calculateOffset,
  calculateTotalPages,
  createPaginationMeta,
  normalizePaginationParams,
  generatePageNumbers,
} from "../src/utils/pagination";

describe("calculateOffset", () => {
  it("calculates correct offset for page 1", () => {
    expect(calculateOffset(1, 20)).toBe(0);
  });

  it("calculates correct offset for page 2", () => {
    expect(calculateOffset(2, 20)).toBe(20);
  });

  it("handles page 0 as page 1", () => {
    expect(calculateOffset(0, 20)).toBe(0);
  });
});

describe("calculateTotalPages", () => {
  it("calculates exact division", () => {
    expect(calculateTotalPages(100, 20)).toBe(5);
  });

  it("rounds up for remainder", () => {
    expect(calculateTotalPages(101, 20)).toBe(6);
  });

  it("handles zero total", () => {
    expect(calculateTotalPages(0, 20)).toBe(0);
  });
});

describe("generatePageNumbers", () => {
  it("shows all pages when total is small", () => {
    expect(generatePageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it("includes ellipsis for large page counts", () => {
    const pages = generatePageNumbers(5, 10);
    expect(pages).toContain("ellipsis");
  });
});
```

## Related Resources

| Resource                      | Link                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| API Pagination Best Practices | https://www.moesif.com/blog/technical/api-design/REST-API-Design-Filtering-Sorting-and-Pagination/ |

## Verification Checklist

| Item                  | Status |
| --------------------- | ------ |
| Types defined         |        |
| Utilities implemented |        |
| Default constants set |        |
| Exported from shared  |        |
| Tests passing         |        |
