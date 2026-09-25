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
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  Layers,
  Sparkles,
  Filter,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminUsersApi } from "../api/adminUsers";
import SearchBar from "../components/SearchBar";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import SuspendModal from "../components/SuspendModal";
import DeleteModal from "../components/DeleteModal";

export const Users: React.FC = () => {
  const { sessionToken } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Filters
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [billingFilter, setBillingFilter] = useState("all");
  const [onboardingFilter, setOnboardingFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Modals for structured suspension and deletion
  const [suspendModalUser, setSuspendModalUser] = useState<any>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<any>(null);
  const [isBulkSuspendModalOpen, setIsBulkSuspendModalOpen] = useState(false);
  const [bulkSuspendReason, setBulkSuspendReason] = useState("Administrative policy enforcement");
  const [bulkSuspendNotes, setBulkSuspendNotes] = useState("");

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map((u) => u.id));
    }
  };

  const handleBulkSuspend = async () => {
    if (!sessionToken || selectedUserIds.length === 0) return;
    setActionLoading(true);
    try {
      for (const userId of selectedUserIds) {
        await adminUsersApi.suspendUser(sessionToken, userId, bulkSuspendReason, bulkSuspendNotes);
      }
      setIsBulkSuspendModalOpen(false);
      setSelectedUserIds([]);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to bulk suspend users.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkRevokeSessions = async () => {
    if (!sessionToken || selectedUserIds.length === 0) return;
    if (!confirm(`Revoke all active sessions for ${selectedUserIds.length} selected users?`)) return;
    setActionLoading(true);
    try {
      for (const userId of selectedUserIds) {
        await adminUsersApi.revokeUserSessions(sessionToken, userId, "Bulk session revocation by superadmin");
      }
      setSelectedUserIds([]);
      alert(`Successfully revoked sessions for ${selectedUserIds.length} user(s).`);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to bulk revoke sessions.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkVerifyEmail = async () => {
    if (!sessionToken || selectedUserIds.length === 0) return;
    if (!confirm(`Manually mark email as verified for ${selectedUserIds.length} selected users?`)) return;
    setActionLoading(true);
    try {
      for (const userId of selectedUserIds) {
        await adminUsersApi.verifyUserEmail(sessionToken, userId);
      }
      setSelectedUserIds([]);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to bulk verify emails.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    const targetUsers = selectedUserIds.length > 0
      ? users.filter((u) => selectedUserIds.includes(u.id))
      : users;

    const headers = ["ID", "Name", "Email", "Role", "UserType", "EmailVerified", "Status", "OwnedOrgs", "JoinedOrgs", "CreatedAt"];
    const rows = targetUsers.map((u) => [
      u.id,
      `"${(u.name || "").replace(/"/g, '""')}"`,
      u.email,
      u.role || "user",
      u.userType || "standard",
      u.emailVerified ? "true" : "false",
      u.status || "active",
      u.ownedOrganizationsCount || 0,
      u.memberOrganizationsCount || 0,
      new Date(u.createdAt).toISOString(),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `users_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // General Dialog State
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
        statusFilter: statusFilter === "all" ? undefined : statusFilter,
        userTypeFilter: userTypeFilter === "all" ? undefined : userTypeFilter,
        orgFilter: orgFilter === "all" ? undefined : orgFilter,
        billingFilter: billingFilter === "all" ? undefined : billingFilter,
        onboardingFilter: onboardingFilter === "all" ? undefined : onboardingFilter,
        roleFilter: roleFilter === "all" ? undefined : roleFilter,
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
  }, [
    sessionToken,
    page,
    search,
    verifiedFilter,
    statusFilter,
    userTypeFilter,
    orgFilter,
    billingFilter,
    onboardingFilter,
    roleFilter,
  ]);

  const handleSuspend = (user: any) => {
    setSuspendModalUser(user);
  };

  const handleConfirmSuspend = async (data: { reason: string; notes: string }) => {
    if (!sessionToken || !suspendModalUser) return;
    setActionLoading(true);
    try {
      await adminUsersApi.suspendUser(sessionToken, suspendModalUser.id, data.reason, data.notes);
      setSuspendModalUser(null);
      await loadUsers();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (user: any) => {
    setDeleteModalUser(user);
  };

  const handleConfirmDelete = async (options: any) => {
    if (!sessionToken || !deleteModalUser) return;
    setActionLoading(true);
    try {
      await adminUsersApi.deleteUser(sessionToken, deleteModalUser.id, options);
      setDeleteModalUser(null);
      await loadUsers();
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = (user: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Reactivate User Account",
      message: `Reactivate ${user.email}? This will restore account access and allow the user to sign in immediately.`,
      confirmLabel: "Reactivate Account",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.restoreUser(sessionToken!, user.id);
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
          await adminUsersApi.revokeUserSessions(sessionToken!, user.id, "Admin user list trigger");
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

  const resetFilters = () => {
    setSearch("");
    setVerifiedFilter("all");
    setStatusFilter("all");
    setUserTypeFilter("all");
    setOrgFilter("all");
    setBillingFilter("all");
    setOnboardingFilter("all");
    setRoleFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    search !== "" ||
    verifiedFilter !== "all" ||
    statusFilter !== "all" ||
    userTypeFilter !== "all" ||
    orgFilter !== "all" ||
    billingFilter !== "all" ||
    onboardingFilter !== "all" ||
    roleFilter !== "all";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Platform Users</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Superadmin directory for inspecting, auditing, and managing registered user records, access permissions, and organization ownerships.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}

          <button
            onClick={loadUsers}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-xl">
            <SearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search by name, email, user ID, phone, organization, or Paystack ref..."
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Filters:</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {/* Account Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DELETED">Deleted</option>
          </select>

          {/* Email Verification */}
          <select
            value={verifiedFilter}
            onChange={(e) => {
              setVerifiedFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Verification</option>
            <option value="verified">Email Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          {/* User Type */}
          <select
            value={userTypeFilter}
            onChange={(e) => {
              setUserTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All User Types</option>
            <option value="ACCOUNT_OWNER">Account Owners</option>
            <option value="ORG_MEMBER">Organization Staff</option>
            <option value="GENERAL_USER">General Users</option>
          </select>

          {/* Organizations State */}
          <select
            value={orgFilter}
            onChange={(e) => {
              setOrgFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Organizations</option>
            <option value="has_orgs">With Organizations</option>
            <option value="no_orgs">Without Organizations</option>
            <option value="limit_reached">At Limit (3/3)</option>
          </select>

          {/* Billing & Subscriptions */}
          <select
            value={billingFilter}
            onChange={(e) => {
              setBillingFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Billing</option>
            <option value="active_sub">Active Subscriptions</option>
            <option value="trial">Free Trial</option>
            <option value="failed_payments">Failed Payments</option>
          </select>

          {/* Onboarding State */}
          <select
            value={onboardingFilter}
            onChange={(e) => {
              setOnboardingFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Onboarding</option>
            <option value="completed">Onboarding Done</option>
            <option value="incomplete">Incomplete</option>
          </select>

          {/* Role */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Superadmins</option>
            <option value="user">Regular Users</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedUserIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs">
              {selectedUserIds.length} Selected
            </span>
            <span className="text-xs text-indigo-200">
              Bulk actions apply to all highlighted user accounts.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkSuspendModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Bulk Suspend</span>
            </button>

            <button
              type="button"
              onClick={handleBulkRevokeSessions}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Revoke Sessions</span>
            </button>

            <button
              type="button"
              onClick={handleBulkVerifyEmail}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <MailCheck className="w-3.5 h-3.5" />
              <span>Verify Emails</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedUserIds([])}
              className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUserIds.length === users.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-5">User & Identity</th>
                <th className="py-3.5 px-4">Org / App / Branch</th>
                <th className="py-3.5 px-4">Contact & Location</th>
                <th className="py-3.5 px-4">Subscription & Risk</th>
                <th className="py-3.5 px-4">Status & Dates</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const ownedCount = u.ownedOrganizationsCount ?? 0;
                  const memberCount = u.memberOrganizationsCount ?? 0;
                  const isSuperadmin = u.role === "superadmin" || u.role === "admin";
                  const quota = u.ownershipQuota;
                  const isSelected = selectedUserIds.includes(u.id);

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isSelected ? "bg-indigo-950/20" : ""
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* User & Identity */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow overflow-hidden border border-slate-700/60">
                            {u.avatar || u.avatarUrl ? (
                              <img
                                src={u.avatar || u.avatarUrl}
                                alt={u.name || "User"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              u.name?.charAt(0)?.toUpperCase() || "U"
                            )}
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

                              {isSuperadmin && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-bold flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" /> Superadmin
                                </span>
                              )}

                              {u.userType === "ACCOUNT_OWNER" && !isSuperadmin && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                                  Owner
                                </span>
                              )}
                              {u.userType === "ORG_MEMBER" && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">
                                  Staff
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-slate-400">{u.email}</p>
                              {u.emailVerified ? (
                                <span title="Email verified" className="inline-flex items-center text-emerald-400 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" />
                                </span>
                              ) : (
                                <span title="Email unverified" className="inline-flex items-center text-rose-400 text-[10px]">
                                  <XCircle className="w-3 h-3" />
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              ID: {u.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Org / App / Branch */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Building className="w-3.5 h-3.5 text-brand-400" />
                            <span>
                              {ownedCount} Owned / {memberCount} Member
                            </span>
                            {quota?.isLimitReached && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/20">
                                {quota.ownedCount}/{quota.maxLimit} Limit
                              </span>
                            )}
                          </div>

                          {/* Active apps & Branches */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.activeApplications && u.activeApplications.length > 0 ? (
                              u.activeApplications.map((appKey: string) => (
                                <span
                                  key={appKey}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-semibold border border-slate-700 flex items-center gap-1"
                                >
                                  <Layers className="w-2.5 h-2.5 text-indigo-400" />
                                  {appKey}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500">No apps activated</span>
                            )}

                            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 text-[9px] font-medium border border-slate-800 flex items-center gap-1">
                              <Building className="w-2.5 h-2.5 text-emerald-400" />
                              {u.activeBranchesCount ?? 0} {(u.activeBranchesCount ?? 0) === 1 ? 'Branch' : 'Branches'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Location */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          {u.phone ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="text-slate-300">{u.phoneNormalized || u.phone}</span>
                              {u.phoneStatus === "verified" ? (
                                <span title="Phone verified" className="inline-flex items-center text-emerald-400 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                </span>
                              ) : (
                                <span title="Phone unverified" className="inline-flex items-center text-amber-400 text-[10px]">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">No phone</span>
                          )}
                          <div className="text-slate-400 text-[10px]">
                            {u.country || "Nigeria"}
                          </div>
                        </div>
                      </td>

                      {/* Subscription & Risk Indicators */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-200 capitalize text-[11px]">
                              {u.subscription?.planKey || "Free"}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                u.subscription?.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-purple-500/10 text-purple-300"
                              }`}
                            >
                              {u.subscription?.status || "trial"}
                            </span>
                          </div>

                          {/* Warnings */}
                          {u.warnings && u.warnings.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {u.warnings.map((w: string) => (
                                <span
                                  key={w}
                                  className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 text-[9px] font-medium border border-rose-500/20 flex items-center gap-0.5"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {w.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status & Dates */}
                      <td className="py-4 px-4 text-[11px]">
                        <div className="space-y-1">
                          <StatusBadge status={u.status} size="sm" />
                          <div className="text-[10px] text-slate-500">
                            Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Last Login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/users/${u.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition"
                          >
                            Details
                          </Link>

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

      {/* Bulk Suspend Modal */}
      {isBulkSuspendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Bulk Suspend Users</h3>
                <p className="text-xs text-slate-400">
                  Suspend {selectedUserIds.length} selected user account(s).
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Suspension Reason
                </label>
                <input
                  type="text"
                  value={bulkSuspendReason}
                  onChange={(e) => setBulkSuspendReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Internal Governance Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={bulkSuspendNotes}
                  onChange={(e) => setBulkSuspendNotes(e.target.value)}
                  placeholder="Reference ticket or policy violation details..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkSuspendModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleBulkSuspend}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>Confirm Bulk Suspend ({selectedUserIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Structured Suspend User Modal */}
      {suspendModalUser && (
        <SuspendModal
          isOpen={!!suspendModalUser}
          targetType="user"
          targetName={suspendModalUser.name || suspendModalUser.email}
          targetId={suspendModalUser.id}
          isLoading={actionLoading}
          onClose={() => setSuspendModalUser(null)}
          onConfirm={handleConfirmSuspend}
        />
      )}

      {/* Structured Delete User Modal */}
      {deleteModalUser && (
        <DeleteModal
          isOpen={!!deleteModalUser}
          targetType="user"
          targetName={deleteModalUser.name || deleteModalUser.email}
          targetId={deleteModalUser.id}
          ownedWorkspacesCount={deleteModalUser.ownedOrganizationsCount ?? 0}
          isLoading={actionLoading}
          onClose={() => setDeleteModalUser(null)}
          onConfirm={handleConfirmDelete}
        />
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
