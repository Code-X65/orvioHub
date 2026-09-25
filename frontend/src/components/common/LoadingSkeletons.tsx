import React from 'react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Reusable progressive loading skeleton components for cards, tables, dashboards, and forms.
 */

// 1. Card List Skeleton (for branches, products, organizations, applications)
export interface CardListSkeletonProps {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  hasThumbnail?: boolean;
}

export const CardListSkeleton: React.FC<CardListSkeletonProps> = ({
  count = 3,
  columns = 3,
  className,
  hasThumbnail = true,
}) => {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={cn('grid gap-3.5', colClass, className)} role="status" aria-label="Loading content">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-sm bg-zinc-950/60 border border-white/5 flex flex-col justify-between gap-3 animate-in fade-in duration-300"
        >
          <div className="flex items-start gap-3">
            {hasThumbnail && (
              <Skeleton className="w-10 h-10 rounded-sm shrink-0 bg-white/[0.08]" />
            )}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <Skeleton className="h-3 w-1/2 bg-white/[0.06]" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <Skeleton className="h-3.5 w-16 bg-white/[0.05]" />
            <Skeleton className="h-6 w-20 rounded bg-white/[0.08]" />
          </div>
        </div>
      ))}
    </div>
  );
};

// 2. Table Skeleton (for tabular datasets, inventory, users, audit logs)
export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className,
}) => {
  return (
    <div className={cn('w-full border border-white/10 rounded-sm overflow-hidden bg-zinc-950/60', className)} role="status" aria-label="Loading table">
      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] border-b border-white/10">
        {Array.from({ length: columns }).map((_, cIdx) => (
          <Skeleton key={cIdx} className="h-3.5 flex-1 bg-white/10" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 px-4 py-3.5 animate-in fade-in duration-200">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <Skeleton
                key={cIdx}
                className={cn('h-3.5 flex-1 bg-white/[0.06]', cIdx === 0 ? 'w-1/3' : 'w-1/4')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// 3. Dashboard Metrics & Stats Skeleton (for analytics dashboards and stats cards)
export interface DashboardStatsSkeletonProps {
  count?: number;
  className?: string;
}

export const DashboardStatsSkeleton: React.FC<DashboardStatsSkeletonProps> = ({
  count = 4,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)} role="status" aria-label="Loading metrics">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-sm bg-zinc-950/70 border border-white/5 space-y-3 animate-in fade-in duration-300"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24 bg-white/10" />
            <Skeleton className="w-7 h-7 rounded-sm bg-white/[0.08]" />
          </div>
          <Skeleton className="h-7 w-28 bg-white/15" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-3 w-12 bg-white/[0.06]" />
            <Skeleton className="h-3 w-20 bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
};

// 4. Header & Detail View Skeleton (for page tops, metadata, breadcrumbs)
export interface HeaderDetailSkeletonProps {
  className?: string;
}

export const HeaderDetailSkeleton: React.FC<HeaderDetailSkeletonProps> = ({ className }) => {
  return (
    <div className={cn('space-y-3 pb-4 border-b border-white/10', className)} role="status" aria-label="Loading header">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-16 bg-white/5" />
        <Skeleton className="h-3 w-4 bg-white/5" />
        <Skeleton className="h-3 w-24 bg-white/10" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-6 w-56 bg-white/15" />
          <Skeleton className="h-3.5 w-80 max-w-full bg-white/5" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-sm bg-white/10" />
          <Skeleton className="h-8 w-28 rounded-sm bg-white/15" />
        </div>
      </div>
    </div>
  );
};

// 5. Form & Settings Skeleton (for form inputs, profile and settings pages)
export interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({ fields = 4, className }) => {
  return (
    <div className={cn('space-y-5 max-w-xl', className)} role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <Skeleton className="h-3.5 w-24 bg-white/10" />
          <Skeleton className="h-9 w-full rounded-sm bg-white/[0.06]" />
        </div>
      ))}
      <div className="pt-2 flex items-center justify-end gap-3">
        <Skeleton className="h-8 w-20 rounded-sm bg-white/5" />
        <Skeleton className="h-8 w-28 rounded-sm bg-white/15" />
      </div>
    </div>
  );
};
