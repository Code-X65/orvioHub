import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users as UsersIcon,
  CheckCircle2,
  XCircle,
  Ban,
  Shield,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  MailCheck,
  LogOut,
  Building,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminUsersApi } from "../api/adminUsers";
import SearchBar from "../components/SearchBar";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";

export const Users: React.FC = () => {
  const { sessionToken } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog State
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

  const loadUsers = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const res: any = await adminUsersApi.listUsers({
        sessionToken,
        search,
        verifiedFilter,
        statusFilter,
        page,
        pageSize: 10,
      });
      setUsers(res?.items || []);
      setTotalCount(res?.totalCount || 0);
      setTotalPages(res?.totalPages || 1);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [sessionToken, page, search, verifiedFilter, statusFilter]);

  const handleSuspend = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Suspend User Account",
      message: `Are you sure you want to suspend ${user.email}? This will immediately revoke all active sessions and block access.`,
      confirmLabel: "Suspend User",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.suspendUser(sessionToken!, user.id, "Admin suspension");
          await loadUsers();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleActivate = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Reactivate User Account",
      message: `Activate ${user.email} and allow them to log in to the platform?`,
      confirmLabel: "Activate User",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.activateUser(sessionToken!, user.id);
          await loadUsers();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleVerifyEmail = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Manually Verify Email",
      message: `Mark ${user.email} as email verified without requiring an OTP confirmation code?`,
      confirmLabel: "Verify Email",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.verifyUserEmail(sessionToken!, user.id);
          await loadUsers();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRevokeSessions = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Revoke Active Sessions",
      message: `Force sign-out for ${user.email} across all browsers and devices?`,
      confirmLabel: "Revoke Sessions",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.revokeUserSessions(sessionToken!, user.id);
          await loadUsers();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDelete = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Delete User Account",
      message: `Permanently delete ${user.email}? This will erase all user profile data, memberships, and sessions. This action cannot be undone.`,
      confirmLabel: "Delete User",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.deleteUser(sessionToken!, user.id);
          await loadUsers();
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
            <UsersIcon className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Users Management</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Search, inspect, verify, suspend, and govern all registered platform user accounts.
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by name or email address..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Email Verification Filter */}
          <select
            value={verifiedFilter}
            onChange={(e) => {
              setVerifiedFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
          </select>

          {/* Account Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Organizations</th>
                <th className="py-3.5 px-4">Joined Date</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center font-bold text-brand-300 text-xs">
                          {u.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <Link
                            to={`/users/${u.id}`}
                            className="font-bold text-white hover:text-brand-400 transition flex items-center gap-1.5"
                          >
                            <span>{u.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 opacity-60 hover:opacity-100" />
                          </Link>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {u.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                          <XCircle className="w-3.5 h-3.5" /> Unverified
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <StatusBadge status={u.status} size="sm" />
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-semibold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <Building className="w-3 h-3 text-brand-400" />
                        {u.organizationCount} {u.organizationCount === 1 ? "org" : "orgs"}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-[11px] text-slate-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!u.emailVerified && (
                          <button
                            title="Verify email manually"
                            onClick={() => handleVerifyEmail(u)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition"
                          >
                            <MailCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          title="Revoke all active sessions"
                          onClick={() => handleRevokeSessions(u)}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>

                        {u.status === "ACTIVE" ? (
                          <button
                            title="Suspend user account"
                            onClick={() => handleSuspend(u)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            title="Reactivate user account"
                            onClick={() => handleActivate(u)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          title="Delete user"
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

export default Users;
