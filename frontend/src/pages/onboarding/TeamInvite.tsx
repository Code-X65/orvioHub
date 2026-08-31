import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Link2, Check, Mail } from 'lucide-react';

const invitationSchema = z.object({
  invitations: z.array(
    z.object({
      email: z.string().email('Invalid email address').or(z.literal('')),
      role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
    })
  ),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'MEMBER', label: 'Member', badge: 'Standard', badgeColor: 'bg-white/5 text-slate-300 border border-white/10' },
  { value: 'MANAGER', label: 'Manager', badge: 'Lead', badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  { value: 'ADMIN', label: 'Admin', badge: 'Full Access', badgeColor: 'bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/30' },
];

export const TeamInvite: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, onboardingStatus } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareableLink, setShareableLink] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      invitations: [
        { email: '', role: 'MEMBER' },
        { email: '', role: 'MEMBER' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'invitations',
  });

  const invitations = watch('invitations');

  const generateAndCopyLink = async () => {
    try {
      if (shareableLink) {
        await navigator.clipboard.writeText(shareableLink);
        setCopiedLink(true);
        toast.success('Organization invite link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 3000);
        return;
      }

      const res: any = await api.post('/onboarding/share-link', { role: 'MEMBER' });
      const link = res.data?.inviteUrl || `${window.location.origin}/invitations/${res.data?.token}`;
      setShareableLink(link);
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success('Organization invite link generated and copied!');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate shareable invite link.');
    }
  };

  const onSubmit = async (data: InvitationFormData) => {
    const validInvites = data.invitations.filter((inv) => inv.email.trim() !== '');

    if (validInvites.length === 0) {
      handleSkip();
      return;
    }

    setIsLoading(true);
    try {
      await api.post(`/organizations/${onboardingStatus?.organization?.id}/invitations`, {
        invitations: validInvites,
      });
      toast.success(`Successfully sent ${validInvites.length} invitation(s)!`);
      await refreshSession();
      navigate('/onboarding/complete');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitations.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await api.post('/onboarding/skip', { step: 'TEAM_INVITATION' });
      await refreshSession();
      navigate('/onboarding/complete');
    } catch (err: any) {
      console.warn('[TeamInvite skip error]:', err);
      navigate('/onboarding/complete');
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <OnboardingLayout
      title="Invite your Team"
      subtitle="Collaboration is core to Orviohub. Give your colleagues instant access to sales, inventory, and operations."
      stepName="Team Setup"
      stepNumber={3}
      totalSteps={4}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Shareable Link Box */}
        <div className="p-4 rounded-2xl bg-[#160f14] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-[#d4a8c9]" />
              <span>Shareable Invitation Link</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Anyone with this link can join as a team Member
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateAndCopyLink}
            className="w-full sm:w-auto h-9 text-xs font-medium border-white/10 bg-[#160f14] text-slate-200 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 text-[#d4a8c9]" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </Button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/5 w-full" />
          <span className="px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider absolute bg-[#0c080b]">
            Or invite by email
          </span>
        </div>

        {/* Email Invitation Rows */}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="colleague@company.com"
                  {...register(`invitations.${index}.email`)}
                  className="pl-10 h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  disabled={isLoading}
                />
              </div>

              <div className="w-36 shrink-0">
                <CustomSelect
                  options={ROLE_OPTIONS}
                  value={invitations[index]?.role || 'MEMBER'}
                  onChange={(val) => setValue(`invitations.${index}.role`, val as any)}
                  searchable={false}
                  disabled={isLoading}
                />
              </div>

              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ email: '', role: 'MEMBER' })}
            className="text-xs font-semibold text-[#d4a8c9] hover:text-white flex items-center gap-1.5 pt-1 pl-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add another member</span>
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSkipping || isLoading}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors py-2 px-1 cursor-pointer"
          >
            {isSkipping ? 'Advancing...' : 'Skip for now, I will invite later'}
          </button>

          <Button
            type="submit"
            className="w-full sm:w-auto h-11 px-6 bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white rounded-xl font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            disabled={isLoading || isSkipping}
          >
            {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
            {isLoading ? 'Sending Invites...' : (
              <>
                <span>Send Invites & Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  );
};
