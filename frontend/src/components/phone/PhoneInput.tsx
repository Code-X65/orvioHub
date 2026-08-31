import React, { useState, useEffect, useRef } from 'react';
import { validateNigerianPhone } from '@/lib/phoneValidation';
import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY, type CountryDialCode } from '@/lib/countryCodes';
import { useUserPhoneStore } from '@/stores/useUserPhoneStore';
import { OtpVerificationModal } from './OtpVerificationModal';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle2, ShieldCheck, AlertCircle, ChevronDown, Search } from 'lucide-react';

interface PhoneInputProps {
  value?: string;
  onChange: (phone: string, isVerified?: boolean) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  isVerified?: boolean;
  showVerificationButton?: boolean;
  onVerified?: () => void;
  className?: string;
  error?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value = '',
  onChange,
  label = 'Phone Number',
  placeholder,
  disabled = false,
  required = false,
  isVerified = false,
  showVerificationButton = true,
  onVerified,
  className = '',
  error,
}) => {
  const { sendOtp, isSendingOtp } = useUserPhoneStore();
  const [selectedCountry, setSelectedCountry] = useState<CountryDialCode>(DEFAULT_COUNTRY);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [phoneToVerify, setPhoneToVerify] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check country from incoming value if present (e.g. +234, +233, etc.)
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const match = COUNTRY_DIAL_CODES.find((c) => value.startsWith(c.dialCode));
      if (match && match.code !== selectedCountry.code) {
        setSelectedCountry(match);
      }
    }
  }, [value]);

  const filteredCountries = COUNTRY_DIAL_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dialCode.includes(countrySearch) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Validate Nigerian number if Nigeria is selected
  const validation =
    selectedCountry.code === 'NG'
      ? value
        ? validateNigerianPhone(value)
        : { valid: false }
      : { valid: Boolean(value && value.replace(/\D/g, '').length >= 7) };

  const handleCountrySelect = (country: CountryDialCode) => {
    setSelectedCountry(country);
    setIsCountryDropdownOpen(false);
    setCountrySearch('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChange(raw, false);
  };

  const handleSendOtp = async () => {
    if (!validation.valid) return;
    try {
      const fullNumber =
        selectedCountry.code === 'NG'
          ? (validation as any).normalized || value
          : `${selectedCountry.dialCode}${value.replace(/\D/g, '')}`;

      setPhoneToVerify(fullNumber);
      await sendOtp(fullNumber);
      setIsOtpModalOpen(true);
    } catch {
      // Error handled in store
    }
  };

  const handleVerificationSuccess = () => {
    if (selectedCountry.code === 'NG' && (validation as any).normalized) {
      onChange((validation as any).formatted || (validation as any).normalized, true);
    } else {
      onChange(value, true);
    }
    if (onVerified) onVerified();
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-300 font-medium flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-rose-400">*</span>}
          </Label>
          {isVerified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-stretch rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 focus-within:border-[#714b67] focus-within:ring-1 focus-within:ring-[#714b67] transition-all shadow-inner">
          {/* Country Code Dropdown Trigger */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
              className="h-full px-3 flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-900 border-r border-slate-800/80 rounded-l-xl text-xs text-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-base leading-none">{selectedCountry.flag}</span>
              <span className="font-mono text-xs font-semibold text-slate-300">
                {selectedCountry.dialCode}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Country Selector Modal Dropdown */}
            {isCountryDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2 border-b border-slate-800/80 bg-slate-950/80">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search country or code..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      autoFocus
                      className="w-full h-8 pl-8 pr-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#714b67]"
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-800/40">
                  {filteredCountries.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">No country found</div>
                  ) : (
                    filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                          selectedCountry.code === c.code
                            ? 'bg-[#714b67]/20 text-[#d4a8c9] font-medium'
                            : 'hover:bg-slate-800/70 text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">{c.flag}</span>
                          <span className="truncate max-w-[130px]">{c.name}</span>
                        </span>
                        <span className="font-mono text-slate-400 font-semibold">{c.dialCode}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Number Input Field */}
          <input
            type="tel"
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder={placeholder || selectedCountry.samplePlaceholder || '0801 234 5678'}
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-50 font-mono tracking-wide"
          />
        </div>

        {/* Verify Action Button */}
        {showVerificationButton && !isVerified && (
          <Button
            type="button"
            size="sm"
            onClick={handleSendOtp}
            disabled={!validation.valid || isSendingOtp || disabled}
            className="h-9 px-3.5 text-xs bg-[#714b67] hover:bg-[#85587a] text-white font-medium rounded-xl shrink-0 cursor-pointer disabled:opacity-50 transition-all shadow-md"
          >
            {isSendingOtp ? <Spinner size="sm" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
            <span>Verify</span>
          </Button>
        )}
      </div>

      {/* Validation Feedback & Error Messages */}
      {error ? (
        <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      ) : value && selectedCountry.code === 'NG' && !validation.valid ? (
        <p className="text-[10px] text-amber-400/90 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{(validation as any).error || 'Enter a valid Nigerian phone number'}</span>
        </p>
      ) : null}

      {/* Verification Modal */}
      {isOtpModalOpen && phoneToVerify && (
        <OtpVerificationModal
          isOpen={isOtpModalOpen}
          phone={phoneToVerify}
          onClose={() => setIsOtpModalOpen(false)}
          onSuccess={handleVerificationSuccess}
        />
      )}
    </div>
  );
};
