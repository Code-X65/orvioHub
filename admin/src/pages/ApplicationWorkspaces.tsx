import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Package,
  Building2,
  Store,
  Clock,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Search,
  RefreshCw,
  Loader2,
  Ban,
  ChevronRight,
  Boxes,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminProductsApi } from "../api/adminProducts";
import { adminOrganizationsApi } from "../api/adminOrganizations";
import StatusBadge from "../components/StatusBadge";
import SuspendModal from "../components/SuspendModal";

const APP_METADATA: Record<string, { name: string; icon: string; description: string }> = {
  inventory: {
    name: "Inventory & POS",
    icon: "📦",
    description: "Multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.",
  },
  taskmanagement: {
    name: "Task & Project Management",
    icon: "📋",
    description: "Agile sprints, interactive kanban boards, team workflows & milestone tracking.",
  },
  crm: {
    name: "Customer CRM",
    icon: "👥",
    description: "Client contact directories, communication history, pipelines, and deal conversions.",
  },
  booking: {
    name: "Appointments & Booking",
    icon: "📅",
    description: "Online calendar reservations, service scheduling, reminders, and client appointments.",
  },
  gym: {
    name: "Gym & Fitness Membership",
    icon: "🏋️",
    description: "Member passes, attendance tracking, trainer schedules, and class subscriptions.",
  },
};

export const ApplicationWorkspaces: React.FC = () => {
  const { appKey: rawAppKey } = useParams<{ appKey?: string }>();
  const appKey = (rawAppKey || "inventory").toLowerCase();
  const navigate = useNavigate();
  const { sessionToken } = useAuth();

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Extend Trial Modal State
  const [trialModalWs, setTrialModalWs] = useState<any>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [trialLoading, setTrialLoading] = useState(false);

  // Suspension Modal State
  const [suspendModalOrg, setSuspendModalOrg] = useState<any>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);

  const appInfo = APP_METADATA[appKey] || {
    name: appKey.charAt(0).toUpperCase() + appKey.slice(1),
    icon: "📦",
    description: `Platform workspaces with active ${appKey} entitlements.`,
  };

  const loadData = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const [wsList, appStats] = await Promise.all([
        adminProductsApi.listApplicationWorkspaces(sessionToken, appKey, {
          status: statusFilter,
          planKey: planFilter,
          search,
        }),
        adminProductsApi.getApplicationStats(sessionToken, appKey),
      ]);
      setWorkspaces(wsList || []);
      setStats(appStats || null);
    } catch (err) {
      console.error("Failed to load application workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken, appKey, statusFilter, planFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExtendTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !trialModalWs) return;
    setTrialLoading(true);
    try {
      await adminProductsApi.grantExtendedTrial(
        sessionToken,
        trialModalWs.workspaceId,
        appKey,
        Number(trialDays)
      );
      setTrialModalWs(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to extend trial.");
    } finally {
      setTrialLoading(false);
    }
  };

  const handleRestore = async (wsId: string) => {
    if (!sessionToken) return;
    try {
      await adminOrganizationsApi.restoreOrganization(sessionToken, wsId);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to restore workspace.");
    }
  };

  const handleSuspendConfirm = async (data: { reason: string; notes: string }) => {
    if (!sessionToken || !suspendModalOrg) return;
    setSuspendLoading(true);
    try {
      await adminOrganizationsApi.suspendOrganization(
        sessionToken,
        suspendModalOrg.workspaceId,
        data.reason,
        data.notes
      );
      setSuspendModalOrg(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to suspend workspace.");
    } finally {
      setSuspendLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/products" className="hover:text-slate-200">Products Catalog</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-200 font-medium capitalize">{appInfo.name} Workspaces</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xl shadow-inner">
              {appInfo.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{appInfo.name} Tenants</h1>
              <p className="text-xs text-slate-400">{appInfo.description}</p>
            </div>
          </div>
        </div>

        {/* Quick App Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          {Object.entries(APP_METADATA).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => navigate(`/applications/${key}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                appKey === key
                  ? "bg-brand-600 text-white shadow-md font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <span>{meta.icon}</span>
              <span>{meta.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Activations</p>
            <p className="text-2xl font-bold text-white mt-1">{stats?.totalActivations ?? workspaces.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Tenants</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats?.totalActive ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Incomplete Onboarding</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{stats?.onboardingInProgress ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Trial Active</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">{stats?.totalTrial ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Sparkles className="w-5 h-5" />
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
              placeholder="Search by workspace name, slug, owner name, or email..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial / Trialing</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Plans</option>
              <option value="free_trial">Free Trial</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>

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

      {/* Workspace Tenants Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3.5 px-4">Workspace & Owner</th>
                <th className="py-3.5 px-4">Plan & Status</th>
                <th className="py-3.5 px-4">Onboarding Flow</th>
                <th className="py-3.5 px-4">Branches</th>
                <th className="py-3.5 px-4">Catalog / Usage</th>
                <th className="py-3.5 px-4">Activated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
                    <span>Loading application tenants...</span>
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                    <p className="text-sm font-semibold text-slate-300">No workspaces found</p>
                    <p className="text-xs text-slate-500 mt-1">No tenant has activated this application matching your filters.</p>
                  </td>
                </tr>
              ) : (
                workspaces.map((ws) => {
                  const s = (ws.status || "active").toLowerCase();
                  const isSuspended = s === "suspended";
                  const isOnboarded = ws.onboarding?.status === "completed" || ws.onboarding?.status === "COMPLETED";

                  return (
                    <tr key={ws.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600/30 to-indigo-600/30 border border-brand-500/20 flex items-center justify-center font-bold text-white text-xs">
                            {ws.workspaceName?.substring(0, 2).toUpperCase() || "WS"}
                          </div>
                          <div>
                            <Link
                              to={`/organizations/${ws.workspaceId}`}
                              className="font-semibold text-white hover:text-brand-400 flex items-center gap-1.5"
                            >
                              <span>{ws.workspaceName}</span>
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </Link>
                            <p className="text-[11px] text-slate-400">{ws.ownerEmail} ({ws.ownerName})</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            (ws.planKey || "").toLowerCase() === "standard"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              : (ws.planKey || "").toLowerCase() === "premium"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                              : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                          }`}>
                            {(() => {
                              const key = (ws.planKey || "free_trial").toLowerCase();
                              if (key === "free_trial" || key === "trial") return "Free Trial";
                              if (key === "standard") return "Standard";
                              if (key === "premium") return "Premium";
                              return key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                            })()}
                          </span>
                          <div>
                            <StatusBadge status={ws.status} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {isOnboarded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>In Progress</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 capitalize">Step: {ws.onboarding?.currentStep || "Welcome"}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ws.branchCount || 1} Branch{ws.branchCount === 1 ? "" : "es"}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Boxes className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ws.productCount || 0} Products</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {ws.activatedAt ? new Date(ws.activatedAt).toLocaleDateString() : "—"}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setTrialModalWs(ws)}
                            title="Extend trial period"
                            className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          {isSuspended ? (
                            <button
                              onClick={() => handleRestore(ws.workspaceId)}
                              title="Restore application access"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setSuspendModalOrg({ workspaceId: ws.workspaceId, name: ws.workspaceName })}
                              title="Suspend application"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <Link
                            to={`/organizations/${ws.workspaceId}`}
                            title="View organization details"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extend Trial Modal */}
      {trialModalWs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Extend Application Trial</h3>
                <p className="text-xs text-slate-400">{trialModalWs.workspaceName}</p>
              </div>
            </div>

            <form onSubmit={handleExtendTrial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Additional Days to Grant
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTrialDays(days)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition ${
                        trialDays === days
                          ? "bg-brand-600 text-white border-brand-500 shadow-md"
                          : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      +{days} Days
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <p>• Tenant will immediately regain access if trial expired.</p>
                <p>• Action will be permanently logged to Platform Admin Audit Logs.</p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTrialModalWs(null)}
                  disabled={trialLoading}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={trialLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-lg shadow-brand-600/25 flex items-center gap-1.5 transition"
                >
                  {trialLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm +{trialDays} Days</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModalOrg && (
        <SuspendModal
          isOpen={Boolean(suspendModalOrg)}
          targetType="organization"
          targetName={suspendModalOrg.name || "Workspace"}
          targetId={suspendModalOrg.workspaceId}
          isLoading={suspendLoading}
          onClose={() => setSuspendModalOrg(null)}
          onConfirm={handleSuspendConfirm}
        />
      )}
    </div>
  );
};

export default ApplicationWorkspaces;
