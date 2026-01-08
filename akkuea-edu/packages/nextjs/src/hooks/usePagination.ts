import { useState, useMemo, useCallback } from 'react';

export interface UsePaginationProps<T> {
  data: T[];
  pageSize: number;
  initialPage?: number;
}

export interface UsePaginationReturn<T> {
  // Data
  currentPageData: T[];
  totalItems: number;
  totalPages: number;

  // Pagination state
  currentPage: number;
  pageSize: number;

  // Actions
  goToPage: (page: number) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  setPageSize: (size: number) => void;

  // Computed
  hasNext: boolean;
  hasPrevious: boolean;
  isEmpty: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;

  // Pagination info
  startItem: number;
  endItem: number;
}

export function usePagination<T>({
  data,
  pageSize: initialPageSize,
  initialPage = 1,
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Memoized pagination calculations
  const paginationInfo = useMemo(() => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentPageData: data.slice(startIndex, endIndex),
      startItem: totalItems > 0 ? startIndex + 1 : 0,
      endItem: endIndex,
    };
  }, [data, currentPage, pageSize]);

  // Actions
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, paginationInfo.totalPages));
      setCurrentPage(validPage);
    },
    [paginationInfo.totalPages]
  );

  const goToNext = useCallback(() => {
    if (paginationInfo.totalPages > currentPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, paginationInfo.totalPages]);

  const goToPrevious = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const goToFirst = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentPage(paginationInfo.totalPages);
  }, [paginationInfo.totalPages]);

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Computed values
  const hasNext = currentPage < paginationInfo.totalPages;
  const hasPrevious = currentPage > 1;
  const isEmpty = paginationInfo.totalItems === 0;
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === paginationInfo.totalPages;

  return {
    // Data
    currentPageData: paginationInfo.currentPageData,
    totalItems: paginationInfo.totalItems,
    totalPages: paginationInfo.totalPages,

    // Pagination state
    currentPage,
    pageSize,

    // Actions
    goToPage,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    setPageSize,

    // Computed
    hasNext,
    hasPrevious,
    isEmpty,
    isFirstPage,
    isLastPage,

    // Pagination info
    startItem: paginationInfo.startItem,
    endItem: paginationInfo.endItem,
  };
}
