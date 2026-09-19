import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { AdminActionModal, SupportNotesList } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Building2,
  ArrowLeft,
  Store,
  Users,
  ShieldAlert,
  CreditCard,
  FileText,
  Sliders,
  CheckCircle2,
  PowerOff,
  RefreshCw,
  Archive,
  Star,
  Clock,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  MapPin,
  Calendar,
} from 'lucide-react';

export const AdminOrganizationDetailPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'apps' | 'branches' | 'members' | 'billing' | 'onboarding' | 'audit' | 'notes'
  >('overview');

  const [org, setOrg] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [supportNotes, setSupportNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [actionModal, setActionModal] = useState<{
    type: 'suspend' | 'restore' | 'archive' | 'extend_trial' | 'revoke_sessions';
    targetName?: string;
  } | null>(null);

  const [trialDaysToAdd, setTrialDaysToAdd] = useState(14);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [
        orgRes,
        appsRes,
        branchesRes,
        membersRes,
        invitesRes,
        billingRes,
        onboardingRes,
        auditRes,
        notesRes,
      ] = await Promise.all([
        api.get<any>(`/admin/organizations/${workspaceId}`).catch(() => null),
        api.get<any>(`/admin/organizations/${workspaceId}/applications`).catch(() => ({ data: { applications: [] } })),
        api.get<any>(`/admin/organizations/${workspaceId}/branches`).catch(() => ({ data: { branches: [] } })),
        api.get<any>(`/admin/organizations/${workspaceId}/members`).catch(() => ({ data: { members: [] } })),
        api.get<any>(`/admin/organizations/${workspaceId}/invitations`).catch(() => ({ data: { invitations: [] } })),
        api.get<any>(`/admin/organizations/${workspaceId}/billing`).catch(() => ({ data: {} })),
        api.get<any>(`/admin/organizations/${workspaceId}/onboarding`).catch(() => ({ data: {} })),
        api.get<any>(`/admin/organizations/${workspaceId}/audit`).catch(() => ({ data: { logs: [] } })),
        api.get<any>(`/admin/organizations/${workspaceId}/support-notes`).catch(() => ({ data: { notes: [] } })),
      ]);

      const orgData = orgRes?.data || orgRes?.organization || orgRes;
      setOrg(orgData || { id: workspaceId, name: 'Organization', status: 'active', planKey: 'free_trial' });
      setApps(appsRes?.data?.applications || appsRes?.applications || []);
      setBranches(branchesRes?.data?.branches || branchesRes?.branches || []);
      setMembers(membersRes?.data?.members || membersRes?.members || []);
      setInvitations(invitesRes?.data?.invitations || invitesRes?.invitations || []);
      setBilling(billingRes?.data || billingRes || {});
      setOnboarding(onboardingRes?.data || onboardingRes || {});
      setAuditLogs(auditRes?.data?.logs || auditRes?.logs || []);
      setSupportNotes(notesRes?.data?.notes || notesRes?.notes || []);
    } catch (err: any) {
      toast.error('Failed to load organization inspection data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleActionConfirm = async (data: { reason: string; totpCode?: string }) => {
    if (!actionModal || !workspaceId) return;
    const { type } = actionModal;

    try {
      if (type === 'suspend') {
        await api.post(`/admin/organizations/${workspaceId}/suspend`, { reason: data.reason });
        toast.success('Organization suspended.');
      } else if (type === 'restore') {
        await api.post(`/admin/organizations/${workspaceId}/restore`, { reason: data.reason });
        toast.success('Organization restored.');
      } else if (type === 'archive') {
        await api.post(`/admin/organizations/${workspaceId}/archive`, { reason: data.reason, totpCode: data.totpCode });
        toast.success('Organization archived.');
      } else if (type === 'extend_trial') {
        await api.post(`/admin/organizations/${workspaceId}/trial/extend`, {
          days: trialDaysToAdd,
          reason: data.reason,
        });
        toast.success(`Free Trial extended by ${trialDaysToAdd} days.`);
      } else if (type === 'revoke_sessions') {
        await api.post(`/admin/organizations/${workspaceId}/revoke-sessions`, { reason: data.reason });
        toast.success('Active user sessions revoked for this organization.');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || `Action failed.`);
      throw err;
    }
  };

  const handleAddSupportNote = async (note: string, category: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/admin/organizations/${workspaceId}/support-notes`, { note, category });
      toast.success('Internal support note recorded.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record note.');
    }
  };

  const planKey = org?.planKey || org?.planId || 'free_trial';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/organizations')}
            className="text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Organizations Directory
          </Button>

          <div className="flex items-center gap-2">
            {org?.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModal({ type: 'suspend' })}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs h-8"
              >
                <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                Suspend Tenant
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModal({ type: 'restore' })}
                className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs h-8"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Restore Tenant
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionModal({ type: 'revoke_sessions' })}
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-8"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Revoke Sessions
            </Button>
          </div>
        </div>

        {/* Organization Header Banner */}
        <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#714b67]/30 border border-[#714b67]/60 flex items-center justify-center text-lg font-black text-[#e6a8d6]">
              {(org?.name || 'O').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-white">{org?.name}</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                  {org?.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Owner: <span className="text-slate-200">{org?.ownerEmail || '—'}</span> · Country:{' '}
                <span className="text-slate-200">{org?.country || 'Nigeria'}</span> · Timezone:{' '}
                <span className="text-slate-200">{org?.timezone || 'Africa/Lagos'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                org?.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {org?.status?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'apps', label: 'Applications', icon: Layers },
            { id: 'branches', label: `Branches (${branches.length})`, icon: Store },
            { id: 'members', label: `Team (${members.length})`, icon: Users },
            { id: 'billing', label: 'Billing & Entitlements', icon: CreditCard },
            { id: 'onboarding', label: 'Onboarding Flow', icon: CheckCircle2 },
            { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: FileText },
            { id: 'notes', label: `Support Notes (${supportNotes.length})`, icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-[#714b67] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#e6a8d6]" />
            <p className="text-xs">Loading tenant inspection details...</p>
          </div>
        ) : (
          <>
            {/* 1. Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <div className="text-[11px] text-slate-400">Plan & Trial</div>
                  <div className="text-sm font-bold text-white capitalize">{planKey.replace('_', ' ')}</div>
                  <div className="text-[11px] text-slate-400">
                    Branch Limit: {planKey === 'premium' ? '10' : planKey === 'standard' ? '3' : '1'} Nigerian store location
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <div className="text-[11px] text-slate-400">Nigerian Branches</div>
                  <div className="text-sm font-bold text-white">{branches.length} Registered</div>
                  <div className="text-[11px] text-slate-400">
                    Primary:{' '}
                    <span className="text-amber-300">
                      {branches.find((b) => b.isPrimary)?.name || 'MAIN'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <div className="text-[11px] text-slate-400">Team Size</div>
                  <div className="text-sm font-bold text-white">{members.length} Active Members</div>
                  <div className="text-[11px] text-slate-400">{invitations.length} Pending Invites</div>
                </div>
              </div>
            )}

            {/* 2. Applications Tab */}
            {activeTab === 'apps' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        Inventory & POS (Flagship MVP)
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active & Activated
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Multi-branch Nigerian retail setup, stock tracking, and sales demo.
                      </p>
                    </div>
                  </div>
                </div>

                {['POS Terminal', 'Booking & Appointments', 'Gym Management', 'Task Management'].map((appName) => (
                  <div key={appName} className="p-4 rounded-xl border border-white/5 bg-black/20 flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-white/5 text-slate-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          {appName}
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400">
                            Coming Soon (Disabled)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Future application module, strictly hidden and non-activatable.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Branches Tab */}
            {activeTab === 'branches' && (
              <div className="space-y-3">
                {branches.map((b) => (
                  <div key={b.id || b._id} className="p-4 rounded-xl border border-white/10 bg-black/40 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {b.name}
                        {b.isPrimary && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-300" />
                            Primary
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {b.code || 'MAIN'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {b.street || b.address || 'Standard Location'}, {b.lga || 'Ikeja'}, {b.state || 'Lagos'}, Nigeria
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {b.status || 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id || m.userId} className="p-3.5 rounded-xl border border-white/10 bg-black/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center text-xs font-bold text-[#e6a8d6]">
                        {(m.name || m.email || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{m.name}</div>
                        <div className="text-[11px] text-slate-400">{m.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-slate-300">
                      {m.role?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 5. Billing & Entitlements Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Subscription & Plan</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Current: <span className="text-amber-300 capitalize">{planKey.replace('_', ' ')}</span> · Branches Allowed:{' '}
                      <span className="text-white font-bold">{planKey === 'premium' ? 10 : planKey === 'standard' ? 3 : 1}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActionModal({ type: 'extend_trial' })}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold"
                  >
                    Extend Free Trial
                  </Button>
                </div>
              </div>
            )}

            {/* 6. Onboarding Tab */}
            {activeTab === 'onboarding' && (
              <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
                <h3 className="text-xs font-bold text-white">Onboarding Checklist</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Organization Workspace Created
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Nigerian Primary Branch Provisioned (MAIN)
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> 30-Day Free Trial Activated
                  </div>
                </div>
              </div>
            )}

            {/* 7. Audit Trail Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-2">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No audit events recorded.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id || log._id} className="p-3 rounded-lg border border-white/10 bg-black/40 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-purple-300">
                          {log.eventType || log.action}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Actor: {log.actor?.name || log.actorId || 'System'}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(log.timestamp || log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 8. Support Notes Tab */}
            {activeTab === 'notes' && (
              <SupportNotesList notes={supportNotes} onAddNote={handleAddSupportNote} />
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {actionModal && (
        <AdminActionModal
          isOpen={true}
          onClose={() => setActionModal(null)}
          onConfirm={handleActionConfirm}
          title={
            actionModal.type === 'suspend'
              ? 'Suspend Organization'
              : actionModal.type === 'restore'
              ? 'Restore Organization'
              : actionModal.type === 'archive'
              ? 'Archive Organization'
              : actionModal.type === 'extend_trial'
              ? 'Extend Free Trial'
              : 'Revoke Active Sessions'
          }
          description={
            actionModal.type === 'extend_trial'
              ? 'Grant additional trial duration to this organization.'
              : 'Perform administrative governance action on this tenant.'
          }
          targetName={`${org?.name} (${org?.id})`}
          sensitivity={actionModal.type === 'archive' ? 'high_risk' : 'sensitive'}
          confirmLabel="Confirm Action"
          isDangerous={actionModal.type === 'suspend' || actionModal.type === 'archive'}
        />
      )}
    </div>
  );
};
export default AdminOrganizationDetailPage;
