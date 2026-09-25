import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Phone,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  RotateCcw,
  X,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { validateNigerianPhone } from '@/lib/phoneValidation';

export interface PhoneNumberFieldProps {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  phoneVerified?: boolean;
  onPhoneVerified?: (verifiedPhone: string) => void;
  disabled?: boolean;
  className?: string;
}

export const PhoneNumberField: React.FC<PhoneNumberFieldProps> = ({
  value = '',
  onChange,
  error,
  phoneVerified = false,
  onPhoneVerified,
  disabled = false,
  className = '',
}) => {
  // Extract 10-digit national number from value (e.g. +2348012345678 -> 801 234 5678)
  const extractNationalDigits = (val: string): string => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('234') && digits.length >= 3) {
      return digits.slice(3);
    }
    if (digits.startsWith('0') && digits.length >= 1) {
      return digits.slice(1);
    }
    return digits;
  };

  const [localInput, setLocalInput] = useState(() => extractNationalDigits(value));
  
  // Standard verification panel for unverified number
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Change phone number panel for already verified number
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [isChangeOtpSent, setIsChangeOtpSent] = useState(false);
  const [changeOtpCode, setChangeOtpCode] = useState('');
  const [isSendingChangeOtp, setIsSendingChangeOtp] = useState(false);
  const [isVerifyingChangeOtp, setIsVerifyingChangeOtp] = useState(false);
  const [changeResendCountdown, setChangeResendCountdown] = useState(0);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const changeCountdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep local input in sync if external value changes
  useEffect(() => {
    const national = extractNationalDigits(value);
    if (national || !localInput) {
      setLocalInput(national);
    }
  }, [value]);

  // Handle countdown timer for standard OTP resend
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [resendCountdown]);

  // Handle countdown timer for change OTP resend
  useEffect(() => {
    if (changeResendCountdown > 0) {
      changeCountdownTimerRef.current = setTimeout(() => {
        setChangeResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (changeCountdownTimerRef.current) clearTimeout(changeCountdownTimerRef.current);
    };
  }, [changeResendCountdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (phoneVerified) return; // Prevent editing if verified
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    const cleanDigits = raw.startsWith('0') ? raw.slice(1) : raw;
    setLocalInput(cleanDigits);

    if (!cleanDigits) {
      onChange('');
    } else {
      onChange(`+234${cleanDigits}`);
    }

    if (isVerificationOpen) {
      setIsVerificationOpen(false);
      setOtpCode('');
    }
  };

  const fullPhoneNumber = localInput ? `+234${localInput}` : (value || '');
  const validation = validateNigerianPhone(fullPhoneNumber);
  const isPhoneValid = validation.valid;

  // New phone validation for change flow
  const fullNewPhoneNumber = newPhoneInput ? `+234${newPhoneInput}` : '';
  const newPhoneValidation = validateNigerianPhone(fullNewPhoneNumber);
  const isNewPhoneValid = newPhoneValidation.valid;
  
  // Rule 1: Must not be same as current number
  const currentDigits = extractNationalDigits(value);
  const isSameAsCurrent = Boolean(currentDigits && newPhoneInput && currentDigits === newPhoneInput);

  // --- UNVERIFIED NUMBER VERIFICATION FLOW ---
  const handleStartVerification = async () => {
    if (!isPhoneValid) {
      toast.error('Please enter a valid 10-digit Nigerian phone number first.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { phoneNormalized?: string; isDevMock?: boolean };
      }>('/users/me/phone/verification/start', {
        phone: fullPhoneNumber,
        purpose: 'user_phone_verification',
      });

      setIsVerificationOpen(true);
      setOtpCode('');
      setResendCountdown(60);
      toast.success(res.message || `Verification code sent to ${fullPhoneNumber}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { phoneNormalized?: string; resendCount?: number };
      }>('/users/me/phone/verification/resend', {
        purpose: 'user_phone_verification',
      });
      setResendCountdown(60);
      setOtpCode('');
      toast.success(res.message || `New verification code sent to ${fullPhoneNumber}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { phoneNormalized?: string; verifiedAt?: number; user?: any };
      }>('/users/me/phone/verification/verify', {
        code: otpCode.trim(),
        purpose: 'user_phone_verification',
      });

      if (res.success) {
        toast.success('Phone number verified successfully!');
        setIsVerificationOpen(false);
        setOtpCode('');
        const verifiedPhone = res.data?.phoneNormalized || fullPhoneNumber;
        if (onPhoneVerified) {
          onPhoneVerified(verifiedPhone);
        }
      } else {
        toast.error('Invalid verification code. Please check and try again.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // --- CHANGE VERIFIED PHONE NUMBER FLOW ---
  const handleStartChangeVerification = async () => {
    if (!isNewPhoneValid) {
      toast.error('Please enter a valid 10-digit Nigerian phone number.');
      return;
    }
    if (isSameAsCurrent) {
      toast.error('New phone number cannot be the same as your current verified number.');
      return;
    }

    setIsSendingChangeOtp(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { phoneNormalized?: string; isDevMock?: boolean };
      }>('/users/me/phone/verification/start', {
        phone: fullNewPhoneNumber,
        purpose: 'user_phone_change',
      });

      setIsChangeOtpSent(true);
      setChangeOtpCode('');
      setChangeResendCountdown(60);
      toast.success(res.message || `Verification code sent to ${fullNewPhoneNumber}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification code.');
    } finally {
      setIsSendingChangeOtp(false);
    }
  };

  const handleResendChangeOtp = async () => {
    if (changeResendCountdown > 0 || isSendingChangeOtp) return;
    setIsSendingChangeOtp(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { phoneNormalized?: string; resendCount?: number };
      }>('/users/me/phone/verification/resend', {
        purpose: 'user_phone_change',
      });
      setChangeResendCountdown(60);
      setChangeOtpCode('');
      toast.success(res.message || `New verification code sent to ${fullNewPhoneNumber}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification code.');
    } finally {
      setIsSendingChangeOtp(false);
    }
  };

  const handleVerifyChangeOtp = async () => {
    if (changeOtpCode.length !== 6) {
      toast.error('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingChangeOtp(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { phoneNormalized?: string; verifiedAt?: number; user?: any };
      }>('/users/me/phone/verification/verify', {
        code: changeOtpCode.trim(),
        purpose: 'user_phone_change',
      });

      if (res.success) {
        toast.success('Phone number changed successfully! If you use SMS Recovery or 2FA, please re-enable them in Security Settings.');
        const verifiedPhone = res.data?.phoneNormalized || fullNewPhoneNumber;
        setLocalInput(extractNationalDigits(verifiedPhone));
        onChange(verifiedPhone);
        setIsChangeOpen(false);
        setIsChangeOtpSent(false);
        setNewPhoneInput('');
        setChangeOtpCode('');
        if (onPhoneVerified) {
          onPhoneVerified(verifiedPhone);
        }
      } else {
        toast.error('Invalid verification code. Please check and try again.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify code. Please try again.');
    } finally {
      setIsVerifyingChangeOtp(false);
    }
  };

  const handleCancelChange = () => {
    setIsChangeOpen(false);
    setIsChangeOtpSent(false);
    setNewPhoneInput('');
    setChangeOtpCode('');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Verification Status Badge / Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="phone-input" className="text-xs font-medium text-slate-300">
            Phone Number
          </Label>
          {phoneVerified && (
            <Lock className="w-3 h-3 text-slate-500" title="Verified phone number is locked" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {phoneVerified ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-xs border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Verified</span>
              </span>
              {!isChangeOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangeOpen(true);
                    setIsChangeOtpSent(false);
                    setNewPhoneInput('');
                    setChangeOtpCode('');
                  }}
                  disabled={disabled}
                  className="text-[11px] font-semibold text-[#FDB02F] hover:text-[#f8be58] underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Change</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-400/90 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-xs border border-amber-500/20">
                Unverified
              </span>
              {!isVerificationOpen && (
                <button
                  type="button"
                  onClick={handleStartVerification}
                  disabled={disabled || isSendingOtp || !isPhoneValid}
                  className="text-[11px] font-semibold text-[#FDB02F] hover:text-[#f8be58] underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Verify</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Primary Phone Input */}
      <div
        className={`relative flex items-center h-11 bg-[#0e0a0d] border rounded-xs text-xs transition-all ${
          phoneVerified
            ? 'border-white/10 bg-white/[0.02] cursor-not-allowed'
            : 'border-white/10 focus-within:ring-1 focus-within:ring-[#714b67] focus-within:border-[#714b67]'
        } ${error ? 'border-rose-500/80' : ''}`}
      >
        <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-200">+234</span>
        </div>
        <input
          id="phone-input"
          type="tel"
          value={localInput}
          onChange={handleInputChange}
          readOnly={phoneVerified}
          disabled={disabled || phoneVerified}
          placeholder="801 234 5678"
          className={`w-full h-full bg-transparent px-3 text-xs focus:outline-none ${
            phoneVerified
              ? 'text-slate-300 cursor-not-allowed select-all'
              : 'text-white placeholder:text-slate-600'
          }`}
        />
        {phoneVerified && (
          <div className="pr-3 flex items-center text-slate-500 select-none text-[11px] gap-1">
            <Lock className="w-3 h-3 text-slate-500" />
            <span className="hidden sm:inline">Locked</span>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : phoneVerified ? (
        <p className="text-[11px] text-slate-500">
          Verified phone numbers cannot be edited directly. Click <strong className="text-slate-400 font-medium">Change</strong> to verify a new number.
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Used for account security, recovery, and SMS notifications. Nigerian mobile networks supported.
        </p>
      )}

      {/* --- UNVERIFIED PHONE VERIFICATION SLIDE-DOWN PANEL --- */}
      {!phoneVerified && isVerificationOpen && (
        <div className="mt-3 p-3.5 sm:p-4 rounded-xs bg-[#130b11] border border-[#714b67]/40 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xs bg-[#714b67]/20 flex items-center justify-center text-[#FDB02F]">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Verify Phone Number</h4>
                <p className="text-[11px] text-slate-400">
                  Enter the 6-digit code sent to <strong className="text-slate-200 font-mono">{fullPhoneNumber}</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVerificationOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-xs cursor-pointer transition-colors"
              title="Close verification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                autoFocus
                className="w-full h-9 bg-black/60 border border-white/15 focus:border-[#714b67] focus:ring-1 focus:ring-[#714b67] rounded-xs px-3 text-white text-xs font-mono tracking-widest placeholder:text-slate-600 focus:outline-none"
              />
            </div>

            <Button
              type="button"
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp || otpCode.length !== 6}
              className="h-9 px-4 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium rounded-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isVerifyingOtp ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                'Submit Code'
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
            <span className="text-slate-500">Didn't receive code?</span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCountdown > 0 || isSendingOtp}
              className="text-[#d4a8c9] hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3 h-3" />
              <span>
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* --- CHANGE VERIFIED PHONE NUMBER SLIDE-DOWN PANEL --- */}
      {phoneVerified && isChangeOpen && (
        <div className="mt-3 p-3.5 sm:p-4 rounded-xs bg-[#130b11] border border-[#FDB02F]/30 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xs bg-[#FDB02F]/15 flex items-center justify-center text-[#FDB02F]">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Change Phone Number</h4>
                <p className="text-[11px] text-slate-400">
                  Enter your new phone number. You will receive an SMS code to verify.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelChange}
              className="text-slate-400 hover:text-white p-1 rounded-xs cursor-pointer transition-colors"
              title="Cancel change"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Security Notice */}
          <div className="p-2.5 rounded-xs bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] leading-relaxed flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              For security, changing your phone number resets SMS Account Recovery and SMS 2FA. You can re-enable them after verifying your new number.
            </span>
          </div>

          {/* New Phone Number Input */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-slate-300">New Phone Number</Label>
            <div className="relative flex items-center h-10 bg-[#0e0a0d] border border-white/15 focus-within:border-[#FDB02F] focus-within:ring-1 focus-within:ring-[#FDB02F] rounded-xs text-xs transition-all">
              <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-200">+234</span>
              </div>
              <input
                type="tel"
                value={newPhoneInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const clean = raw.startsWith('0') ? raw.slice(1) : raw;
                  setNewPhoneInput(clean);
                  if (isChangeOtpSent) {
                    setIsChangeOtpSent(false);
                    setChangeOtpCode('');
                  }
                }}
                placeholder="802 345 6789"
                disabled={isSendingChangeOtp || isVerifyingChangeOtp}
                className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-600 text-xs focus:outline-none"
              />
            </div>

            {/* Rule 1 Warning: Same as current number */}
            {isSameAsCurrent && (
              <div className="flex items-center gap-1.5 text-rose-400 text-[11px] pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>New phone number cannot be the same as your current verified number.</span>
              </div>
            )}
          </div>

          {/* Step 1: Send OTP to new number */}
          {!isChangeOtpSent ? (
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelChange}
                disabled={isSendingChangeOtp}
                className="h-8 px-3 text-xs text-slate-400 hover:text-white rounded-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleStartChangeVerification}
                disabled={isSendingChangeOtp || !isNewPhoneValid || isSameAsCurrent}
                className="h-8 px-4 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium rounded-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSendingChangeOtp ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Code</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Step 2: Enter 6-digit OTP code */
            <div className="space-y-3 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Enter 6-digit code sent to <strong className="text-slate-200 font-mono">{fullNewPhoneNumber}</strong>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={changeOtpCode}
                  onChange={(e) => setChangeOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  autoFocus
                  className="flex-1 h-9 bg-black/60 border border-white/15 focus:border-[#FDB02F] focus:ring-1 focus:ring-[#FDB02F] rounded-xs px-3 text-white text-xs font-mono tracking-widest placeholder:text-slate-600 focus:outline-none"
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelChange}
                    disabled={isVerifyingChangeOtp}
                    className="h-9 px-3 text-xs text-slate-400 hover:text-white rounded-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleVerifyChangeOtp}
                    disabled={isVerifyingChangeOtp || changeOtpCode.length !== 6}
                    className="h-9 px-4 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium rounded-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isVerifyingChangeOtp ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      'Confirm & Update'
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-slate-500">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResendChangeOtp}
                  disabled={changeResendCountdown > 0 || isSendingChangeOtp}
                  className="text-[#d4a8c9] hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    {changeResendCountdown > 0 ? `Resend in ${changeResendCountdown}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
