import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomSelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  error?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  id?: string;
  name?: string;
  clearable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  searchable,
  searchPlaceholder = 'Search...',
  icon,
  disabled = false,
  error,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  id,
  name,
  clearable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Automatically make searchable if options list is long (> 6 items) unless explicitly set to false
  const isSearchable = searchable !== undefined ? searchable : options.length > 6;

  // Selected Option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filtered Options
  const filteredOptions = isSearchable && searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (opt.badge && opt.badge.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (opt.description && opt.description.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for form standard submission compatibility */}
      {name && <input type="hidden" name={name} id={id} value={value || ''} />}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full h-10 px-3.5 rounded-xl bg-[#160f14] border text-xs text-left flex items-center justify-between gap-2 transition-all cursor-pointer shadow-inner disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500'
            : isOpen
            ? 'border-[#714b67] ring-1 ring-[#714b67] shadow-lg shadow-[#714b67]/10'
            : 'border-white/10 hover:border-white/20'
        } ${triggerClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedOption.icon && (
                <span className="shrink-0">{selectedOption.icon}</span>
              )}
              <span className="text-white truncate font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                    selectedOption.badgeColor ||
                    'bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/30'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {clearable && selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-white rounded hover:bg-white/10 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#d4a8c9]' : 'text-slate-400'
            }`}
          />
        </div>
      </button>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-[11px] text-red-400 animate-in fade-in duration-150">
          {error}
        </p>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c080b]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 max-h-64 flex flex-col ${dropdownClassName}`}
        >
          {/* Search Box */}
          {isSearchable && (
            <div className="p-1.5 pb-2 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-7 rounded-lg bg-[#160f14] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#714b67] focus:ring-1 focus:ring-[#714b67] transition-all"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 py-1 space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-all text-left ${
                      option.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : isSelected
                        ? 'bg-[#714b67]/25 text-white font-medium border border-[#714b67]/30 shadow-sm'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {option.icon && (
                        <span className="shrink-0 text-slate-400">
                          {option.icon}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{option.label}</span>
                          {option.badge && (
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                                option.badgeColor ||
                                'bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/30'
                              }`}
                            >
                              {option.badge}
                            </span>
                          )}
                        </div>
                        {option.description && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#d4a8c9] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
