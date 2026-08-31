import React from 'react';
import { Loader2, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends Omit<LucideProps, 'ref'> {
  size?: 'sm' | 'default' | 'lg' | 'xl';
}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      default: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12',
    };

    return (
      <Loader2
        ref={ref}
        className={cn('animate-spin text-primary', sizeClasses[size], className)}
        {...props}
      />
    );
  }
);

Spinner.displayName = 'Spinner';
