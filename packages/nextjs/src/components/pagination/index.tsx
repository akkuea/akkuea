'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  maxVisiblePages = 5,
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);

    if (currentPage <= halfVisible) {
      endPage = Math.min(totalPages, maxVisiblePages);
    }
    if (currentPage > totalPages - halfVisible) {
      startPage = Math.max(1, totalPages - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('ellipsis');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <nav className={cn('flex items-center justify-center space-x-1', className)}>
      {/* {showFirstLast && currentPage > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          aria-label="Go to first page"
        >
          First
        </Button>
      )} */}

      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Previous</span>
      </Button>

      {visiblePages.map((page, index) => (
        <React.Fragment key={page === 'ellipsis' ? `ellipsis-${index}` : page}>
          {page === 'ellipsis' ? (
            <span className="flex h-9 w-9 items-center justify-center">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More pages</span>
            </span>
          ) : (
            <Button
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePageChange(page)}
              aria-label={`Go to page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              className="h-9 w-9 p-0"
            >
              {page}
            </Button>
          )}
        </React.Fragment>
      ))}

      {/* Next */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
      >
        <span className="sr-only sm:not-sr-only">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Last page */}
      {/* {showFirstLast && currentPage < totalPages && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          aria-label="Go to last page"
        >
          Last
        </Button>
      )} */}
    </nav>
  );
}

export function PaginationInfo({
  currentPage,
  totalItems,
  pageSize,
  className,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  className?: string;
}) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className={cn('text-sm text-muted-foreground', className)}>
      Showing {startItem} to {endItem} of {totalItems} results
      {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
    </div>
  );
}
