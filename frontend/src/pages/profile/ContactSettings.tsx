import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserPhoneStore, type UserPhone } from '@/stores/useUserPhoneStore';
import { formatPhoneForDisplay } from '@/lib/phoneValidation';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { PhoneInput } from '@/components/phone/PhoneInput';
import { OtpVerificationModal } from '@/components/phone/OtpVerificationModal';
import { StateSelector } from '@/components/location/StateSelector';
import { LgaSelector } from '@/components/location/LgaSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Star,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

const contactSchema = z.object({
  phoneVisibility: z.enum(['private', 'workspace']).default('private'),
  country: z.string().min(2, 'Country is required'),
  state: z.string().optional(),
  lga: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().default('Africa/Lagos'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const ContactSettings: React.FC = () => {
  const { user, updateUser, refreshSession } = useAuthStore();
  const { phones, fetchPhones, setPrimary, deletePhone, sendOtp } = useUserPhoneStore();
  const [isLoading, setIsLoading] = useState(false);

  // Email Change Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSendingEmailRequest, setIsSendingEmailRequest] = useState(false);

  // Add Phone State
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [phoneForOtp, setPhoneForOtp] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      phoneVisibility: (user?.phoneVisibility as 'private' | 'workspace') || 'private',
      country: user?.country || 'Nigeria',
      state: user?.state || '',
      lga: '',
      city: user?.city || '',
      timezone: user?.timezone || 'Africa/Lagos',
    },
  });

  const selectedState = watch('state');
  const selectedLga = watch('lga');

  useEffect(() => {
    if (user) {
      reset({
        phoneVisibility: (user.phoneVisibility as 'private' | 'workspace') || 'private',
        country: user.country || 'Nigeria',
        state: user.state || '',
        lga: '',
        city: user.city || '',
        timezone: user.timezone || 'Africa/Lagos',
      });
    }
  }, [user, reset]);

  useEffect(() => {
    fetchPhones();
  }, [fetchPhones]);

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

  const handleStartVerifyPhone = async (phoneNumber: string) => {
    try {
      await sendOtp(phoneNumber);
      setPhoneForOtp(phoneNumber);
    } catch {
      // Error handled in store
    }
  };

  return (
    <ProfileLayout
      title="Contact & Location"
      description="Manage your verified email, phone recovery details, and geographical region."
      activeSection="contact"
    >
      <div className="space-y-6">
        {/* Email Management Card */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Primary Account Email</h4>
                <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unverified
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEmailModalOpen(true)}
                className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs rounded-lg cursor-pointer"
              >
                Change Email
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Your email is your central login identifier. Changing it requires verification of the new address before activation.
          </p>
        </div>

        {/* Phone Numbers Management Card */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Registered Phone Numbers</h4>
                <p className="text-xs text-slate-400">Manage verified phone numbers for security alerts and 2FA.</p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsAddingPhone(!isAddingPhone)}
              className="bg-[#714b67] hover:bg-[#85587a] text-white text-xs rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingPhone ? 'Cancel' : 'Add Phone'}</span>
            </Button>
          </div>

          {/* Add Phone Form */}
          {isAddingPhone && (
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3 animate-in fade-in duration-150">
              <h5 className="text-xs font-semibold text-white">Add New Nigerian Mobile Number</h5>
              <PhoneInput
                value={newPhoneNumber}
                onChange={(val) => setNewPhoneNumber(val)}
                label="Mobile Phone"
                placeholder="0801 234 5678"
                onVerified={() => {
                  setIsAddingPhone(false);
                  setNewPhoneNumber('');
                  fetchPhones();
                }}
              />
            </div>
          )}

          {/* Phone List */}
          <div className="space-y-2.5 pt-1">
            {phones.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-500">
                No phone numbers registered yet. Add a phone number for account recovery.
              </div>
            ) : (
              phones.map((phone: UserPhone) => (
                <div
                  key={phone._id}
                  className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-white">
                          {formatPhoneForDisplay(phone.phone)}
                        </span>
                        {phone.isPrimary && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/40 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-[#d4a8c9]" />
                            PRIMARY
                          </span>
                        )}
                        {phone.isVerified ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!phone.isVerified && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartVerifyPhone(phone.phoneNormalized)}
                        className="text-[11px] h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-md"
                      >
                        Verify Now
                      </Button>
                    )}

                    {phone.isVerified && !phone.isPrimary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPrimary(phone._id)}
                        className="text-[11px] h-7 text-slate-400 hover:text-white rounded-md"
                      >
                        Make Primary
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove phone number ${formatPhoneForDisplay(phone.phone)}?`)) {
                          deletePhone(phone._id);
                        }
                      }}
                      className="text-[11px] h-7 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md p-1.5"
                      title="Remove Phone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contact & Location Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Phone Visibility */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2">
            <Label className="text-xs font-semibold text-slate-300">Phone Visibility in Workspaces</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 cursor-pointer">
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

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 cursor-pointer">
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

          {/* Regional Details (Nigeria Location Database) */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-semibold text-slate-300">Geographical Location</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <StateSelector
                value={selectedState}
                onChange={(_code, name) => {
                  setValue('state', name, { shouldDirty: true });
                  setValue('lga', '', { shouldDirty: true });
                }}
                label="State"
              />

              <LgaSelector
                stateCode={selectedState}
                value={selectedLga}
                onChange={(lga) => setValue('lga', lga, { shouldDirty: true })}
                label="LGA"
              />

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">City / Area</Label>
                <Input
                  {...register('city')}
                  className="bg-slate-950 border-slate-800 text-xs text-white rounded-lg"
                  placeholder="e.g. Ikeja, Lekki"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end border-t border-slate-800">
            <Button
              type="submit"
              disabled={isLoading || !isDirty}
              className="bg-[#714b67] hover:bg-[#85587a] text-white font-medium text-xs px-6 rounded-xl cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
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
          <div className="max-w-md w-full bg-slate-950 border border-white/10 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-pink-300">
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
                  className="bg-slate-900 border-slate-800 text-white rounded-lg"
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
                  className="border-slate-800 bg-transparent text-slate-300 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingEmailRequest}
                  className="bg-[#714b67] hover:bg-[#85587a] text-white text-xs px-4 rounded-lg"
                >
                  {isSendingEmailRequest ? 'Sending link...' : 'Send Verification Link'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {phoneForOtp && (
        <OtpVerificationModal
          isOpen={!!phoneForOtp}
          phone={phoneForOtp}
          onClose={() => setPhoneForOtp(null)}
          onSuccess={() => {
            setPhoneForOtp(null);
            fetchPhones();
          }}
        />
      )}
    </ProfileLayout>
  );
};
