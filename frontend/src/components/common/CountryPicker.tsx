import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Globe } from 'lucide-react';
import { COUNTRY_DIAL_CODES, type CountryDialCode } from '@/lib/countryCodes';

export interface CountryPickerProps {
  value?: string;
  onChange: (countryName: string, country: CountryDialCode) => void;
  disabled?: boolean;
  id?: string;
  ariaDescribedBy?: string;
  error?: string;
  className?: string;
}

export const CountryPicker: React.FC<CountryPickerProps> = ({
  value = 'Nigeria',
  onChange,
  disabled = false,
  id = 'country-picker',
  ariaDescribedBy,
  error,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry =
    COUNTRY_DIAL_CODES.find((c) => c.name.toLowerCase() === value.toLowerCase()) ||
    COUNTRY_DIAL_CODES[0];

  const filteredCountries = COUNTRY_DIAL_CODES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q)
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (country: CountryDialCode) => {
    onChange(country.name, country);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button (Min 44px for touch accessibility) */}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select Country"
        aria-describedby={ariaDescribedBy}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full min-h-[44px] h-11 px-3 bg-[#0e0a0d] border rounded-xs text-xs flex items-center justify-between gap-2.5 transition-all cursor-pointer
          ${error ? 'border-rose-500/80 focus:border-rose-400' : 'border-white/10 hover:border-white/20 focus:border-[#714b67]'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-200'}
          focus:outline-none focus:ring-1 focus:ring-[#714b67]`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span className="text-base shrink-0" aria-hidden="true">
            {selectedCountry.flag}
          </span>
          <span className="font-medium text-slate-100 truncate">{selectedCountry.name}</span>
          <span className="text-slate-400 text-[11px] shrink-0 font-mono">
            ({selectedCountry.dialCode})
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Countries"
          className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-[#140e13] border border-white/10 rounded-sm shadow-2xl max-h-64 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-white/5 bg-[#181116] sticky top-0">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search countries"
                className="w-full pl-8 pr-3 py-1.5 bg-[#0e0a0d] border border-white/10 rounded-xs text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#714b67]"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-52 divide-y divide-white/5">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">No countries found</div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.name.toLowerCase() === selectedCountry.name.toLowerCase();
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(c)}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer
                      ${isSelected ? 'bg-[#714b67]/20 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base shrink-0" aria-hidden="true">
                        {c.flag}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 text-[11px] font-mono">{c.dialCode}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#c79dbd]" aria-hidden="true" />
                      )}
                    </div>
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
