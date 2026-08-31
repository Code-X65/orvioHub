import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUserPhoneStore } from '@/stores/useUserPhoneStore';
import { formatPhoneForDisplay } from '@/lib/phoneValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ShieldCheck, X, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface OtpVerificationModalProps {
  isOpen: boolean;
  phone: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  phone,
  onClose,
  onSuccess,
}) => {
  const { verifyOtp, sendOtp, isVerifyingOtp, isSendingOtp } = useUserPhoneStore();
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setCooldown(60);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, phone]);

  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, cooldown]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter the full 6-digit verification code.');
      return;
    }

    try {
      await verifyOtp(phone, otp);
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      // Error handled in store
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSendingOtp) return;
    try {
      await sendOtp(phone);
      setCooldown(60);
      setOtp('');
      inputRef.current?.focus();
    } catch {
      // Error handled in store
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden my-auto text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Heading */}
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3.5 shadow-inner">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-white tracking-tight">Verify Phone Number</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
          We sent a 6-digit verification code to <span className="text-white font-medium">{formatPhoneForDisplay(phone)}</span>.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* OTP Digits Input */}
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="text-center font-mono text-xl tracking-[0.4em] font-bold bg-slate-950 border-slate-800 h-12 text-emerald-400 rounded-xl"
              required
            />
            <p className="text-[10px] text-slate-500">Code expires in 10 minutes</p>
          </div>

          {/* Action Buttons */}
          <Button
            type="submit"
            disabled={otp.length !== 6 || isVerifyingOtp}
            className="w-full h-10 bg-[#714b67] hover:bg-[#85587a] text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            {isVerifyingOtp ? <Spinner size="sm" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{isVerifyingOtp ? 'Verifying Code...' : 'Verify Phone'}</span>
          </Button>

          {/* Resend Countdown */}
          <div className="pt-2 border-t border-slate-800/80">
            {cooldown > 0 ? (
              <p className="text-xs text-slate-500">
                Resend code in <span className="text-slate-300 font-mono font-medium">{cooldown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isSendingOtp}
                className="inline-flex items-center gap-1.5 text-xs text-[#d4a8c9] hover:text-white font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />
                <span>{isSendingOtp ? 'Sending fresh code...' : 'Resend Verification Code'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
