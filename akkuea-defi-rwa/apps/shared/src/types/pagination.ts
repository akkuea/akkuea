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
