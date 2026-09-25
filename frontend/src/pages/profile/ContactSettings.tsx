import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { StateSelector } from '@/components/location/StateSelector';
import { LgaSelector } from '@/components/location/LgaSelector';
import { DEFAULT_NIGERIAN_STATES } from '@/stores/useLocationStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

const resolveStateCode = (stateNameOrCode?: string): string => {
  if (!stateNameOrCode) return '';
  const match = DEFAULT_NIGERIAN_STATES.find(
    (s) =>
      s.code.toUpperCase() === stateNameOrCode.toUpperCase() ||
      s.stateCode.toUpperCase() === stateNameOrCode.toUpperCase() ||
      s.name.toLowerCase() === stateNameOrCode.toLowerCase()
  );
  return match ? match.code : stateNameOrCode;
};

const contactSchema = z.object({
  phoneVisibility: z.enum(['private', 'workspace']).default('private'),
  country: z.string().min(2, 'Country is required'),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  lga: z.string().optional(),
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

  // Track stateCode separately — LgaSelector needs the code (e.g. "LA"), not the name ("Lagos")
  const [selectedStateCode, setSelectedStateCode] = useState(() =>
    user ? user.stateCode || resolveStateCode(user.state) : ''
  );

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
      stateCode: user?.stateCode || (user?.state ? resolveStateCode(user.state) : ''),
      lga: user?.lga || '',
      city: user?.city || '',
      timezone: user?.timezone || 'Africa/Lagos',
    },
  });

  const selectedLga = watch('lga');

  useEffect(() => {
    if (user) {
      const code = user.stateCode || resolveStateCode(user.state);
      reset({
        phoneVisibility: (user.phoneVisibility as 'private' | 'workspace') || 'private',
        country: user.country || 'Nigeria',
        state: user.state || '',
        stateCode: code || '',
        lga: user.lga || '',
        city: user.city || '',
        timezone: user.timezone || 'Africa/Lagos',
      });
      setSelectedStateCode(code || '');
    }
  }, [user, reset]);

  const onSubmit = async (data: ContactFormData) => {
    setIsLoading(true);
    try {
      const code = selectedStateCode || resolveStateCode(data.state);
      const payload = {
        ...data,
        stateCode: code,
      };
      const res = await api.patch<{ success: boolean; data?: any; user?: any }>('/users/me/contact', payload);
      if (res?.user) {
        updateUser(res.user);
      } else if (res?.data) {
        updateUser(res.data);
      }
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

  return (
    <ProfileLayout
      title="Contact & Location"
      description="Manage your primary email, privacy preferences, and geographical region."
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
                value={selectedStateCode || resolveStateCode(watch('state'))}
                onChange={(code, name) => {
                  setSelectedStateCode(code);
                  setValue('state', name, { shouldDirty: true });
                  setValue('stateCode', code, { shouldDirty: true });
                  setValue('lga', '', { shouldDirty: true });
                }}
                label="State"
              />

              <LgaSelector
                stateCode={selectedStateCode || resolveStateCode(watch('state'))}
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
    </ProfileLayout>
  );
};

