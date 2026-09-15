import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  Store,
  Shield,
  ArrowRightLeft,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Ban,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminProductsApi } from "../api/adminProducts";

const ROLE_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  inventory_owner: {
    label: "Inventory Owner",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  inventory_manager: {
    label: "Inventory Manager",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  cashier: {
    label: "Cashier / POS",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  stock_manager: {
    label: "Stock Manager",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  accountant: {
    label: "Accountant",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
  },
  inventory_viewer: {
    label: "Inventory Viewer",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
  },
};

export const InventoryTeamExplorer: React.FC = () => {
  const { sessionToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"members" | "transfers">("members");
  const [members, setMembers] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const [membersData, transfersData] = await Promise.all([
        adminProductsApi.listAllBranchMembers(sessionToken, {
          role: roleFilter,
          status: statusFilter,
          search,
        }),
        adminProductsApi.listAllBranchTransfers(sessionToken, {
          search,
        }),
      ]);
      setMembers(membersData || []);
      setTransfers(transfersData || []);
    } catch (err) {
      console.error("Failed to load branch team data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken, roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const activeMembersCount = members.filter((m) => m.status === "active").length;
  const suspendedMembersCount = members.filter((m) => m.status === "suspended").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/products" className="hover:text-slate-200">Products Catalog</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/applications/inventory" className="hover:text-slate-200">Inventory Tenants</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-200 font-medium">Branch Team Explorer</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Cross-Tenant Branch Teams</h1>
              <p className="text-xs text-slate-400">
                Global RBAC oversight, branch memberships, and staff transfers across all workspaces.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("members")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === "members"
                ? "bg-brand-600 text-white shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Staff Members ({members.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("transfers")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === "transfers"
                ? "bg-brand-600 text-white shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer History ({transfers.length})</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Assignments</p>
            <p className="text-2xl font-bold text-white mt-1">{members.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Staff</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{activeMembersCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Suspended / Inactive</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{suspendedMembersCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Ban className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Branch Transfers</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">{transfers.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user name, email, workspace, branch, or role..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {activeTab === "members" && (
              <>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Roles</option>
                  <option value="inventory_owner">Inventory Owner</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="stock_manager">Stock Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="inventory_viewer">Inventory Viewer</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="removed">Removed</option>
                </select>
              </>
            )}

            <button
              type="button"
              onClick={loadData}
              title="Refresh records"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-400" : ""}`} />
            </button>
          </div>
        </form>
      </div>

      {/* Main Table Content */}
      {activeTab === "members" ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Workspace Tenant</th>
                  <th className="py-3.5 px-4">Assigned Branch</th>
                  <th className="py-3.5 px-4">Role & Capabilities</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned Date</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
                      <span>Loading team members...</span>
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                      <p className="text-sm font-semibold text-slate-300">No branch team members found</p>
                      <p className="text-xs text-slate-500 mt-1">Try resetting your search query or filters.</p>
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const badge = ROLE_BADGES[m.role] || {
                      label: m.role,
                      bg: "bg-slate-800",
                      text: "text-slate-300",
                      border: "border-slate-700",
                    };
                    const isActive = m.status === "active";

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md">
                              {m.userName?.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{m.userName}</p>
                              <p className="text-[11px] text-slate-400 truncate">{m.userEmail}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Link
                            to={`/organizations/${m.workspaceId}`}
                            className="text-slate-200 hover:text-brand-400 font-medium flex items-center gap-1.5 group"
                          >
                            <Building2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400" />
                            <span className="truncate max-w-[140px]">{m.workspaceName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition" />
                          </Link>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <Store className="w-3.5 h-3.5 text-brand-400" />
                            <span className="font-medium">{m.branchName}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                            <p className="text-[10px] text-slate-500">
                              {m.permissions?.length || 0} permissions granted
                            </p>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 capitalize">
                              <Ban className="w-3 h-3" />
                              <span>{m.status}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {m.assignedAt ? new Date(m.assignedAt).toLocaleDateString() : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/organizations/${m.workspaceId}`}
                            title="Inspect workspace and organization details"
                            className="inline-flex items-center gap-1 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-[11px]"
                          >
                            <span>Inspect Tenant</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Workspace</th>
                  <th className="py-3.5 px-4">Source Branch</th>
                  <th className="py-3.5 px-4">Target Branch</th>
                  <th className="py-3.5 px-4">Role Transition</th>
                  <th className="py-3.5 px-4">Transferred By</th>
                  <th className="py-3.5 px-4">Date & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
                      <span>Loading transfer audit logs...</span>
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <ArrowRightLeft className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                      <p className="text-sm font-semibold text-slate-300">No transfer logs recorded</p>
                      <p className="text-xs text-slate-500 mt-1">Staff transfers between branches will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0">
                            {t.userName?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{t.userName}</p>
                            <p className="text-[11px] text-slate-400">{t.userEmail}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Link
                          to={`/organizations/${t.workspaceId}`}
                          className="text-slate-200 hover:text-brand-400 font-medium"
                        >
                          {t.workspaceName}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-400 line-through mr-1 font-normal">
                          {t.sourceBranchName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <Store className="w-3.5 h-3.5" />
                          <span>{t.targetBranchName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-slate-300 capitalize">
                            {t.previousRole?.replace("_", " ")} → <span className="text-white font-semibold">{t.newRole?.replace("_", " ")}</span>
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 text-[11px]">
                        {t.transferredByName}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                          </div>
                          {t.message && (
                            <p className="text-[10px] text-slate-500 italic max-w-[180px] truncate">
                              "{t.message}"
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryTeamExplorer;
