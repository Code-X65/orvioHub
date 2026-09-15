import React, { useState } from 'react';
import { validateNigerianPhone } from '@/lib/phoneValidation';
import { useUserPhoneStore } from '@/stores/useUserPhoneStore';
import { OtpVerificationModal } from './OtpVerificationModal';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

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
  placeholder = '0801 234 5678',
  disabled = false,
  required = false,
  isVerified = false,
  showVerificationButton = true,
  onVerified,
  className = '',
  error,
}) => {
  const { sendOtp, isSendingOtp } = useUserPhoneStore();
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [phoneToVerify, setPhoneToVerify] = useState('');

  // Validate Nigerian number
  const validation = value ? validateNigerianPhone(value) : { valid: false };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChange(raw, false);
  };

  const handleSendOtp = async () => {
    if (!validation.valid) return;
    try {
      const fullNumber = (validation as any).normalized || value;
      setPhoneToVerify(fullNumber);
      await sendOtp(fullNumber);
      setIsOtpModalOpen(true);
    } catch {
      // Handled in store
    }
  };

  const handleVerificationSuccess = () => {
    if ((validation as any).normalized) {
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
          {/* Fixed Nigeria Country Code Prefix */}
          <div className="h-full px-3 py-2 flex items-center gap-1.5 bg-slate-900/80 border-r border-slate-800 rounded-l-xl text-xs text-slate-200 select-none shrink-0">
            <span className="text-base leading-none">🇳🇬</span>
            <span className="font-mono text-xs font-semibold text-slate-300">
              +234
            </span>
          </div>

          {/* Number Input Field */}
          <input
            type="tel"
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder={placeholder}
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
      ) : value && !validation.valid ? (
        <p className="text-[10px] text-amber-400/90 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{(validation as any).error || 'Enter a valid Nigerian phone number (e.g. 0801 234 5678)'}</span>
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
