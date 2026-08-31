import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { api } from '@/lib/api';
import { AuthLayout } from '../auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { AvatarCropperModal } from '@/components/profile/AvatarCropperModal';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  User,
  Phone,
  SunMoon,
  Upload,
  Camera,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT) - Lagos, Abuja', badge: 'WAT' },
  { value: 'Africa/Accra', label: 'Greenwich Mean Time (GMT) - Accra', badge: 'GMT' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT) - Nairobi', badge: 'EAT' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (SAST) - Johannesburg', badge: 'SAST' },
  { value: 'Europe/London', label: 'British Time (BST/GMT) - London', badge: 'UK' },
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York', badge: 'EST' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', badge: 'UTC' },
];

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'en', label: 'English (UK / Nigeria)', badge: 'EN' },
  { value: 'fr', label: 'French (Français)', badge: 'FR' },
  { value: 'yo', label: 'Yorùbá', badge: 'YO' },
  { value: 'ha', label: 'Hausa', badge: 'HA' },
  { value: 'ig', label: 'Igbo', badge: 'IG' },
  { value: 'pcm', label: 'Nigerian Pidgin', badge: 'PCM' },
];

const DATE_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 31/12/2026)', badge: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 12/31/2026)', badge: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO standard)', badge: 'ISO' },
];

const EMAIL_FREQUENCY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All emails (Real-time updates & alerts)', badge: 'Real-time' },
  { value: 'important', label: 'Important only (Security & critical notifications)', badge: 'Important' },
  { value: 'weekly', label: 'Weekly digest summary', badge: 'Weekly' },
  { value: 'none', label: 'Minimal (Mandatory transactional only)', badge: 'Minimal' },
];

export const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, refreshSession } = useAuthStore();
  const { completeStep, skipStep } = useOnboardingStore();

  const [displayName, setDisplayName] = useState(
    user?.displayName || user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || ''
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || user?.avatar || null);
  const [phone, setPhone] = useState(user?.phone || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Lagos');
  const [language, setLanguage] = useState(user?.language || 'en');
  const [dateFormat, setDateFormat] = useState(user?.dateFormat || 'DD/MM/YYYY');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(
    (user?.theme as 'light' | 'dark' | 'system') || 'dark'
  );
  const [emailFrequency, setEmailFrequency] = useState('all');

  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Phone OTP modal state
  const [isPhoneOtpModalOpen, setIsPhoneOtpModalOpen] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(Boolean(user?.phoneVerifiedAt));

  useEffect(() => {
    if (user) {
      if (!displayName) {
        setDisplayName(
          user.displayName || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim()
        );
      }
      if (user.avatarUrl || user.avatar) setAvatarUrl(user.avatarUrl || user.avatar || null);
      if (user.phone) setPhone(user.phone);
      if (user.timezone) setTimezone(user.timezone);
      if (user.phoneVerifiedAt) setPhoneVerified(true);
    }
  }, [user]);

  const handleSaveAvatar = async (croppedDataUrl: string) => {
    setAvatarUrl(croppedDataUrl);
    setIsCropperOpen(false);
  };

  const handleSendPhoneOtp = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a valid phone number.');
      return;
    }
    setIsSendingPhoneOtp(true);
    try {
      await api.post('/users/me/phone/verify', {
        action: 'request_otp',
        phone: phone.trim(),
      });
      setIsPhoneOtpModalOpen(true);
      toast.success('Verification code sent via SMS.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification SMS.');
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp.trim() || phoneOtp.length < 4) {
      toast.error('Please enter the 6-digit code sent to your phone.');
      return;
    }
    setIsVerifyingPhoneOtp(true);
    try {
      await api.post('/users/me/phone/verify', {
        action: 'verify_code',
        phone: phone.trim(),
        code: phoneOtp.trim(),
      });
      setPhoneVerified(true);
      setIsPhoneOtpModalOpen(false);
      toast.success('Phone number verified successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        displayName: displayName.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
        avatar: avatarUrl || undefined,
        phone: phone.trim() || undefined,
        timezone,
        language,
        dateFormat,
        theme,
      };

      const res = await api.patch<{ user: any }>('/users/me', payload);
      if (res.user) {
        updateUser(res.user);
      }
      await refreshSession();
      await completeStep('profile_setup', 'welcome', payload);
      toast.success('Profile preferences saved!');
      navigate('/welcome');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    await skipStep('profile_setup', 'welcome');
    navigate('/welcome');
  };

  const initials = (displayName || user?.name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AuthLayout>
      <div className="w-full max-w-[460px] mx-auto space-y-5 animate-in fade-in duration-200">
        {/* Step Header */}
        <div className="space-y-1.5 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-slate-300 text-[11px] font-medium mb-1">
            <span>Stage 3 of 5</span>
            <span className="w-1 h-1 rounded-full bg-slate-500" />
            <span>Profile Personalization</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Let's personalize your account
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            This information helps your team recognize you and ensures notifications arrive at the right time.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar Upload */}
          <div className="p-4 rounded-xl bg-[#160f14]/80 border border-white/10 flex items-center gap-4">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#714b67] to-[#8d5b80] text-white flex items-center justify-center font-bold text-lg overflow-hidden border-2 border-white/20 shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsCropperOpen(true)}
                className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity text-[10px]"
              >
                <Camera className="w-4 h-4 mb-0.5" />
                <span>Change</span>
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-white">Profile Photo</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                PNG, JPG or WebP (max 5MB).
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCropperOpen(true)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/15 text-slate-200 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Photo</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="px-2 py-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-xs font-medium text-slate-300">
              What should we call you? (Display Name)
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., John, J.O., CEO"
                className="pl-9 h-10 bg-[#160f14] border-white/10 text-white placeholder:text-slate-600 rounded-xl text-xs focus:ring-1 focus:ring-[#714b67]"
              />
            </div>
          </div>

          {/* Phone Number with SMS Verification */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="phone" className="text-xs font-medium text-slate-300">
                Phone Number (optional but encouraged)
              </Label>
              {phoneVerified && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneVerified) setPhoneVerified(false);
                  }}
                  placeholder="+234 801 234 5678"
                  className="pl-9 h-10 bg-[#160f14] border-white/10 text-white placeholder:text-slate-600 rounded-xl text-xs focus:ring-1 focus:ring-[#714b67]"
                />
              </div>
              {phone && !phoneVerified && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendPhoneOtp}
                  disabled={isSendingPhoneOtp}
                  className="h-10 px-3 bg-white/5 border-white/10 hover:bg-white/10 text-xs text-slate-200 shrink-0 rounded-xl"
                >
                  {isSendingPhoneOtp ? <Spinner size="sm" /> : 'Verify'}
                </Button>
              )}
            </div>
          </div>

          {/* Timezone & Language in Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">
                Timezone <span className="text-rose-400">*</span>
              </Label>
              <CustomSelect
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONE_OPTIONS}
                searchable
                placeholder="Select timezone"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Preferred Language</Label>
              <CustomSelect
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
                searchable
                placeholder="Select language"
              />
            </div>
          </div>

          {/* Date Format & Email Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Date Format</Label>
              <CustomSelect
                value={dateFormat}
                onChange={setDateFormat}
                options={DATE_FORMAT_OPTIONS}
                placeholder="Select format"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Email Frequency</Label>
              <CustomSelect
                value={emailFrequency}
                onChange={setEmailFrequency}
                options={EMAIL_FREQUENCY_OPTIONS}
                placeholder="Select frequency"
              />
            </div>
          </div>

          {/* Theme Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">Theme Preference</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`h-9 rounded-xl border text-xs font-medium capitalize transition-all flex items-center justify-center gap-1.5 ${
                    theme === t
                      ? 'bg-[#714b67]/30 border-[#714b67] text-white shadow-sm'
                      : 'bg-[#160f14] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <SunMoon className="w-3.5 h-3.5" />
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-white"
            >
              Skip for now
            </Button>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 px-6 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? <Spinner size="sm" className="text-white" /> : <span>Continue</span>}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>

        {/* Avatar Cropper Modal */}
        {isCropperOpen && (
          <AvatarCropperModal
            isOpen={isCropperOpen}
            onClose={() => setIsCropperOpen(false)}
            onSave={handleSaveAvatar}
            currentAvatarUrl={avatarUrl || undefined}
          />
        )}

        {/* Phone OTP Verification Modal */}
        {isPhoneOtpModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0c080b] border border-white/10 p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#e2b9d8]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Verify Phone Number</h3>
                <p className="text-[11px] text-slate-400">
                  Enter the 6-digit OTP sent to <strong className="text-slate-200">{phone}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="h-11 text-center text-lg tracking-widest font-mono bg-[#160f14] border-white/10 text-white rounded-xl"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPhoneOtpModalOpen(false)}
                  className="flex-1 h-9 bg-white/5 border-white/10 text-xs text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={isVerifyingPhoneOtp || phoneOtp.length < 4}
                  className="flex-1 h-9 bg-[#714b67] hover:bg-[#8d5b80] text-xs text-white"
                >
                  {isVerifyingPhoneOtp ? <Spinner size="sm" /> : 'Confirm OTP'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
