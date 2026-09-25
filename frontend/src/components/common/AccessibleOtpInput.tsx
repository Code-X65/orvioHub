import React, { useRef, useEffect } from 'react';
import { Clipboard, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface AccessibleOtpInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  groupAriaLabel?: string;
  ariaDescribedBy?: string;
  error?: string;
  className?: string;
  showPasteButton?: boolean;
}

export const AccessibleOtpInput: React.FC<AccessibleOtpInputProps> = ({
  digits,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = true,
  groupAriaLabel = '6-digit verification code',
  ariaDescribedBy,
  error,
  className = '',
  showPasteButton = true,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [justPasted, setJustPasted] = React.useState(false);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const applyCodeString = (rawText: string) => {
    const numericChars = rawText.replace(/\D/g, '').slice(0, length);
    if (!numericChars) return;

    const newDigits = Array(length).fill('');
    for (let i = 0; i < numericChars.length; i++) {
      newDigits[i] = numericChars[i];
    }
    onChange(newDigits);

    // Focus last filled or next empty
    const nextIndex = Math.min(numericChars.length, length - 1);
    inputRefs.current[nextIndex]?.focus();

    if (numericChars.length === length && onComplete) {
      onComplete(numericChars);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    if (disabled) return;

    // Handle multichar input (e.g. mobile virtual keyboard autofill/paste)
    const numericOnly = val.replace(/\D/g, '');
    if (numericOnly.length > 1) {
      applyCodeString(numericOnly);
      return;
    }

    const singleDigit = numericOnly.slice(-1);
    const updated = [...digits];
    updated[index] = singleDigit;
    onChange(updated);

    if (singleDigit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = updated.join('');
    if (fullCode.length === length && onComplete) {
      onComplete(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const updated = [...digits];
        updated[index - 1] = '';
        onChange(updated);
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        const updated = [...digits];
        updated[index] = '';
        onChange(updated);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    const pasted = e.clipboardData.getData('text');
    applyCodeString(pasted);
  };

  const handleClipboardPasteClick = async () => {
    if (disabled) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const digitsOnly = text.replace(/\D/g, '');
        if (digitsOnly.length > 0) {
          applyCodeString(digitsOnly);
          setJustPasted(true);
          toast.success('Code pasted from clipboard');
          setTimeout(() => setJustPasted(false), 2000);
        } else {
          toast.error('No numeric verification code found in clipboard');
        }
      } else {
        toast.error('Clipboard access is not supported by your browser');
      }
    } catch {
      toast.error('Please allow clipboard access to paste verification code');
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 6-Digit Container */}
      <div
        role="group"
        aria-label={groupAriaLabel}
        aria-describedby={ariaDescribedBy}
        className="flex justify-center items-center gap-2 sm:gap-3"
      >
        {Array.from({ length }).map((_, idx) => {
          const val = digits[idx] || '';
          return (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={idx === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${idx + 1} of ${length}`}
              aria-invalid={Boolean(error)}
              disabled={disabled}
              value={val}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className={`w-12 h-14 sm:w-12 sm:h-14 min-w-[48px] min-h-[52px] text-center text-xl sm:text-2xl font-bold bg-[#140e12] border rounded-xs text-white transition-all select-none
                ${error ? 'border-rose-500/80 focus:border-rose-400 focus:ring-1 focus:ring-rose-400' : 'border-white/10 focus:border-[#c79dbd] focus:ring-1 focus:ring-[#c79dbd]'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20 cursor-text'}
                focus:outline-none`}
            />
          );
        })}
      </div>

      {/* Mobile/Accessibility 1-Tap Paste Affordance */}
      {showPasteButton && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleClipboardPasteClick}
            disabled={disabled}
            aria-label="Paste 6-digit code from clipboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {justPasted ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Clipboard className="w-3.5 h-3.5 text-[#c79dbd]" aria-hidden="true" />
            )}
            <span>{justPasted ? 'Pasted!' : 'Paste from clipboard'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
