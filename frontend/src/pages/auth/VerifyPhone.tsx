import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
} from 'lucide-react';
import { toast } from 'sonner';

const COUNTRY_CODES = [
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
];

export const VerifyPhone: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);

  // Pre-fill phone if user already has one
  const existingPhone = user?.phone || searchParams.get('phone') || '';
  const initialCountryCode = existingPhone.startsWith('+')
    ? COUNTRY_CODES.find((c) => existingPhone.startsWith(c.code))?.code || '+234'
    : '+234';
  const initialLocalPhone = existingPhone.replace(initialCountryCode, '').trim();

  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [phoneDigits, setPhoneDigits] = useState(initialLocalPhone);
  const [step, setStep] = useState<'ENTER_PHONE' | 'ENTER_OTP' | 'SUCCESS'>('ENTER_PHONE');
  const [normalizedPhone, setNormalizedPhone] = useState(existingPhone);

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // 6-digit OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

    setIsSendingOtp(true);
    try {
      const res: any = await api.post('/users/me/phones/send-otp', {
        phone: rawNumber,
      });

      setNormalizedPhone(res.data?.normalizedPhone || rawNumber);
      setStep('ENTER_OTP');
      setCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      toast.success(`Verification code sent to ${res.data?.normalizedPhone || rawNumber}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification SMS. Please try again.');
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

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      toast.error('Please enter the full 6-digit SMS code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await api.post('/users/me/phones/verify-otp', {
        phone: normalizedPhone,
        otp,
      });

      setStep('SUCCESS');
      toast.success('Phone number verified successfully!');
      setTimeout(() => {
        proceedToNext();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const proceedToNext = () => {
    const returnTo = searchParams.get('return_to') || searchParams.get('returnTo');
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    // Default to welcome onboarding options
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
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="h-10 px-2 rounded-xs bg-[#140e12] border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-[#c79dbd]"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#140e12] text-white">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <Input
                  type="tel"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value)}
                  placeholder="801 234 5678"
                  className="h-10 bg-[#140e12] border-white/10 text-white rounded-xs text-xs font-medium flex-1"
                />
              </div>
              <p className="text-[11px] text-slate-400">Standard SMS rates may apply from your mobile carrier.</p>
            </div>

            <Button
              onClick={() => handleSendOtp()}
              disabled={isSendingOtp || !phoneDigits.trim()}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSendingOtp ? <Spinner size="sm" className="mr-2" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-4 pt-1">
            {/* 6-digit OTP Inputs */}
            <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-11 h-12 text-center text-xl font-bold bg-[#140e12] border border-white/10 rounded-xs text-white focus:outline-none focus:border-[#c79dbd] focus:ring-1 focus:ring-[#c79dbd] transition-all"
                />
              ))}
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp || otpDigits.join('').length !== 6}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {isVerifyingOtp ? <Spinner size="sm" className="mr-2" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
              Verify Code
            </Button>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
              <button
                type="button"
                onClick={() => handleSendOtp(normalizedPhone)}
                disabled={isSendingOtp || cooldown > 0}
                className="hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Resend SMS in ${cooldown}s` : 'Resend SMS code'}</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('ENTER_PHONE')}
                className="hover:text-white flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Change number</span>
              </button>
            </div>
          </div>
        )}

        {/* Didn't receive SMS? Help section */}
        <div className="w-full pt-1">
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="w-full py-2 px-3 rounded-xs bg-[#140e12]/60 hover:bg-[#140e12] border border-white/5 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#c79dbd]" />
              Didn't receive the SMS code?
            </span>
            {showHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHelp && (
            <div className="mt-2 p-3 rounded-xs bg-[#100b0f] border border-white/5 text-left text-xs text-slate-400 space-y-1.5 animate-in fade-in duration-150">
              <p>• <strong>Ensure your phone has network signal</strong> to receive SMS messages.</p>
              <p>• <strong>Check your DND (Do-Not-Disturb) status</strong> with your Nigerian network provider.</p>
              <p>• <strong>Wait up to 1-2 minutes</strong> for international or local gateway routing.</p>
              <p>• You can also skip this step and complete verification later from Account Settings.</p>
            </div>
          )}
        </div>

        {/* Skip for now option */}
        <div className="w-full pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <Link to="/login" className="hover:text-white transition-colors">
            &larr; Sign in with different account
          </Link>

          <button
            type="button"
            onClick={proceedToNext}
            className="text-[#c79dbd] hover:text-white font-semibold transition-colors flex items-center gap-1"
          >
            <span>Skip for now</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
