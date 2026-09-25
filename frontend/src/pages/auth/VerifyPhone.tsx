import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AccessibleOtpInput } from '@/components/common/AccessibleOtpInput';
import {
  Phone,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Edit3,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { validatePhoneNumber } from '@/lib/phoneValidation';
import { COUNTRY_DIAL_CODES, findCountryByPhone, type CountryCode } from '@/lib/countryCodes';

export const VerifyPhone: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);

  // Pre-fill phone if user already has one
  const existingPhone = user?.phone || searchParams.get('phone') || '';
  const detectedCountry = existingPhone ? findCountryByPhone(existingPhone) : null;
  const initialCountryCode = detectedCountry?.dialCode || '+234';
  const initialLocalPhone = existingPhone.replace(initialCountryCode, '').trim();

  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [phoneDigits, setPhoneDigits] = useState(initialLocalPhone);
  const [step, setStep] = useState<'ENTER_PHONE' | 'ENTER_OTP' | 'SUCCESS'>('ENTER_PHONE');
  const [normalizedPhone, setNormalizedPhone] = useState(existingPhone);

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showDigits, setShowDigits] = useState(true);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Country search state
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const countryPickerRef = useRef<HTMLDivElement>(null);

  // 6-digit OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Filter countries by search term
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRY_DIAL_CODES;
    const q = countrySearch.toLowerCase().trim();
    return COUNTRY_DIAL_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const selectedCountry = useMemo(
    () => COUNTRY_DIAL_CODES.find((c) => c.dialCode === countryCode) || COUNTRY_DIAL_CODES[0],
    [countryCode]
  );

  // Close country dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(e.target as Node)) {
        setIsCountryPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'ENTER_OTP' && digitInputRefs.current[0]) {
      digitInputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleSendOtp = async (overridePhone?: string) => {
    const rawNumber = overridePhone || `${countryCode}${phoneDigits}`.trim();
    if (!phoneDigits.trim() && !overridePhone) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    const validation = validatePhoneNumber(rawNumber, countryCode);
    if (!validation.valid) {
      toast.error(validation.error || 'Please enter a valid phone number.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res: any = await api.post('/users/me/phone/verification/start', {
        phone: validation.normalized || rawNumber,
      });

      const phoneToDisplay = res.data?.phoneNormalized || validation.formatted || rawNumber;
      setNormalizedPhone(phoneToDisplay);
      setStep('ENTER_OTP');
      setCooldown(60);
      setAttemptsRemaining(null);
      setIsLocked(false);
      setOtpDigits(['', '', '', '', '', '']);
      toast.success(`Verification code sent to ${phoneToDisplay}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification SMS. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (isSendingOtp || cooldown > 0) return;
    setIsSendingOtp(true);
    try {
      await api.post('/users/me/phone/verification/resend', {
        purpose: 'user_phone_verification',
      });
      setCooldown(60);
      setAttemptsRemaining(null);
      setIsLocked(false);
      setOtpDigits(['', '', '', '', '', '']);
      toast.success(`New verification code sent to ${normalizedPhone}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification SMS. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }
    const char = clean.slice(-1);
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);

    if (index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    digitInputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = async (overrideOtp?: string) => {
    const otp = overrideOtp || otpDigits.join('');
    if (otp.length !== 6) {
      toast.error('Please enter the full 6-digit SMS code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await api.post('/users/me/phone/verification/verify', {
        code: otp,
      });

      // Clear skipped state if user verifies
      try {
        localStorage.removeItem('phone_verification_skipped');
      } catch {
        // ignore
      }

      setStep('SUCCESS');
      toast.success('Phone number verified successfully!');
      setTimeout(() => {
        proceedToNext();
      }, 1500);
    } catch (err: any) {
      const errCode = err?.code || err?.response?.data?.code || err?.data?.code;
      if (errCode === 'CODE_LOCKED' || err?.status === 429 || (err?.message && err.message.toLowerCase().includes('locked'))) {
        setIsLocked(true);
        setAttemptsRemaining(0);
        toast.error('This code has been locked due to too many failed attempts. Please request a new code.');
        return;
      }

      const remaining = err.attemptsRemaining ?? err.details?.attemptsRemaining ?? err.data?.error?.attemptsRemaining ?? err.response?.data?.error?.attemptsRemaining;
      if (typeof remaining === 'number') {
        setAttemptsRemaining(remaining);
        toast.error(`Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      } else {
        toast.error(err.message || 'Invalid or expired verification code. Please try again.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('phone_verification_skipped', String(Date.now()));
    } catch {
      // ignore
    }
    proceedToNext();
  };

  const proceedToNext = () => {
    const returnTo = searchParams.get('return_to') || searchParams.get('returnTo');
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    // Default to onboarding options
    navigate('/onboarding');
  };

  if (step === 'SUCCESS') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-6 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center mb-1">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Phone Verified!</h2>
          <p className="text-xs text-slate-300">
            Your phone number <strong className="text-white">{normalizedPhone}</strong> is now verified.
          </p>
          <Button
            onClick={proceedToNext}
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer"
          >
            <span>Continue to Options</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center text-center space-y-5 py-2 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#c79dbd] mb-0.5">
          <Phone className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {step === 'ENTER_PHONE' ? 'Verify your phone number' : 'Enter SMS verification code'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {step === 'ENTER_PHONE'
              ? 'Add an extra layer of security and receive instant SMS alerts for critical business activity.'
              : `We sent a 6-digit SMS verification code to ${normalizedPhone}`}
          </p>
        </div>

        {step === 'ENTER_PHONE' ? (
          <div className="w-full space-y-4 pt-2 text-left">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">Mobile Phone Number</Label>
              <div className="flex gap-2 relative">
                {/* Searchable Country Selector */}
                <div className="relative" ref={countryPickerRef}>
                  <button
                    type="button"
                    onClick={() => setIsCountryPickerOpen((prev) => !prev)}
                    className="h-11 px-3 rounded-xs bg-[#140e12] border border-white/10 text-white text-xs font-medium flex items-center gap-1.5 hover:border-white/20 focus:outline-hidden focus:border-[#c79dbd] cursor-pointer"
                  >
                    <span>{selectedCountry.flag}</span>
                    <span>{selectedCountry.dialCode}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </button>

                  {isCountryPickerOpen && (
                    <div className="absolute top-12 left-0 z-50 w-72 max-h-64 overflow-y-auto rounded-sm bg-[#160f15] border border-white/15 shadow-2xl p-2 space-y-1.5 animate-in fade-in duration-100">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code..."
                          className="w-full pl-8 pr-2.5 py-2 text-xs bg-[#0f0a0e] border border-white/10 rounded-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#c79dbd]"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                        {filteredCountries.map((c) => (
                          <button
                            key={`${c.code}-${c.dialCode}`}
                            type="button"
                            onClick={() => {
                              setCountryCode(c.dialCode);
                              setIsCountryPickerOpen(false);
                              setCountrySearch('');
                            }}
                            className={`w-full px-2.5 py-2.5 min-h-[40px] text-xs flex items-center justify-between text-left hover:bg-white/10 rounded-xs cursor-pointer transition-colors ${
                              countryCode === c.dialCode ? 'text-[#c79dbd] font-semibold bg-white/5' : 'text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span>{c.flag}</span>
                              <span className="truncate">{c.name}</span>
                            </span>
                            <span className="text-slate-400 shrink-0 ml-2 font-mono">{c.dialCode}</span>
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <div className="py-4 text-center text-xs text-slate-400">No countries found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  type="tel"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value)}
                  placeholder={selectedCountry.placeholder || '801 234 5678'}
                  className="h-11 bg-[#140e12] border-white/10 text-white rounded-xs text-xs font-medium flex-1 focus:border-[#c79dbd]"
                />
              </div>
              <p className="text-[11px] text-slate-400">Standard SMS rates may apply from your mobile carrier.</p>
            </div>

            <Button
              onClick={() => handleSendOtp()}
              disabled={isSendingOtp || !phoneDigits.trim()}
              aria-busy={isSendingOtp}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSendingOtp ? <Spinner size="sm" className="mr-2" /> : <ShieldCheck className="w-4 h-4 mr-1.5" aria-hidden="true" />}
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-4 pt-1">
            {isLocked ? (
              <div className="w-full p-4 rounded-sm bg-rose-950/40 border border-rose-500/30 text-left space-y-3">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                  <Lock className="w-4 h-4 text-rose-400" aria-hidden="true" />
                  <span>Verification Code Locked</span>
                </div>
                <p className="text-xs text-rose-200/80">
                  This code has been locked due to too many failed attempts. Please request a new code.
                </p>
                <Button
                  className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer"
                  onClick={handleResendOtp}
                  disabled={isSendingOtp}
                  aria-busy={isSendingOtp}
                >
                  {isSendingOtp ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" aria-hidden="true" />}
                  Send New SMS Code
                </Button>
              </div>
            ) : (
              <>
                {/* 6-digit OTP Inputs via AccessibleOtpInput */}
                <AccessibleOtpInput
                  digits={otpDigits}
                  onChange={setOtpDigits}
                  onComplete={(code) => handleVerifyOtp(code)}
                  disabled={isVerifyingOtp}
                  groupAriaLabel="6-digit SMS verification code"
                  ariaDescribedBy={attemptsRemaining !== null ? 'phone-otp-attempts' : undefined}
                />

                {attemptsRemaining !== null && (
                  <p id="phone-otp-attempts" role="alert" className="text-xs text-amber-400 font-medium">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before code is locked.
                  </p>
                )}

                <Button
                  onClick={() => handleVerifyOtp()}
                  disabled={isVerifyingOtp || otpDigits.join('').length !== 6}
                  aria-busy={isVerifyingOtp}
                  className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Spinner size="sm" className="mr-2" /> : <ShieldCheck className="w-4 h-4 mr-1.5" aria-hidden="true" />}
                  Verify Code
                </Button>

                <div className="flex items-center justify-between text-xs text-slate-300 px-1 pt-1">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSendingOtp || cooldown > 0}
                    className="hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{cooldown > 0 ? `Resend SMS in ${cooldown}s` : 'Resend SMS code'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('ENTER_PHONE');
                      setIsLocked(false);
                      setAttemptsRemaining(null);
                    }}
                    className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[#c79dbd]"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Change number</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Didn't receive SMS? Help section */}
        <div className="w-full pt-1">
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            aria-expanded={showHelp}
            className="w-full py-2.5 px-3 rounded-xs bg-[#140e12]/60 hover:bg-[#140e12] border border-white/5 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#c79dbd]" aria-hidden="true" />
              Didn't receive the SMS code?
            </span>
            {showHelp ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>

          {showHelp && (
            <div className="mt-2 p-3 rounded-xs bg-[#100b0f] border border-white/5 text-left text-xs text-slate-300 space-y-1.5 animate-in fade-in duration-150">
              <p>• <strong>Ensure your phone has network signal</strong> to receive SMS messages.</p>
              <p>• <strong>Check your DND (Do-Not-Disturb) status</strong> with your mobile network provider.</p>
              <p>• <strong>Wait up to 1-2 minutes</strong> for international or regional gateway routing.</p>
              <p>• You can also skip this step and complete verification later from Account Settings.</p>
            </div>
          )}
        </div>

        {/* Skip for now option */}
        <div className="w-full pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
          <Link to="/login" className="hover:text-white transition-colors py-1 focus:outline-hidden focus:underline">
            &larr; Sign in with different account
          </Link>

          <button
            type="button"
            onClick={handleSkip}
            className="text-[#c79dbd] hover:text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer py-1.5 px-2 min-h-[36px] rounded-xs"
          >
            <span>Skip for now</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
