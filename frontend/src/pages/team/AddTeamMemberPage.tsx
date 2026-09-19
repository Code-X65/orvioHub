import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { toast } from 'sonner';
import {
  UserPlus,
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Shield,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchSelection {
  branchId: string;
  branchRole: 'manager' | 'staff' | 'viewer' | 'accountant';
  assignmentType: 'primary' | 'secondary' | 'temporary';
  temporaryUntil?: number;
}

export const AddTeamMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches } = useBranchStore();

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [appRole, setAppRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Multi-Branch Assignment Builder
  const [branchAssignments, setBranchAssignments] = useState<BranchSelection[]>([
    {
      branchId: branches[0]?.id || '',
      branchRole: 'staff',
      assignmentType: 'primary',
    },
  ]);

  const workspaceId = currentWorkspace?.id || '';

  const handleAddBranchRow = () => {
    const unassigned = branches.find(
      (b) => !branchAssignments.some((ba) => ba.branchId === b.id)
    );
    if (unassigned) {
      setBranchAssignments([
        ...branchAssignments,
        {
          branchId: unassigned.id,
          branchRole: 'staff',
          assignmentType: 'secondary',
        },
      ]);
    } else {
      toast.info('All configured branches already added to assignment list.');
    }
  };

  const handleRemoveBranchRow = (index: number) => {
    setBranchAssignments(branchAssignments.filter((_, i) => i !== index));
  };

  const handleUpdateBranchRow = (index: number, updates: Partial<BranchSelection>) => {
    const updated = [...branchAssignments];
    updated[index] = { ...updated[index], ...updates };
    setBranchAssignments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !workspaceId) return;

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/invitations`, {
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        employeeId: employeeId.trim() || undefined,
        appRole,
        branchAssignments: branchAssignments.filter((ba) => ba.branchId),
        message: message.trim() || undefined,
      });

      toast.success(`Team invitation sent to ${email}`);
      navigate('/inventory/team/members');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to send invitation';
      if (msg.includes('limit') || msg.includes('PLAN_MEMBER_LIMIT_REACHED')) {
        setIsUpgradeModalOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/inventory/team/members')}
        className="text-slate-400 hover:text-white -ml-2 text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Back to Team Roster
      </Button>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#e6a8d6]" />
          Invite Team Member
        </h1>
        <p className="text-xs text-slate-400">
          Provision access to the Inventory application and allocate physical branch roles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Member Profile & Contact */}
        <div className="p-6 rounded-2xl bg-[#120a11]/90 border border-white/10 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Mail className="w-4 h-4 text-[#e6a8d6]" />
            1. Member Identity & Contact
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Email Address *</Label>
              <Input
                type="email"
                required
                placeholder="staff@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-white/10 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Work Phone (Optional)</Label>
              <Input
                type="tel"
                placeholder="+234 800 000 0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="bg-black/50 border-white/10 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Job Title / Designation (Optional)</Label>
              <Input
                placeholder="e.g. Lead Cashier, Warehouse Supervisor"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="bg-black/50 border-white/10 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Employee ID / Staff Code (Optional)</Label>
              <Input
                placeholder="e.g. EMP-1049"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="bg-black/50 border-white/10 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* 2. Application Base Role */}
        <div className="p-6 rounded-2xl bg-[#120a11]/90 border border-white/10 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Shield className="w-4 h-4 text-purple-400" />
            2. Application Base Role
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                role: 'admin',
                title: 'Application Admin',
                desc: 'Full governance of application settings, reports, transfers, and staff rosters.',
              },
              {
                role: 'member',
                title: 'Application Member',
                desc: 'Standard operational access for registers, inventory catalog, and stock movements.',
              },
              {
                role: 'viewer',
                title: 'Application Viewer',
                desc: 'Read-only access to view stock levels and performance analytics.',
              },
            ].map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => setAppRole(r.role as any)}
                className={cn(
                  'p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2',
                  appRole === r.role
                    ? 'bg-[#714b67]/25 border-[#714b67] text-white shadow-inner'
                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/15'
                )}
              >
                <div>
                  <span className="text-xs font-bold text-white block">{r.title}</span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{r.desc}</p>
                </div>
                {appRole === r.role && (
                  <span className="text-[10px] font-bold text-[#e6a8d6] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Multi-Branch Assignments */}
        <div className="p-6 rounded-2xl bg-[#120a11]/90 border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              3. Branch Location Assignments
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBranchRow}
              className="text-xs border-white/10 text-slate-300 hover:text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Add Another Branch
            </Button>
          </div>

          <div className="space-y-3">
            {branchAssignments.map((ba, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-black/40 border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
              >
                <div className="sm:col-span-4 space-y-1">
                  <Label className="text-[10px] text-slate-400">Branch Location</Label>
                  <select
                    value={ba.branchId}
                    onChange={(e) => handleUpdateBranchRow(index, { branchId: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-md bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-[10px] text-slate-400">Role at Location</Label>
                  <select
                    value={ba.branchRole}
                    onChange={(e) => handleUpdateBranchRow(index, { branchRole: e.target.value as any })}
                    className="w-full h-8 px-2.5 rounded-md bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
                  >
                    <option value="manager">Branch Manager</option>
                    <option value="staff">Branch Staff</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-[10px] text-slate-400">Assignment Type</Label>
                  <select
                    value={ba.assignmentType}
                    onChange={(e) => handleUpdateBranchRow(index, { assignmentType: e.target.value as any })}
                    className="w-full h-8 px-2.5 rounded-md bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
                  >
                    <option value="primary">Primary Location</option>
                    <option value="secondary">Secondary Location</option>
                    <option value="temporary">Temporary Assignment</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-center justify-end pt-3 sm:pt-0">
                  {branchAssignments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBranchRow(index)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Custom Invitation Message */}
        <div className="p-6 rounded-2xl bg-[#120a11]/90 border border-white/10 shadow-xl space-y-3">
          <Label className="text-xs text-slate-200">Personal Welcome Message (Optional)</Label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Welcome to our store operations team! Please click the link to accept access."
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/inventory/team/members')}
            className="text-slate-400 hover:text-white text-xs"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-6 h-10 shadow-lg shadow-[#714b67]/25 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Sending Invitation...
              </>
            ) : (
              'Send Team Invitation'
            )}
          </Button>
        </div>
      </form>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        workspaceId={workspaceId}
        currentPlanKey="free_trial"
        triggerReason="member_limit"
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
};
