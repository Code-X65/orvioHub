import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

const contactSchema = z.object({
  phone: z.string().optional(),
  phoneVisibility: z.enum(['private', 'workspace']).default('private'),
  country: z.string().min(2, 'Country is required'),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().default('Africa/Lagos'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const ContactSettings: React.FC = () => {
  const { user, updateUser, refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  // Email Change Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSendingEmailRequest, setIsSendingEmailRequest] = useState(false);

  // Phone Verification Modal State
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isDirty },
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      phone: user?.phone || '',
      phoneVisibility: (user?.phoneVisibility as 'private' | 'workspace') || 'private',
      country: user?.country || 'NG',
      state: user?.state || '',
      city: user?.city || '',
      timezone: user?.timezone || 'Africa/Lagos',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsLoading(true);
    try {
      const res = await api.patch<{ user: any }>('/users/me/contact', data);
      updateUser(res.user);
      await refreshSession();
      toast.success('Contact & location information saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update contact information.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address.');
      return;
    }
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('New email must be different from current email.');
      return;
    }

    setIsSendingEmailRequest(true);
    try {
      await api.post('/auth/email/change-request', { newEmail: newEmail.trim() });
      toast.success(`Verification link sent to ${newEmail}! Please check your inbox.`);
      setIsEmailModalOpen(false);
      setNewEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification email.');
    } finally {
      setIsSendingEmailRequest(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const currentPhone = watch('phone');
    if (!currentPhone) {
      toast.error('Please enter a phone number first.');
      return;
    }

    setIsSendingOtp(true);
    try {
      await api.post('/users/me/phone/verify', {
        action: 'request_otp',
        phone: currentPhone,
      });
      setIsPhoneModalOpen(true);
      toast.success(`OTP verification code sent to ${currentPhone}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOtp.trim() || phoneOtp.trim().length < 4) {
      toast.error('Please enter a valid OTP code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await api.post<{ user: any }>('/users/me/phone/verify', {
        action: 'verify_code',
        code: phoneOtp.trim(),
      });
      updateUser(res.user);
      await refreshSession();
      toast.success('Phone number verified successfully!');
      setIsPhoneModalOpen(false);
      setPhoneOtp('');
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <ProfileLayout
      title="Contact & Location"
      description="Manage your verified email, phone recovery details, and geographical region."
      activeSection="contact"
    >
      <div className="space-y-8">
        {/* Email Management Card */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Primary Account Email</h4>
                <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unverified
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEmailModalOpen(true)}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
              >
                Change Email
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Your email is your central login identifier. Changing it requires verification of the new address before activation.
          </p>
        </div>

        {/* Contact & Location Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Phone Number */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-300">Phone Number</Label>
            <div className="flex gap-2">
              <Input
                {...register('phone')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] flex-1 font-mono"
                placeholder="+234 801 234 5678"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendPhoneOtp}
                disabled={isSendingOtp}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs shrink-0"
              >
                {isSendingOtp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : user?.phoneVerifiedAt ? (
                  <span className="flex items-center text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Verified
                  </span>
                ) : (
                  'Verify Phone'
                )}
              </Button>
            </div>
          </div>

          {/* Phone Visibility */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <Label className="text-xs font-semibold text-slate-300">Phone Visibility in Workspaces</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-white/10 hover:border-white/20 bg-black/40 cursor-pointer">
                <input
                  type="radio"
                  value="private"
                  {...register('phoneVisibility')}
                  className="mt-1 accent-[#714b67]"
                />
                <div>
                  <div className="text-xs font-medium text-white flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    Private (Default)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Only used for account recovery & security alerts. Hidden from workspace members.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-white/10 hover:border-white/20 bg-black/40 cursor-pointer">
                <input
                  type="radio"
                  value="workspace"
                  {...register('phoneVisibility')}
                  className="mt-1 accent-[#714b67]"
                />
                <div>
                  <div className="text-xs font-medium text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    Visible in Workspaces
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Allow teammates and colleagues in your workspaces to view your contact phone number.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Regional Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Country *</Label>
              <select
                {...register('country')}
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="NG">Nigeria (NG)</option>
                <option value="GH">Ghana (GH)</option>
                <option value="KE">Kenya (KE)</option>
                <option value="ZA">South Africa (ZA)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="US">United States (US)</option>
                <option value="CA">Canada (CA)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">State / Province</Label>
              <Input
                {...register('state')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="Lagos"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">City</Label>
              <Input
                {...register('city')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="Ikeja"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end border-t border-white/10">
            <Button
              type="submit"
              disabled={isLoading || !isDirty}
              className="bg-[#714b67] hover:bg-[#88597c] text-white font-medium text-xs px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Contact Details'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Change Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-950 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-pink-300">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Change Email Address</h3>
                <p className="text-xs text-slate-400">Current: {user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleRequestEmailChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-300">New Email Address</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="newemail@example.com"
                  className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-white/5 p-3 rounded-lg border border-white/5">
                A verification link will be sent to the new email address. Your existing email remains active until you click the confirmation link.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="border-white/10 bg-transparent text-slate-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingEmailRequest}
                  className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs px-4"
                >
                  {isSendingEmailRequest ? 'Sending link...' : 'Send Verification Link'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phone OTP Verification Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-950 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Enter OTP Verification Code</h3>
                <p className="text-xs text-slate-400">We sent a 6-digit code to your phone.</p>
              </div>
            </div>

            <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-300">6-Digit Code</Label>
                <Input
                  type="text"
                  maxLength={6}
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  required
                  placeholder="123456"
                  className="bg-black/60 border-white/10 text-white text-center font-mono tracking-widest text-lg focus:border-[#714b67]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPhoneModalOpen(false)}
                  className="border-white/10 bg-transparent text-slate-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4"
                >
                  {isVerifyingOtp ? 'Verifying...' : 'Confirm Code'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProfileLayout>
  );
};
