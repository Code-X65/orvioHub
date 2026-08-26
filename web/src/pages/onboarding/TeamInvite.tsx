import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Link2, Check } from 'lucide-react';

const invitationSchema = z.object({
  invitations: z.array(
    z.object({
      email: z.string().email('Invalid email address').or(z.literal('')),
      role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
    })
  ),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

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
    } catch (error: any) {
      toast.error(error.message || 'Failed to advance step.');
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <OnboardingLayout
      title="Invite members to your organization"
      subtitle="Collaboration is better together. Invite team members or staff to your organization now or share a link."
      stepName="Members"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Quick Link Share Option */}
        <div className="bg-[#0a0609] border border-white/10 rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#714b67]/20 text-[#c79dbd] flex items-center justify-center border border-[#714b67]/30 shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white">Shareable Invite Link</div>
              <div className="text-[10px] text-slate-400">
                Send directly via WhatsApp, Slack, or Email
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateAndCopyLink}
            className="w-full sm:w-auto h-8 text-xs font-medium border-white/10 bg-[#160f14] text-slate-200 hover:text-white hover:bg-[#20141d] rounded-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 text-[#c79dbd]" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </Button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/5 w-full" />
          <span className="px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider absolute bg-[#0a0609]">
            Or invite by email
          </span>
        </div>

        {/* Email Invitation Rows */}
        <div className="space-y-2.5">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  placeholder="colleague@company.com"
                  {...register(`invitations.${index}.email`)}
                  className="h-10 bg-[#0a0609] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
                  disabled={isLoading}
                />
              </div>

              <div className="w-32 shrink-0">
                <select
                  {...register(`invitations.${index}.role`)}
                  className="w-full h-10 px-3 bg-[#0a0609] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
                  disabled={isLoading}
                >
                  <option value="MEMBER" className="bg-[#120b10] text-white">Member</option>
                  <option value="MANAGER" className="bg-[#120b10] text-white">Manager</option>
                  <option value="ADMIN" className="bg-[#120b10] text-white">Admin</option>
                </select>
              </div>

              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="w-9 h-9 rounded-xs flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ email: '', role: 'MEMBER' })}
            className="text-xs font-semibold text-[#c79dbd] hover:text-white flex items-center gap-1.5 pt-1 pl-1 cursor-pointer transition-colors"
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
            className="w-full sm:w-auto h-11 px-6 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
