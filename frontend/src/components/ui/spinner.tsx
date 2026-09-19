import React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'default' | 'lg' | 'xl';
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const dotSize = {
      sm: 'w-1.5 h-1.5',
      default: 'w-2 h-2',
      lg: 'w-2.5 h-2.5',
      xl: 'w-3 h-3',
    };

    return (
      <span
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn('inline-flex items-center gap-1 shrink-0', className)}
        {...props}
      >
        <span className={cn('rounded-full bg-current opacity-80 animate-pulse', dotSize[size])} />
        <span className={cn('rounded-full bg-current opacity-60 animate-pulse [animation-delay:200ms]', dotSize[size])} />
        <span className={cn('rounded-full bg-current opacity-40 animate-pulse [animation-delay:400ms]', dotSize[size])} />
      </span>
    );
  }
);

Spinner.displayName = 'Spinner';
