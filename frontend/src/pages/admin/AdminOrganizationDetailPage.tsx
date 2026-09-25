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
  Phone,
  ShieldCheck,
  PhoneOff,
  Check,
} from 'lucide-react';

export const AdminOrganizationDetailPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'apps' | 'branches' | 'members' | 'phone' | 'billing' | 'onboarding' | 'audit' | 'notes'
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

  // Phone override modal state
  const [phoneOverrideModal, setPhoneOverrideModal] = useState<{
    type: 'mark_verified' | 'unlink';
    user: { id: string; name: string; phone?: string };
  } | null>(null);
  const [phoneReason, setPhoneReason] = useState('');
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);

  // Modals
  const [actionModal, setActionModal] = useState<{
    type: 'suspend' | 'restore' | 'archive' | 'extend_trial' | 'revoke_sessions';
    targetName?: string;
  } | null>(null);

  const [trialDaysToAdd, setTrialDaysToAdd] = useState(14);
  const [platformApps, setPlatformApps] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [
        orgRes,
        platformAppsRes,
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
        api.get<any>('/platform/applications').catch(() => null),
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
      const regApps =
        platformAppsRes?.data?.applications ||
        platformAppsRes?.applications ||
        platformAppsRes?.data ||
        [
          { key: 'inventory', name: 'Inventory & POS', status: 'active', isCore: true, description: 'Multi-branch Nigerian retail setup, stock tracking, and sales demo.' },
          { key: 'pos', name: 'POS Terminal', status: 'coming_soon', isCore: false, description: 'Point-of-sale terminal with receipts, cash management, and shift reports.' },
          { key: 'booking', name: 'Booking & Appointments', status: 'coming_soon', isCore: false, description: 'Appointment and reservation management with automated reminders.' },
          { key: 'gym', name: 'Gym Management', status: 'coming_soon', isCore: false, description: 'Membership management, class scheduling, and trainer assignment.' },
          { key: 'taskmanagement', name: 'Task Management', status: 'coming_soon', isCore: false, description: 'Team task tracking, assignments, and workflow board.' },
        ];
      setPlatformApps(regApps);
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

  const handlePhoneOverrideSubmit = async () => {
    if (!phoneOverrideModal || !phoneReason.trim()) {
      toast.error('Please provide an administrative reason for this action.');
      return;
    }
    setIsPhoneSubmitting(true);
    try {
      if (phoneOverrideModal.type === 'mark_verified') {
        await api.post(`/admin/users/${phoneOverrideModal.user.id}/phone/mark-verified`, {
          reason: phoneReason.trim(),
        });
        toast.success(`User phone marked as verified.`);
      } else {
        await api.post(`/admin/users/${phoneOverrideModal.user.id}/phone/unlink`, {
          reason: phoneReason.trim(),
        });
        toast.success(`User phone unlinked successfully.`);
      }
      setPhoneOverrideModal(null);
      setPhoneReason('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setIsPhoneSubmitting(false);
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
              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Owner: <span className="text-slate-200">{org?.ownerEmail || '—'}</span></span>
                <span>·</span>
                <span>Phone: <span className="text-slate-200">{org?.phone || '—'}</span></span>
                {org?.phone && (
                  org?.phoneVerified || org?.phoneVerifiedAt || org?.phoneStatus === 'verified' ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Unverified
                    </span>
                  )
                )}
                <span>·</span>
                <span>Country: <span className="text-slate-200">{org?.country || 'Nigeria'}</span></span>
                <span>·</span>
                <span>Timezone: <span className="text-slate-200">{org?.timezone || 'Africa/Lagos'}</span></span>
              </div>
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
            { id: 'phone', label: 'Phone Governance', icon: Phone },
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
                {platformApps.map((regApp) => {
                  const activated = apps.find(
                    (a) => (a.key || a.productKey || a.applicationKey || '').toLowerCase() === regApp.key.toLowerCase()
                  );
                  const isLiveActive = regApp.status === 'active' || (activated && activated.status !== 'inactive');

                  return (
                    <div
                      key={regApp.key}
                      className={`p-4 rounded-xl border flex items-center justify-between transition ${
                        isLiveActive
                          ? 'border-indigo-500/30 bg-indigo-500/5'
                          : 'border-white/5 bg-black/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-lg ${
                            isLiveActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {isLiveActive ? <Layers className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            {regApp.name}
                            {isLiveActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {regApp.isCore ? 'Active & Core' : 'Active & Activated'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400">
                                {regApp.status === 'coming_soon' ? 'Coming Soon (Disabled)' : regApp.status}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {regApp.description || `${regApp.name} application module.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Phone: <span className="text-slate-200">{b.phone || '—'}</span></span>
                        {b.phone && (
                          b.phoneVerified || b.phoneVerifiedAt || b.phoneStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Unverified
                            </span>
                          )
                        )}
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

            {/* Phone Governance Tab */}
            {activeTab === 'phone' && (
              <div className="space-y-6">
                {/* 1. Organization Contact Phone */}
                <div className="p-5 rounded-xl border border-white/10 bg-black/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#e6a8d6]" />
                        Official Organization Business Phone
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Primary registered contact for billing, regulatory notifications, and corporate administration.
                      </p>
                    </div>
                    {org?.phone ? (
                      org?.phoneVerified || org?.phoneVerifiedAt || org?.phoneStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Unverified
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-500 italic">Not set</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Phone Number</span>
                      <span className="font-mono text-white font-medium">{org?.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Normalized Format</span>
                      <span className="font-mono text-slate-300">{org?.phoneNormalized || org?.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Branch Contact Phones */}
                <div className="p-5 rounded-xl border border-white/10 bg-black/40 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-400" />
                      Branch Contact Phones ({branches.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Physical retail & warehouse branch locations and their operational contact phone numbers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branches.map((b) => (
                      <div key={b.id || b._id} className="p-3.5 rounded-lg border border-white/5 bg-white/[0.02] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{b.name}</span>
                            {b.isPrimary && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Primary
                              </span>
                            )}
                          </div>
                          {b.phone ? (
                            b.phoneVerified || b.phoneVerifiedAt || b.phoneStatus === 'verified' ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <ShieldCheck className="w-3 h-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Unverified
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">No phone</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {b.phone || 'No phone attached'}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {b.city || 'Lagos'}, {b.state || 'Nigeria'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Team Member Phones & Administrative Overrides */}
                <div className="p-5 rounded-xl border border-white/10 bg-black/40 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Team Members & Administrative Overrides ({members.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      View personal phone statuses, manually mark verified for confirmed identities, or unlink compromised numbers.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {members.map((m) => {
                      const isVerified = m.phoneVerified || m.phoneStatus === 'verified';
                      const hasPhone = !!m.phone;
                      return (
                        <div key={m.id || m.userId} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center text-xs font-bold text-[#e6a8d6]">
                              {(m.name || m.email || 'M').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                {m.name}
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                                  {m.role?.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                <span>{m.email}</span>
                                <span>·</span>
                                <span className="text-slate-300 font-semibold">{m.phone || 'No phone'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {hasPhone ? (
                              isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <ShieldCheck className="w-3 h-3" />
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Unverified
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">No phone attached</span>
                            )}

                            {hasPhone && !isVerified && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPhoneOverrideModal({ type: 'mark_verified', user: m })}
                                className="h-7 text-[10px] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 px-2 cursor-pointer"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Mark Verified
                              </Button>
                            )}

                            {hasPhone && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPhoneOverrideModal({ type: 'unlink', user: m })}
                                className="h-7 text-[10px] border-rose-500/30 text-rose-300 hover:bg-rose-500/10 px-2 cursor-pointer"
                              >
                                <PhoneOff className="w-3 h-3 mr-1" />
                                Unlink Phone
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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

      {/* Phone Override Reason Modal */}
      {phoneOverrideModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {phoneOverrideModal.type === 'mark_verified' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Mark User Phone as Verified
                  </>
                ) : (
                  <>
                    <PhoneOff className="w-4 h-4 text-rose-400" />
                    Administratively Unlink User Phone
                  </>
                )}
              </h3>
              <button
                onClick={() => { setPhoneOverrideModal(null); setPhoneReason(''); }}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                Target User: <strong className="text-white">{phoneOverrideModal.user.name}</strong> ({phoneOverrideModal.user.phone || 'No phone'})
              </p>
              <p className="text-slate-400 text-[11px]">
                {phoneOverrideModal.type === 'mark_verified'
                  ? 'This overrides the OTP challenge requirement and marks this phone number as verified in the database with an administrative audit log.'
                  : 'This removes the phone number link, clears verification timestamps, and requires the user to link and verify a new phone number.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-semibold">
                Reason for Override <span className="text-rose-400">*</span>
              </Label>
              <Input
                placeholder="e.g. Identity verified via customer support call with owner"
                value={phoneReason}
                onChange={(e) => setPhoneReason(e.target.value)}
                className="bg-black/50 border-white/10 text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setPhoneOverrideModal(null); setPhoneReason(''); }}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
                disabled={isPhoneSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePhoneOverrideSubmit}
                disabled={isPhoneSubmitting || !phoneReason.trim()}
                className={`text-xs font-semibold cursor-pointer ${
                  phoneOverrideModal.type === 'mark_verified'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {isPhoneSubmitting ? 'Processing...' : phoneOverrideModal.type === 'mark_verified' ? 'Confirm Verification' : 'Confirm Unlink'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminOrganizationDetailPage;
