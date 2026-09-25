import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

export interface DebouncedSearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch: (query: string) => void;
  debounceMs?: number;
  isLoading?: boolean;
  className?: string;
  initialValue?: string;
}

export const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = ({
  onSearch,
  debounceMs = 300,
  isLoading = false,
  className,
  initialValue = '',
  placeholder = 'Search...',
  ...props
}) => {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, debounceMs);

  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <div className={cn('relative flex items-center w-full max-w-md', className)}>
      <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 bg-zinc-950/70 border-white/10 text-xs text-white placeholder:text-slate-500 rounded-lg focus:border-[#714b67] focus:ring-1 focus:ring-[#714b67]"
        {...props}
      />
      {isLoading ? (
        <Loader2 className="absolute right-3 w-3.5 h-3.5 text-slate-400 animate-spin" />
      ) : value ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
};
