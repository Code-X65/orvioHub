import React, { useState } from 'react';

export interface OverrideItem {
  id: string;
  _id?: string;
  workspaceId: string;
  featureKey?: string;
  productKey?: string;
  overrideType: string;
  limitType?: string;
  limitValue?: number;
  grantedPlanKey?: string;
  grantType?: string;
  reason: string;
  customerVisibleReason?: string;
  supportTicketReference?: string;
  status: 'draft' | 'pending_approval' | 'active' | 'expired' | 'revoked' | 'rejected';
  createdByAdminId: string;
  approvedByAdminId?: string;
  effectiveFrom: number;
  expiresAt?: number;
  reviewAt?: number;
  createdAt: number;
}

export interface OverrideListProps {
  overrides: OverrideItem[];
  currentAdminId: string;
  onApprove?: (override: OverrideItem) => void;
  onReject?: (override: OverrideItem) => void;
  onRevoke?: (override: OverrideItem) => void;
  onCreateNew?: () => void;
  loading?: boolean;
}

export const OverrideList: React.FC<OverrideListProps> = ({
  overrides,
  currentAdminId,
  onApprove,
  onReject,
  onRevoke,
  onCreateNew,
  loading = false,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = overrides.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFeature = item.featureKey?.toLowerCase().includes(q);
      const matchType = item.overrideType.toLowerCase().includes(q);
      const matchReason = item.reason.toLowerCase().includes(q);
      const matchTicket = item.supportTicketReference?.toLowerCase().includes(q);
      const matchPlan = item.grantedPlanKey?.toLowerCase().includes(q);
      return matchFeature || matchType || matchReason || matchTicket || matchPlan;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">Active</span>;
      case 'pending_approval':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">Pending Approval</span>;
      case 'expired':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">Expired</span>;
      case 'revoked':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">Revoked</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-300 dark:border-purple-800">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{status}</span>;
    }
  };

  const getRiskBadge = (override: OverrideItem) => {
    const isHigh =
      override.overrideType === 'manual_plan_grant' ||
      override.overrideType === 'billing_state_correction' ||
      override.limitType === 'unlimited' ||
      override.grantedPlanKey === 'premium';

    if (isHigh) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
          High Risk
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
        Standard
      </span>
    );
  };

  const formatTarget = (item: OverrideItem) => {
    if (item.overrideType === 'manual_plan_grant') {
      return <span className="font-semibold text-indigo-600 dark:text-indigo-400">Plan: {item.grantedPlanKey?.toUpperCase()}</span>;
    }
    if (item.overrideType === 'trial_extension') {
      return <span className="font-semibold text-amber-600 dark:text-amber-400">Trial Extension</span>;
    }
    return (
      <div>
        <span className="font-medium text-slate-900 dark:text-slate-100">{item.featureKey || 'General'}</span>
        {item.limitType && (
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
            ({item.limitType === 'unlimited' ? 'Unlimited' : item.limitValue})
          </span>
        )}
      </div>
    );
  };

  const formatExpires = (timestamp?: number) => {
    if (!timestamp) return <span className="text-slate-400 dark:text-slate-500 italic">Permanent / Indefinite</span>;
    const date = new Date(timestamp);
    const isPast = timestamp < Date.now();
    return (
      <span className={isPast ? 'text-rose-500 font-medium' : 'text-slate-600 dark:text-slate-300'}>
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Custom Overrides & Support Exceptions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Explicitly recorded governance exceptions with dual-admin separation and automatic expiry.
          </p>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            + New Override
          </button>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'active', 'pending_approval', 'expired', 'revoked', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search overrides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">Type & Target</th>
              <th className="px-4 py-3">Risk Level</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reason & Ticket</th>
              <th className="px-4 py-3">Expires / Review</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading overrides...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                  No overrides found matching the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isCreator = String(item.createdByAdminId) === String(currentAdminId);
                const canApprove = item.status === 'pending_approval' && !isCreator;

                return (
                  <tr key={item.id || item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                        {item.overrideType.replace(/_/g, ' ')}
                      </div>
                      <div className="mt-0.5">{formatTarget(item)}</div>
                    </td>
                    <td className="px-4 py-3.5">{getRiskBadge(item)}</td>
                    <td className="px-4 py-3.5">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="text-xs text-slate-800 dark:text-slate-200 truncate" title={item.reason}>
                        {item.reason}
                      </p>
                      {item.supportTicketReference && (
                        <span className="inline-block mt-0.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                          Ticket: {item.supportTicketReference}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs">{formatExpires(item.expiresAt)}</td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {item.status === 'pending_approval' && (
                        <>
                          <button
                            onClick={() => onApprove && onApprove(item)}
                            disabled={isCreator}
                            title={isCreator ? 'Dual-admin requirement: You cannot approve an override you requested' : 'Approve override'}
                            className={`px-2.5 py-1 text-xs font-medium rounded ${
                              isCreator
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onReject && onReject(item)}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {item.status === 'active' && onRevoke && (
                        <button
                          onClick={() => onRevoke(item)}
                          className="px-2.5 py-1 text-xs font-medium rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
