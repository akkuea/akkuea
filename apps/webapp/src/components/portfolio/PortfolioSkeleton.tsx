"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-6"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton variant="rectangular" className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertiesListSkeleton() {
  return (
    <div className="divide-y divide-[#1a1a1a]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-4">
          <Skeleton
            variant="rectangular"
            className="w-14 h-14 rounded-lg shrink-0"
          />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-3 w-14 ml-auto" />
            <Skeleton className="h-5 w-16 ml-auto rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
