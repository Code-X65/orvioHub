import React from 'react';
import { AlertCircle, Inbox, RotateCcw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/common/LoadingSkeletons';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errorMapper';

// 1. Standalone Empty State Component
export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description = 'There are no items to display right now.',
  icon,
  actionLabel,
  onAction,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'p-8 text-center rounded-xl bg-zinc-950/40 border border-dashed border-white/10 flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto animate-in fade-in duration-200',
        className
      )}
      role="status"
    >
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button
          type="button"
          onClick={onAction}
          size="sm"
          className="h-8 px-3 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </Button>
      )}
      {children}
    </div>
  );
};

// 2. Standalone Error State Component with Retry
export interface ErrorStateProps {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load content',
  error,
  onRetry,
  className,
}) => {
  const displayMessage = getErrorMessage(error, 'An unexpected error occurred while loading.');

  return (
    <div
      className={cn(
        'p-6 text-center rounded-xl bg-rose-950/20 border border-rose-500/20 flex flex-col items-center justify-center space-y-3 max-w-lg mx-auto animate-in fade-in duration-200',
        className
      )}
      role="alert"
    >
      <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-rose-300/80 max-w-sm mx-auto">{displayMessage}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="h-8 px-3 rounded-lg border-white/10 hover:bg-white/5 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </Button>
      )}
    </div>
  );
};

// 3. Complete List State Wrapper (Handles Loading -> Error -> Empty -> Content)
export interface ListStateWrapperProps {
  isLoading: boolean;
  error?: unknown;
  isEmpty: boolean;
  skeleton?: React.ReactNode;
  onRetry?: () => void;
  errorTitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const ListStateWrapper: React.FC<ListStateWrapperProps> = ({
  isLoading,
  error,
  isEmpty,
  skeleton = <CardListSkeleton count={3} columns={3} />,
  onRetry,
  errorTitle,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  className,
  children,
}) => {
  if (isLoading) {
    return <div className={className}>{skeleton}</div>;
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorState title={errorTitle} error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={className}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  return <>{children}</>;
};
