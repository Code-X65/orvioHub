import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users as UsersIcon,
  Ban,
  Shield,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  MailCheck,
  LogOut,
  Building,
  BarChart3,
  Layers,
  GitBranch,
  Package,
  Receipt,
  X,
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
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | "ACCOUNT_OWNER" | "ORG_MEMBER" | "GENERAL_USER">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Usage Modal State
  const [selectedUserUsage, setSelectedUserUsage] = useState<any | null>(null);

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

  const filteredUsers = users.filter((u) => {
    if (userTypeFilter === "all") return true;
    return u.userType === userTypeFilter;
  });

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

  const handleRevokeSessions = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Revoke Active Sessions",
      message: `Log out ${user.email} from all currently connected devices and browsers?`,
      confirmLabel: "Revoke All Sessions",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.revokeUserSessions(sessionToken!, user.id);
          alert(`All active sessions for ${user.email} were revoked.`);
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
      title: "Verify Email Manually",
      message: `Mark email address ${user.email} as verified? This bypasses standard OTP email verification.`,
      confirmLabel: "Mark Verified",
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

  const handleDelete = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Permanently Delete User",
      message: `Permanently delete user ${user.email}? This action cannot be undone.`,
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

  const getPlanBadge = (planKey?: string) => {
    const key = (planKey || "free").toLowerCase();
    switch (key) {
      case "premium":
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
            Premium
          </span>
        );
      case "standard":
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
            Standard
          </span>
        );
      case "free":
      case "free_trial":
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            Free Trial
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Platform Users & Plan Usage</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage all registered user accounts, active subscription tiers, and live entitlement usage counters.
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
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
          {/* User Type Filter */}
          <select
            value={userTypeFilter}
            onChange={(e) => {
              setUserTypeFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All User Types</option>
            <option value="ACCOUNT_OWNER">Account Owners</option>
            <option value="ORG_MEMBER">Organization Staff</option>
            <option value="GENERAL_USER">General Users</option>
          </select>

          {/* Email Verification Filter */}
          <select
            value={verifiedFilter}
            onChange={(e) => {
              setVerifiedFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
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
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
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
                <th className="py-3.5 px-5">User & Type</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4">Usage vs Limits</th>
                <th className="py-3.5 px-4">Status</th>
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const subPlanKey = u.subscription?.planKey || "free";
                  const ent = u.entitlements || {};
                  const usage = u.usage || {};

                  const maxOrgs = ent.maxOrganizations ?? 1;
                  const currentOrgs = usage.workspaces ?? u.organizationCount ?? 0;

                  const maxApps = ent.maxAppsPerOrganization === "unlimited" ? "∞" : (ent.maxAppsPerOrganization ?? 1);
                  const currentApps = usage.apps ?? 0;

                  const maxBranches = ent.maxBranchesPerApp === "unlimited" ? "∞" : (ent.maxBranchesPerApp ?? 1);
                  const currentBranches = usage.branches ?? 0;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center font-bold text-brand-300 text-xs shrink-0">
                            {u.name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/users/${u.id}`}
                                className="font-bold text-white hover:text-brand-400 transition flex items-center gap-1.5"
                              >
                                <span>{u.name}</span>
                                <ExternalLink className="w-3 h-3 text-slate-500 opacity-60 hover:opacity-100" />
                              </Link>

                              {u.userType === "ACCOUNT_OWNER" && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                                  Owner
                                </span>
                              )}
                              {u.userType === "ORG_MEMBER" && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">
                                  Staff
                                </span>
                              )}
                              {u.userType === "GENERAL_USER" && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-medium">
                                  General
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Plan Tier Column */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {getPlanBadge(subPlanKey)}
                          <div className="text-[10px] text-slate-500 capitalize">
                            status: {u.subscription?.status || "trialing"}
                          </div>
                        </div>
                      </td>

                      {/* Usage vs Limits Column */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]">
                            <span className="text-slate-400 font-medium">Orgs: </span>
                            <span
                              className={`font-mono font-bold ${
                                currentOrgs >= maxOrgs ? "text-amber-400" : "text-white"
                              }`}
                            >
                              {currentOrgs}/{maxOrgs}
                            </span>
                          </div>
                          <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]">
                            <span className="text-slate-400 font-medium">Apps: </span>
                            <span className="font-mono font-bold text-indigo-300">
                              {currentApps}/{maxApps}
                            </span>
                          </div>
                          <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]">
                            <span className="text-slate-400 font-medium">Branches: </span>
                            <span className="font-mono font-bold text-amber-300">
                              {currentBranches}/{maxBranches}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge status={u.status} size="sm" />
                      </td>

                      <td className="py-4 px-4 text-[11px] text-slate-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Usage Button */}
                          <button
                            title="Inspect user entitlements and live usage counters"
                            onClick={() => setSelectedUserUsage(u)}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-brand-300 hover:bg-brand-500/10 hover:border-brand-500/30 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Usage</span>
                          </button>

                          {!u.emailVerified && (
                            <button
                              title="Verify email manually"
                              onClick={() => handleVerifyEmail(u)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition cursor-pointer"
                            >
                              <MailCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            title="Revoke all active sessions"
                            onClick={() => handleRevokeSessions(u)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>

                          {u.status === "ACTIVE" ? (
                            <button
                              title="Suspend user account"
                              onClick={() => handleSuspend(u)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              title="Reactivate user account"
                              onClick={() => handleActivate(u)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition cursor-pointer"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            title="Delete user"
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* View Usage Modal */}
      {selectedUserUsage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{selectedUserUsage.name}</h3>
                  <p className="text-[11px] text-slate-400">{selectedUserUsage.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserUsage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs">
                <span className="text-slate-400">Active Subscription: </span>
                <span className="font-bold text-white uppercase ml-1">
                  {selectedUserUsage.subscription?.planKey || "Free Trial"}
                </span>
              </div>
              {getPlanBadge(selectedUserUsage.subscription?.planKey)}
            </div>

            {/* Usage Progress Cards */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Batch Entitlements & Live Usage
              </h4>

              {/* 1. Organizations */}
              {(() => {
                const max = selectedUserUsage.entitlements?.maxOrganizations ?? 1;
                const cur = selectedUserUsage.usage?.workspaces ?? selectedUserUsage.organizationCount ?? 0;
                const pct = Math.min(100, Math.round((cur / max) * 100));
                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-400" /> Organizations
                      </span>
                      <span className="font-mono font-bold text-white">
                        {cur} / {max}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* 2. Apps per Workspace */}
              {(() => {
                const max = selectedUserUsage.entitlements?.maxAppsPerOrganization;
                const cur = selectedUserUsage.usage?.apps ?? 0;
                const isUnlimited = max === "unlimited";
                const numMax = isUnlimited ? 999 : (max ?? 1);
                const pct = isUnlimited ? 15 : Math.min(100, Math.round((cur / numMax) * 100));
                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" /> Applications
                      </span>
                      <span className="font-mono font-bold text-white">
                        {cur} / {isUnlimited ? "Unlimited" : numMax}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          !isUnlimited && pct >= 100 ? "bg-rose-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* 3. Branches per App */}
              {(() => {
                const max = selectedUserUsage.entitlements?.maxBranchesPerApp ?? 1;
                const cur = selectedUserUsage.usage?.branches ?? 0;
                const pct = Math.min(100, Math.round((cur / max) * 100));
                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-amber-400" /> Branches per App
                      </span>
                      <span className="font-mono font-bold text-white">
                        {cur} / {max}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-amber-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* 4. Team Members */}
              {(() => {
                const max = selectedUserUsage.entitlements?.maxMembersPerOrganization ?? 2;
                const cur = selectedUserUsage.usage?.members ?? 1;
                const pct = Math.min(100, Math.round((cur / max) * 100));
                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <UsersIcon className="w-3.5 h-3.5 text-emerald-400" /> Team Members
                      </span>
                      <span className="font-mono font-bold text-white">
                        {cur} / {max}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* 5. Products & 6. Transactions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Package className="w-3 h-3 text-slate-400" /> Product Limit
                  </span>
                  <div className="font-mono font-bold text-white text-xs">
                    {(selectedUserUsage.entitlements?.maxProductsPerWorkspace ?? 500).toLocaleString()} items
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-slate-400" /> Monthly Tx Limit
                  </span>
                  <div className="font-mono font-bold text-white text-xs">
                    {(selectedUserUsage.entitlements?.maxTransactionsPerMonth ?? 500).toLocaleString()} txs
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedUserUsage(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
