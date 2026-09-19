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

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#714b67]/30 border border-[#714b67]/50 text-[#e6a8d6]">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Organization Directory</h1>
                <p className="text-xs text-slate-400">
                  Global tenant administration, status inspection, and governance controls.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrganizations}
              className="border-white/10 text-xs hover:bg-white/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

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
                    <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {org.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
                          {org.id}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        {org.ownerEmail}
                      </td>

                      <td className="py-3 px-4">
                        {formatStatusBadge(org.status)}
                      </td>

                      <td className="py-3 px-4 space-y-1">
                        <div>{formatPlanBadge(org.planKey)}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Store className="w-3 h-3 text-slate-500" />
                          {org.branchCount} Nigerian branch{org.branchCount === 1 ? '' : 'es'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300 flex items-center gap-1 pt-4">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {org.memberCount}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/organizations/${org.id}`)}
                            className="h-7 text-[11px] border-white/10 hover:bg-white/10 px-2.5"
                          >
                            Inspect
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>

                          {org.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActionModal({ type: 'suspend', org })}
                              className="h-7 text-[11px] text-rose-400 hover:bg-rose-500/10 px-2"
                              title="Suspend Organization"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActionModal({ type: 'restore', org })}
                              className="h-7 text-[11px] text-emerald-400 hover:bg-emerald-500/10 px-2"
                              title="Restore Organization"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
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
