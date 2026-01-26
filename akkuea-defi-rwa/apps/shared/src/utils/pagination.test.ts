import { describe, it, expect } from "bun:test";
import {
  calculateOffset,
  calculateTotalPages,
  createPaginationMeta,
  normalizePaginationParams,
  generatePageNumbers,
  PAGINATION_DEFAULTS,
} from "./pagination";
import { PaginationParams } from "../types";

describe("Pagination Utilities", () => {
  describe("calculateOffset", () => {
    it("calculates correct offset for page 1", () => {
      // calculateOffset(page: number, limit: number): number
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
      // calculateTotalPages(total: number, limit: number): number
      expect(calculateTotalPages(100, 20)).toBe(5);
    });

    it("rounds up for remainder", () => {
      expect(calculateTotalPages(101, 20)).toBe(6);
    });

    it("handles zero total", () => {
      expect(calculateTotalPages(0, 20)).toBe(0);
    });
  });

  describe("createPaginationMeta", () => {
    it("creates correct meta for first page", () => {
      // createPaginationMeta(params: Pick<PaginationParams, 'page' | 'limit'>, total: number): PaginationMeta
      const meta = createPaginationMeta({ page: 1, limit: 20 }, 100);

      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.total).toBe(100);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it("creates correct meta for last page", () => {
      const meta = createPaginationMeta({ page: 5, limit: 20 }, 100);

      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });
  });

  describe("normalizePaginationParams", () => {
    it("uses default page size of 20", () => {
      // normalizePaginationParams(params: Partial<PaginationParams>): PaginationParams
      const params = normalizePaginationParams({});
      expect(params.limit).toBe(20);
    });

    it("enforces minimum page of 1", () => {
      const params = normalizePaginationParams({ page: 0 });
      expect(params.page).toBe(1);
    });

    it("enforces maximum limit of 100", () => {
      const params = normalizePaginationParams({ limit: 200 });
      expect(params.limit).toBe(PAGINATION_DEFAULTS.maxLimit); // 100
    });

    it("preserves valid values", () => {
      const params: PaginationParams = normalizePaginationParams({
        page: 5,
        limit: 50,
        sortBy: "createdAt",
        sortOrder: "asc",
      });

      expect(params.page).toBe(5);
      expect(params.limit).toBe(50);
      expect(params.sortBy).toBe("createdAt");
      expect(params.sortOrder).toBe("asc");
    });
  });

  describe("generatePageNumbers", () => {
    it("shows all pages when total is small", () => {
      // generatePageNumbers(currentPage: number, totalPages: number, maxVisible?: number): (number | 'ellipsis')[]
      const pages = generatePageNumbers(1, 3);
      expect(pages).toEqual([1, 2, 3]);
    });

    it("includes ellipsis for large page counts", () => {
      const pages = generatePageNumbers(5, 10);
      expect(pages).toContain("ellipsis");
      expect(pages[0]).toBe(1);
      expect(pages[pages.length - 1]).toBe(10);
    });
  });
});
