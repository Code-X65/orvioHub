import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCw,
  ArrowRight,
  Lock,
  Smartphone,
  Check,
} from 'lucide-react';

interface PhoneContactData {
  phone: string | null;
  phoneNormalized: string | null;
  phoneStatus: 'verified' | 'unverified' | 'not_set' | 'pending';
  phoneVerifiedAt: number | null;
  phoneUsedForRecovery: boolean;
  phoneUsedForMfa: boolean;
  hasPendingChallenge?: boolean;
}

export const PhoneVerificationCard: React.FC = () => {
  const [contact, setContact] = useState<PhoneContactData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verification flow state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);

  // Fetch current phone contact details
  const fetchContact = async () => {
    try {
      const res = await api.get<{ data: PhoneContactData }>('/users/me/contact');
      if (res.data) {
        setContact(res.data);
        if (res.data.phone) {
          setPhoneInput(res.data.phone);
        }
      }
    } catch {
      // Fallback if not loaded
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContact();
  }, []);

  // Cooldown timer interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Start verification challenge
  const handleStartVerification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneInput.trim()) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; message: string; cooldownSeconds?: number }>(
        '/users/me/phone/verification/start',
        {
          phone: phoneInput.trim(),
          purpose: 'user_phone_verification',
        }
      );

      toast.success(res.message || 'Verification code sent via SMS.');
      setStep('otp');
      setOtpCode('');
      setCooldown(res.cooldownSeconds || 60);
      setAttemptsRemaining(5);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification code
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setIsSubmitting(true);
    try {
      await api.post('/users/me/phone/verification/resend', {
        purpose: 'user_phone_verification',
      });
      toast.success('New verification code sent via SMS.');
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter the 6-digit numeric verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; data: any }>('/users/me/phone/verification/verify', {
        code: otpCode.trim(),
        purpose: 'user_phone_verification',
      });

      if (res.success) {
        toast.success('Phone number verified successfully!');
        setIsModalOpen(false);
        setStep('input');
        setOtpCode('');
        await fetchContact();
      }
    } catch (err: any) {
      toast.error(err.message || 'Verification failed.');
      if (err.data?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(err.data.attemptsRemaining);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unlink / remove phone number
  const handleRemovePhone = async () => {
    if (!confirm('Are you sure you want to remove your phone number? Any SMS recovery or 2FA features tied to this phone will be disabled.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.delete('/users/me/phone');
      toast.success('Phone number removed.');
      setPhoneInput('');
      await fetchContact();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove phone number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Recovery or MFA setting
  const handleToggleSecuritySetting = async (field: 'phoneUsedForRecovery' | 'phoneUsedForMfa', value: boolean) => {
    if (!contact || contact.phoneStatus !== 'verified') {
      toast.error('Phone number must be verified before enabling this security feature.');
      return;
    }

    try {
      await api.patch('/users/me/contact', {
        [field]: value,
      });
      setContact({ ...contact, [field]: value });
      toast.success(`${field === 'phoneUsedForRecovery' ? 'Account recovery' : 'SMS MFA'} setting updated.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update security setting.');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        <span className="text-xs text-slate-400">Loading phone security details...</span>
      </div>
    );
  }

  const isVerified = contact?.phoneStatus === 'verified';
  const hasPhone = Boolean(contact?.phone);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-100">Personal Phone & SMS Security</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Optional phone number for account verification, emergency password recovery, and security alerts.
          </p>
        </div>

        {hasPhone && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isVerified
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {isVerified ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Unverified
              </>
            )}
          </span>
        )}
      </div>

      {/* Main Details Box */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-md p-4">
        {hasPhone ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span>{contact?.phone}</span>
                {contact?.phoneNormalized && contact.phoneNormalized !== contact.phone && (
                  <span className="text-xs font-mono text-slate-400">({contact.phoneNormalized})</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isVerified
                  ? `Verified on ${contact?.phoneVerifiedAt ? new Date(contact.phoneVerifiedAt).toLocaleDateString() : 'recent date'}`
                  : 'Phone number has not been verified yet with an SMS OTP code.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isVerified && (
                <Button
                  size="sm"
                  onClick={() => {
                    setPhoneInput(contact?.phone || '');
                    setStep('input');
                    setIsModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium h-8"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Verify Now
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPhoneInput(contact?.phone || '');
                  setStep('input');
                  setIsModalOpen(true);
                }}
                className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs h-8"
              >
                Change
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemovePhone}
                disabled={isSubmitting}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8 px-2"
                title="Remove phone number"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-300">No phone number attached</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Add your phone number to enable SMS-based emergency account recovery.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setPhoneInput('');
                setStep('input');
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium h-8"
            >
              <Phone className="w-3.5 h-3.5 mr-1.5" />
              Add Phone Number
            </Button>
          </div>
        )}
      </div>

      {/* Security Options (Recovery & MFA) */}
      <div className="pt-2 border-t border-slate-800/80 space-y-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Security & Account Protection Features
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Recovery Toggle */}
          <div
            className={`p-3.5 rounded-md border transition-all ${
              !isVerified
                ? 'bg-slate-950/30 border-slate-800/50 opacity-60'
                : contact?.phoneUsedForRecovery
                ? 'bg-indigo-950/20 border-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-200">SMS Account Recovery</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Use your verified phone to recover your account if you lose access to your primary email.
                </p>
              </div>

              <input
                type="checkbox"
                checked={!!contact?.phoneUsedForRecovery}
                disabled={!isVerified}
                onChange={(e) => handleToggleSecuritySetting('phoneUsedForRecovery', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50"
              />
            </div>
          </div>

          {/* MFA Toggle */}
          <div
            className={`p-3.5 rounded-md border transition-all ${
              !isVerified
                ? 'bg-slate-950/30 border-slate-800/50 opacity-60'
                : contact?.phoneUsedForMfa
                ? 'bg-indigo-950/20 border-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-200">SMS Verification Codes</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Require a one-time SMS verification code on sensitive actions or unfamiliar sign-in locations.
                </p>
              </div>

              <input
                type="checkbox"
                checked={!!contact?.phoneUsedForMfa}
                disabled={!isVerified}
                onChange={(e) => handleToggleSecuritySetting('phoneUsedForMfa', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {!isVerified && hasPhone && (
          <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Complete phone verification above to enable account recovery and SMS security features.</span>
          </p>
        )}
      </div>

      {/* Verification Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {step === 'input' ? 'Verify Phone Number' : 'Enter Verification Code'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {step === 'input'
                      ? 'We will send a 6-digit verification code via SMS.'
                      : `Code sent to ${phoneInput}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1"
              >
                ✕
              </button>
            </div>

            {step === 'input' ? (
              <form onSubmit={handleStartVerification} className="space-y-4">
                <div>
                  <Label htmlFor="phone-modal-input" className="text-xs text-slate-300 font-medium">
                    Mobile Phone Number (Nigeria / International)
                  </Label>
                  <div className="mt-1.5 relative">
                    <Input
                      id="phone-modal-input"
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="e.g. 0803 123 4567 or +234 803 123 4567"
                      required
                      autoFocus
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs pl-3 focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Accepts Nigerian local format (080..., 070..., 090...) or international E.164.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !phoneInput.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Send Code
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <Label htmlFor="otp-input" className="text-xs text-slate-300 font-medium">
                    6-Digit Verification Code
                  </Label>
                  <Input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="mt-1.5 bg-slate-950 border-slate-800 text-slate-100 text-center tracking-[0.5em] text-lg font-mono focus:border-indigo-500"
                  />
                  {attemptsRemaining !== null && (
                    <p className="text-[11px] text-amber-400/90 mt-1.5 text-center">
                      {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldown > 0 || isSubmitting}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <RotateCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend SMS code'}
                  </button>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep('input')}
                      className="text-slate-400 hover:text-slate-200 text-xs"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting || otpCode.length !== 6}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Verify & Save
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
