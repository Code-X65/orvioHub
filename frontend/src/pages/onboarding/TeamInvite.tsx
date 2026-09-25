import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { BranchAccessSelector, InviteLinkManager } from '@/components/team';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Link2, Check, Mail } from 'lucide-react';

const ROLE_KEYS = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'SALES_ATTENDANT',
  'STOCK_MANAGER',
  'ACCOUNTANT',
  'MEMBER',
  'VIEWER',
] as const;

export type OrganizationRole = (typeof ROLE_KEYS)[number];

const invitationSchema = z.object({
  invitations: z.array(
    z.object({
      email: z.string().email('Invalid email address').or(z.literal('')),
      role: z.enum(ROLE_KEYS),
      branchAccess: z.array(z.string()).optional(),
    })
  ),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

const ROLE_OPTIONS: SelectOption[] = [
  // Management
  {
    value: 'OWNER',
    label: 'Owner',
    badge: 'Owner',
    badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    description: 'Full organizational ownership and legal administration',
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    badge: 'Full Access',
    badgeColor: 'bg-[#714b67]/25 text-[#f0d8e8] border border-[#714b67]/40',
    description: 'Full administrative control over settings, apps, staff, and billing',
  },
  {
    value: 'MANAGER',
    label: 'Manager',
    badge: 'Lead',
    badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    description: 'Operational supervisor across branches, inventory, and staff',
  },
  // Operations
  {
    value: 'SALES_ATTENDANT',
    label: 'Sales Attendant',
    badge: 'POS',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    description: 'Point of sale operator, processing sales checkouts and customer receipts',
  },
  {
    value: 'STOCK_MANAGER',
    label: 'Stock Keeper',
    badge: 'Inventory',
    badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    description: 'Manages inventory stock levels, counts, transfers, and receiving',
  },
  {
    value: 'ACCOUNTANT',
    label: 'Accountant',
    badge: 'Finance',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    description: 'Financial oversight, invoices, customer payouts, and revenue reports',
  },
  // Standard
  {
    value: 'MEMBER',
    label: 'Member',
    badge: 'Standard',
    badgeColor: 'bg-white/5 text-slate-300 border border-white/10',
    description: 'General team member with standard operational collaboration access',
  },
  {
    value: 'VIEWER',
    label: 'Viewer',
    badge: 'Read-only',
    badgeColor: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    description: 'Read-only visibility into operational dashboards, records, and reports',
  },
];

export const TeamInvite: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, onboardingStatus } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches, loadBranches } = useBranchStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const activeOrgId = onboardingStatus?.organization?.id || currentWorkspace?.id;

  useEffect(() => {
    if (activeOrgId) {
      loadBranches(activeOrgId, 'inventory').catch(() => {});
    }
  }, [activeOrgId, loadBranches]);

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
        { email: '', role: 'SALES_ATTENDANT' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'invitations',
  });

  const invitations = watch('invitations');

  const onSubmit = async (data: InvitationFormData) => {
    const validInvites = data.invitations
      .filter((inv) => inv.email.trim() !== '')
      .map((inv) => ({
        email: inv.email.trim(),
        role: inv.role,
        branchAccess: inv.branchAccess && inv.branchAccess.length > 0 ? inv.branchAccess : undefined,
      }));

    if (validInvites.length === 0) {
      handleSkip();
      return;
    }

    setIsLoading(true);
    try {
      await api.post(`/organizations/${activeOrgId}/invitations`, {
        invitations: validInvites,
      });
      toast.success(`Successfully sent ${validInvites.length} invitation(s)!`);
      await refreshSession();
      navigate('/onboarding/complete');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send invitations.');
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
        {/* Shareable Link Dashboard */}
        <InviteLinkManager organizationId={activeOrgId} defaultRole="MEMBER" />

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/5 w-full" />
          <span className="px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider absolute bg-[#0c080b]">
            Or invite by email with roles & branch access
          </span>
        </div>

        {/* Email Invitation Rows */}
        <div className="space-y-3">
          {fields.map((field, index) => {
            const currentRole = invitations[index]?.role || 'MEMBER';
            const roleMeta = ROLE_OPTIONS.find((r) => r.value === currentRole);

            return (
              <div
                key={field.id}
                className="p-3.5 rounded-2xl bg-[#160f14] border border-white/10 space-y-3 shadow-inner transition-colors hover:border-white/15"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="colleague@company.com"
                      {...register(`invitations.${index}.email`)}
                      className="pl-10 h-10 bg-black/40 border-white/10 text-white rounded-xl text-xs focus:border-[#714b67]"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="w-full sm:w-48 shrink-0">
                    <CustomSelect
                      options={ROLE_OPTIONS}
                      value={currentRole}
                      onChange={(val) => setValue(`invitations.${index}.role`, val as any)}
                      placeholder="Select Role"
                      disabled={isLoading}
                    />
                  </div>

                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
                      title="Remove invitation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Role Description & Branch Access Scope */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-white/5">
                  <div className="text-[11px] text-slate-400 min-w-0 pr-2">
                    <span className="text-slate-500">Role scope: </span>
                    <span className="text-slate-300 font-medium">
                      {roleMeta?.description || 'Standard access'}
                    </span>
                  </div>

                  <div className="w-full sm:w-56 shrink-0">
                    <BranchAccessSelector
                      branches={branches}
                      selectedBranchIds={invitations[index]?.branchAccess || []}
                      allBranches={
                        !invitations[index]?.branchAccess ||
                        invitations[index]?.branchAccess?.length === 0 ||
                        (branches.length > 0 &&
                          invitations[index]?.branchAccess?.length === branches.length)
                      }
                      onChange={(selectedIds, all) => {
                        setValue(
                          `invitations.${index}.branchAccess`,
                          all ? undefined : selectedIds
                        );
                      }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            );
          })}

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

export default TeamInvite;
