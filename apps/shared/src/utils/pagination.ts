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
