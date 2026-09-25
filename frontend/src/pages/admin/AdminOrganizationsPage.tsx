import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { AdminActionModal } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Building2,
  Search,
  Filter,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MoreVertical,
  ExternalLink,
  PowerOff,
  RefreshCw,
  Archive,
  Layers,
  Store,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Activity,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface OrganizationRow {
  id: string;
  name: string;
  slug?: string;
  ownerEmail?: string;
  status: 'active' | 'suspended' | 'archived';
  planKey: string;
  subscriptionStatus?: string;
  branchCount: number;
  memberCount: number;
  trialEndsAt?: number;
  createdAt: number;
  inventorySetupComplete?: boolean;
}

export const AdminOrganizationsPage: React.FC = () => {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'organizations' | 'challenges'>('organizations');

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Phone Challenges State
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeStats, setChallengeStats] = useState<any>(null);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [challengeSearch, setChallengeSearch] = useState('');
  const [challengeStatusFilter, setChallengeStatusFilter] = useState('all');
  const [challengePurposeFilter, setChallengePurposeFilter] = useState('all');
  const [challengePage, setChallengePage] = useState(1);
  const [challengeTotalPages, setChallengeTotalPages] = useState(1);
  const [challengeTotalCount, setChallengeTotalCount] = useState(0);

  // Modal State
  const [actionModal, setActionModal] = useState<{
    type: 'suspend' | 'restore' | 'archive';
    org: OrganizationRow;
  } | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter) params.set('statusFilter', statusFilter);
      if (planFilter) params.set('planFilter', planFilter);
      params.set('page', page.toString());
      params.set('pageSize', '15');

      const res = await api.get<{
        data: {
          items?: any[];
          organizations?: any[];
          total?: number;
          totalPages?: number;
        };
      }>(`/admin/organizations?${params.toString()}`);

      const rawItems = res.data?.items || res.data?.organizations || [];
      const mapped: OrganizationRow[] = rawItems.map((o: any) => ({
        id: o.id || o._id,
        name: o.name || 'Untitled Organization',
        slug: o.slug,
        ownerEmail: o.ownerEmail || o.owner?.email || o.email || '—',
        status: o.status || 'active',
        planKey: o.planKey || o.planId || 'free_trial',
        subscriptionStatus: o.subscriptionStatus || (o.planKey === 'free_trial' ? 'trialing' : 'active'),
        branchCount: o.branchCount || o.branches?.length || 1,
        memberCount: o.memberCount || o.members?.length || 1,
        trialEndsAt: o.trialEndsAt,
        createdAt: o.createdAt || Date.now(),
        inventorySetupComplete: o.inventorySetupComplete ?? true,
      }));

      setOrganizations(mapped);
      setTotalCount(res.data?.total || mapped.length);
      setTotalPages(res.data?.totalPages || Math.ceil((res.data?.total || mapped.length) / 15) || 1);
    } catch (err: any) {
      toast.error('Failed to load organizations directory: ' + (err.message || 'Unauthorized'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, planFilter, page]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const fetchChallenges = useCallback(async () => {
    setLoadingChallenges(true);
    try {
      const params = new URLSearchParams();
      if (challengeSearch.trim()) params.set('search', challengeSearch.trim());
      if (challengeStatusFilter && challengeStatusFilter !== 'all') params.set('statusFilter', challengeStatusFilter);
      if (challengePurposeFilter && challengePurposeFilter !== 'all') params.set('purposeFilter', challengePurposeFilter);
      params.set('page', challengePage.toString());
      params.set('pageSize', '20');

      const res = await api.get<{
        data: {
          challenges?: any[];
          stats?: any;
          pagination?: any;
        };
      }>(`/admin/phone-challenges?${params.toString()}`);

      setChallenges(res.data?.challenges || []);
      setChallengeStats(res.data?.stats || null);
      setChallengeTotalCount(res.data?.pagination?.total || 0);
      setChallengeTotalPages(res.data?.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error('Failed to load phone challenges: ' + (err.message || 'Error'));
    } finally {
      setLoadingChallenges(false);
    }
  }, [challengeSearch, challengeStatusFilter, challengePurposeFilter, challengePage]);

  useEffect(() => {
    if (viewMode === 'challenges') {
      fetchChallenges();
    }
  }, [viewMode, fetchChallenges]);

  const handleActionConfirm = async (data: { reason: string; totpCode?: string }) => {
    if (!actionModal) return;
    const { type, org } = actionModal;

    try {
      if (type === 'suspend') {
        await api.post(`/admin/organizations/${org.id}/suspend`, {
          reason: data.reason,
        });
        toast.success(`Organization "${org.name}" suspended successfully.`);
      } else if (type === 'restore') {
        await api.post(`/admin/organizations/${org.id}/restore`, {
          reason: data.reason,
        });
        toast.success(`Organization "${org.name}" restored successfully.`);
      } else if (type === 'archive') {
        await api.post(`/admin/organizations/${org.id}/archive`, {
          reason: data.reason,
          totpCode: data.totpCode,
        });
        toast.success(`Organization "${org.name}" archived.`);
      }
      fetchOrganizations();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${type} organization.`);
      throw err;
    }
  };

  const formatPlanBadge = (planKey: string) => {
    switch (planKey.toLowerCase()) {
      case 'premium':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Premium (10 Branches)
          </span>
        );
      case 'standard':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Standard (3 Branches)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            30-Day Free Trial (1 Branch)
          </span>
        );
    }
  };

  const formatStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Active
          </span>
        );
      case 'suspended':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <PowerOff className="w-3 h-3 text-rose-400" />
            Suspended
          </span>
        );
      case 'archived':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30 flex items-center gap-1">
            <Archive className="w-3 h-3 text-slate-400" />
            Archived
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#714b67]/30 border border-[#714b67]/50 text-[#e6a8d6]">
              {viewMode === 'organizations' ? <Building2 className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {viewMode === 'organizations' ? 'Organization Directory' : 'Phone Verification Challenges & Deliverability'}
              </h1>
              <p className="text-xs text-slate-400">
                {viewMode === 'organizations'
                  ? 'Global tenant administration, status inspection, and governance controls.'
                  : 'Real-time phone verification attempts, deliverability metrics, and provider stats.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 rounded-lg bg-black/40 border border-white/10 text-xs">
              <button
                onClick={() => setViewMode('organizations')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  viewMode === 'organizations'
                    ? 'bg-[#714b67] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Organizations
              </button>
              <button
                onClick={() => setViewMode('challenges')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  viewMode === 'challenges'
                    ? 'bg-[#714b67] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Phone Challenges
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={viewMode === 'organizations' ? fetchOrganizations : fetchChallenges}
              className="border-white/10 text-xs hover:bg-white/5 cursor-pointer h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${(viewMode === 'organizations' ? loading : loadingChallenges) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Organizations View */}
        {viewMode === 'organizations' && (
          <>
            {/* Filter Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white/[0.02] border border-white/10 p-4 rounded-xl items-center">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by organization name, ID, or owner email..."
                  className="pl-9 bg-black/40 border-white/10 text-xs h-9"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 rounded-md bg-black/40 border border-white/10 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714b67]"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={planFilter}
                  onChange={(e) => {
                    setPlanFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 rounded-md bg-black/40 border border-white/10 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714b67]"
                >
                  <option value="">All Plans</option>
                  <option value="free_trial">30-Day Free Trial</option>
                  <option value="standard">Standard Plan</option>
                  <option value="premium">Premium Plan</option>
                </select>
              </div>
            </div>

            {/* Organizations Table */}
            <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Organization / ID</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Plan & Branches</th>
                      <th className="py-3 px-4">Members</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#e6a8d6] mb-2" />
                          Loading organizations...
                        </td>
                      </tr>
                    ) : organizations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          No organizations matching current filters.
                        </td>
                      </tr>
                    ) : (
                      organizations.map((org) => (
                        <tr
                          key={org.id}
                          className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                        >
                          <td className="py-3.5 px-4 font-medium text-white">
                            <div className="font-bold flex items-center gap-2">
                              {org.name}
                              {org.slug && (
                                <span className="text-[10px] font-mono text-slate-400 font-normal">
                                  ({org.slug})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              ID: {org.id}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            {org.ownerEmail}
                          </td>
                          <td className="py-3.5 px-4">
                            {formatStatusBadge(org.status)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {formatPlanBadge(org.planKey)}
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Store className="w-3 h-3 text-slate-500" />
                                {org.branchCount} Branch Location{org.branchCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              {org.memberCount}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {new Date(org.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/admin/organizations/${org.id}`)}
                                className="h-7 text-[10px] border-white/10 hover:bg-white/10 px-2 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Inspect
                              </Button>

                              {org.status === 'active' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionModal({ type: 'suspend', org });
                                  }}
                                  className="h-7 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 cursor-pointer"
                                >
                                  <PowerOff className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionModal({ type: 'restore', org });
                                  }}
                                  className="h-7 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2 cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.01]">
                <div className="text-xs text-slate-400">
                  Showing {organizations.length} of {totalCount} total organizations
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 border-white/10 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs text-slate-400 px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 border-white/10 text-xs"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Phone Challenges Dashboard View */}
        {viewMode === 'challenges' && (
          <div className="space-y-6">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                <div className="text-[11px] text-slate-400">24h Total Challenges</div>
                <div className="text-xl font-bold text-white">{challengeStats?.totalChallenges24h ?? 0}</div>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                <div className="text-[11px] text-slate-400">Success Rate</div>
                <div className="text-xl font-bold text-emerald-400">{challengeStats?.successRatePercent ?? 100}%</div>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                <div className="text-[11px] text-slate-400">24h Verified</div>
                <div className="text-xl font-bold text-emerald-400">{challengeStats?.verifiedCount24h ?? 0}</div>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1">
                <div className="text-[11px] text-slate-400">24h Expired / Failed</div>
                <div className="text-xl font-bold text-rose-400">{challengeStats?.expiredCount24h ?? 0}</div>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-1 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-400">Active Pending</div>
                <div className="text-xl font-bold text-amber-400">{challengeStats?.activePendingCount ?? 0}</div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white/[0.02] border border-white/10 p-4 rounded-xl items-center">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={challengeSearch}
                  onChange={(e) => {
                    setChallengeSearch(e.target.value);
                    setChallengePage(1);
                  }}
                  placeholder="Search by phone, purpose, or user ID..."
                  className="pl-9 bg-black/40 border-white/10 text-xs h-9"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={challengeStatusFilter}
                  onChange={(e) => {
                    setChallengeStatusFilter(e.target.value);
                    setChallengePage(1);
                  }}
                  className="w-full h-9 rounded-md bg-black/40 border border-white/10 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714b67]"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="expired">Expired</option>
                  <option value="max_attempts_exceeded">Max Attempts Exceeded</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={challengePurposeFilter}
                  onChange={(e) => {
                    setChallengePurposeFilter(e.target.value);
                    setChallengePage(1);
                  }}
                  className="w-full h-9 rounded-md bg-black/40 border border-white/10 px-3 text-xs text-slate-200 focus:outline-none focus:border-[#714b67]"
                >
                  <option value="all">All Purposes</option>
                  <option value="user_phone_verification">Personal Phone</option>
                  <option value="workspace_business_phone_verification">Workspace Phone</option>
                  <option value="branch_phone_verification">Branch Phone</option>
                </select>
              </div>
            </div>

            {/* Challenges Table */}
            <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Target Phone</th>
                      <th className="py-3 px-4">Purpose</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Attempts / Max</th>
                      <th className="py-3 px-4">Resends</th>
                      <th className="py-3 px-4">Expires / Verified</th>
                      <th className="py-3 px-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingChallenges ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#e6a8d6] mb-2" />
                          Loading verification challenges...
                        </td>
                      </tr>
                    ) : challenges.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          No verification challenges matching criteria.
                        </td>
                      </tr>
                    ) : (
                      challenges.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            {c.maskedPhone || c.phoneNormalized || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300">
                              {c.purpose.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {c.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                                Verified
                              </span>
                            ) : c.status === 'pending' && !c.isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Active Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                {c.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {c.attempts} / {c.maxAttempts}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">
                            {c.resendCount}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {c.verifiedAt
                              ? new Date(c.verifiedAt).toLocaleTimeString()
                              : new Date(c.expiresAt).toLocaleTimeString()}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {new Date(c.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Challenge Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.01]">
                <div className="text-xs text-slate-400">
                  Showing {challenges.length} of {challengeTotalCount} total challenges
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={challengePage <= 1}
                    onClick={() => setChallengePage((p) => Math.max(1, p - 1))}
                    className="h-7 border-white/10 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs text-slate-400 px-2">
                    Page {challengePage} of {challengeTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={challengePage >= challengeTotalPages}
                    onClick={() => setChallengePage((p) => p + 1)}
                    className="h-7 border-white/10 text-xs"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
              : 'Archive Organization'
          }
          description={
            actionModal.type === 'suspend'
              ? 'Temporarily block member access and transaction processing for this tenant.'
              : actionModal.type === 'restore'
              ? 'Re-enable operational access and restore active status for this tenant.'
              : 'Archive this organization while preserving historical ledger records.'
          }
          targetName={`${actionModal.org.name} (${actionModal.org.id})`}
          sensitivity={actionModal.type === 'archive' ? 'high_risk' : 'sensitive'}
          confirmLabel={
            actionModal.type === 'suspend'
              ? 'Confirm Suspension'
              : actionModal.type === 'restore'
              ? 'Confirm Restore'
              : 'Archive Tenant'
          }
          isDangerous={actionModal.type !== 'restore'}
        />
      )}
    </div>
  );
};
export default AdminOrganizationsPage;
