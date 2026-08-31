import React, { useEffect, useState } from "react";
import {
  Mail,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  CalendarPlus,
  CheckCheck,
  Ban,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminInvitationsApi } from "../api/adminInvitations";
import SearchBar from "../components/SearchBar";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import StatCard from "../components/StatCard";

export const Invitations: React.FC = () => {
  const { sessionToken } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
  });

  const loadData = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const [listRes, statsRes]: any = await Promise.all([
        adminInvitationsApi.listInvitations({
          sessionToken,
          search,
          statusFilter,
          page,
          pageSize: 10,
        }),
        adminInvitationsApi.getInvitationStats(sessionToken).catch(() => null),
      ]);
      setInvitations(listRes?.items || []);
      setTotalCount(listRes?.totalCount || 0);
      setTotalPages(listRes?.totalPages || 1);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to load invitations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken, page, search, statusFilter]);

  const handleResend = (inv: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Resend Invitation",
      message: `Resend workspace invitation email to ${inv.email} and extend expiration by 7 days?`,
      confirmLabel: "Resend Email",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminInvitationsApi.resendInvitation(sessionToken!, inv.id);
          await loadData();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRevoke = (inv: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Revoke Invitation",
      message: `Revoke the pending invitation for ${inv.email}? The invite link will become invalid.`,
      confirmLabel: "Revoke Invite",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminInvitationsApi.revokeInvitation(sessionToken!, inv.id);
          await loadData();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleExtend = (inv: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Extend Expiration",
      message: `Extend expiration for ${inv.email} by an additional 7 days?`,
      confirmLabel: "Extend 7 Days",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminInvitationsApi.extendInvitationExpiry(sessionToken!, inv.id, 7);
          await loadData();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleManualAccept = (inv: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Manually Accept Invitation",
      message: `Force accept invitation for ${inv.email} and add them to "${inv.organizationName}" as ${inv.role}?`,
      confirmLabel: "Accept on Behalf",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminInvitationsApi.acceptInvitationManually(sessionToken!, inv.id);
          await loadData();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Workspace Invitations</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitor, resend, extend expiry, and govern team member onboarding invitations.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Dispatched"
            value={stats.total || 0}
            subtext="Lifetime invitation invites"
            icon={Send}
            variant="brand"
          />
          <StatCard
            label="Acceptance Rate"
            value={`${stats.acceptanceRate || 0}%`}
            subtext={`${stats.byStatus?.accepted || 0} accepted`}
            icon={CheckCircle}
            variant="emerald"
          />
          <StatCard
            label="Pending Invites"
            value={stats.byStatus?.pending || 0}
            subtext="Awaiting user action"
            icon={Clock}
            variant="amber"
          />
          <StatCard
            label="Expired / Revoked"
            value={(stats.byStatus?.expired || 0) + (stats.byStatus?.revoked || 0)}
            subtext={`${stats.byStatus?.expired || 0} expired • ${stats.byStatus?.revoked || 0} revoked`}
            icon={XCircle}
            variant="rose"
          />
        </div>
      )}

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by invitee email..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
        >
          <option value="all">All Invitation Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="EXPIRED">Expired</option>
          <option value="REVOKED">Revoked</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">Invitee Email</th>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Expires</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading invitations...
                  </td>
                </tr>
              ) : invitations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    No invitations found.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{inv.email}</p>
                          <p className="text-[11px] text-slate-500">
                            Sent by: {inv.inviterName}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-semibold text-slate-200">
                      {inv.organizationName}
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-bold text-[10px] border border-indigo-500/20">
                        {inv.role}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <StatusBadge status={inv.status} size="sm" />
                    </td>

                    <td className="py-4 px-4 text-[11px] text-slate-400">
                      {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : "—"}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status !== "ACCEPTED" && (
                          <>
                            <button
                              title="Resend invitation"
                              onClick={() => handleResend(inv)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-brand-400 hover:bg-brand-500/10 hover:border-brand-500/30 transition"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>

                            <button
                              title="Extend expiration by 7 days"
                              onClick={() => handleExtend(inv)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              title="Manually accept on behalf of user"
                              onClick={() => handleManualAccept(inv)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>

                            <button
                              title="Revoke invitation"
                              onClick={() => handleRevoke(inv)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={10}
          onPageChange={setPage}
        />
      </div>

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmLabel={dialogConfig.confirmLabel}
        isDestructive={dialogConfig.isDestructive}
        isLoading={actionLoading}
        onConfirm={dialogConfig.action}
        onCancel={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Invitations;
