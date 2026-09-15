import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ExternalLink,
  Ban,
  Shield,
  Trash2,
  RotateCcw,
  Loader2,
  RefreshCw,
  Store,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminOrganizationsApi } from "../api/adminOrganizations";
import SearchBar from "../components/SearchBar";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import SuspendModal from "../components/SuspendModal";
import DeleteModal from "../components/DeleteModal";

export const Organizations: React.FC = () => {
  const { sessionToken } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [onboardingFilter, setOnboardingFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals for structured suspension and deletion
  const [suspendModalOrg, setSuspendModalOrg] = useState<any>(null);
  const [deleteModalOrg, setDeleteModalOrg] = useState<any>(null);

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

  const loadWorkspaces = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const res: any = await adminOrganizationsApi.listOrganizations({
        sessionToken,
        search,
        statusFilter,
        planFilter,
        branchFilter,
        onboardingFilter,
        page,
        pageSize: 10,
      });
      setWorkspaces(res?.items || []);
      setTotalCount(res?.totalCount || 0);
      setTotalPages(res?.totalPages || 1);
    } catch (err) {
      console.error("Failed to load organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [sessionToken, page, search, statusFilter, planFilter, branchFilter, onboardingFilter]);

  const handleSuspend = (ws: any) => {
    setSuspendModalOrg(ws);
  };

  const handleConfirmSuspend = async (data: { reason: string; notes: string }) => {
    if (!sessionToken || !suspendModalOrg) return;
    setActionLoading(true);
    try {
      await adminOrganizationsApi.suspendOrganization(sessionToken, suspendModalOrg.id, data.reason, data.notes);
      setSuspendModalOrg(null);
      await loadWorkspaces();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (ws: any) => {
    setDeleteModalOrg(ws);
  };

  const handleConfirmDelete = async (options: any) => {
    if (!sessionToken || !deleteModalOrg) return;
    setActionLoading(true);
    try {
      await adminOrganizationsApi.deleteOrganization(sessionToken, deleteModalOrg.id, options);
      setDeleteModalOrg(null);
      await loadWorkspaces();
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = (ws: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Activate Organization",
      message: `Activate "${ws.name}" and restore product and membership access?`,
      confirmLabel: "Activate Organization",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminOrganizationsApi.restoreOrganization(sessionToken!, ws.id);
          await loadWorkspaces();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleResetOnboarding = (ws: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Reset Organization Onboarding",
      message: `Reset setup steps for "${ws.name}" back to the welcome step?`,
      confirmLabel: "Reset Setup",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminOrganizationsApi.resetOnboarding(sessionToken!, ws.id);
          await loadWorkspaces();
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
            <Building2 className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Organizations & Workspaces</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage provisioned organizations, view tenant topology, and govern workspace products.
          </p>
        </div>

        <button
          onClick={loadWorkspaces}
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
            placeholder="Search by organization name or slug..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Plans</option>
            <option value="free_trial">Free Trial</option>
            <option value="standard">Standard</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Branches</option>
            <option value="1">1 Branch</option>
            <option value="2-5">2–5 Branches</option>
            <option value="multiple">Multiple (&gt;1)</option>
          </select>

          <select
            value={onboardingFilter}
            onChange={(e) => {
              setOnboardingFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Onboarding</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-4">Owner</th>
                <th className="py-3.5 px-4">Plan & Status</th>
                <th className="py-3.5 px-4">Branches</th>
                <th className="py-3.5 px-4">Apps</th>
                <th className="py-3.5 px-4">Onboarding</th>
                <th className="py-3.5 px-4">Created</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading organizations...
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    No organizations found.
                  </td>
                </tr>
              ) : (
                workspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-xs">
                          {ws.name?.charAt(0)?.toUpperCase() || "O"}
                        </div>
                        <div>
                          <Link
                            to={`/organizations/${ws.id}`}
                            className="font-bold text-white hover:text-brand-400 transition flex items-center gap-1.5"
                          >
                            <span>{ws.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 opacity-60 hover:opacity-100" />
                          </Link>
                          <p className="text-[11px] text-slate-400 font-mono">/{ws.slug}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-slate-200">{ws.ownerName}</p>
                        <p className="text-[11px] text-slate-400">{ws.ownerEmail}</p>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          (ws.subscription?.planKey || "").toLowerCase() === "standard"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : (ws.subscription?.planKey || "").toLowerCase() === "premium"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                            : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                        }`}>
                          {(() => {
                            const key = (ws.subscription?.planKey || "free_trial").toLowerCase();
                            if (key === "free_trial" || key === "trial") return "Free Trial";
                            if (key === "standard") return "Standard";
                            if (key === "premium") return "Premium";
                            return key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                          })()}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <StatusBadge status={ws.subscription?.status || ws.status} size="sm" />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-semibold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <Store className="w-3 h-3 text-brand-400" />
                        {ws.branchCount || 0} {ws.branchCount === 1 ? "branch" : "branches"}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {ws.enabledProducts?.length === 0 ? (
                          <span className="text-[11px] text-slate-500">None</span>
                        ) : (
                          ws.enabledProducts?.map((p: string) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 text-[10px] font-bold border border-brand-500/20"
                            >
                              {p}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          {ws.onboardingFlags?.orgProfileCompleted ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                              <CheckCircle className="w-2.5 h-2.5" /> Org Profile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/40 text-[10px] font-medium">
                              <Clock className="w-2.5 h-2.5" /> Org Profile
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {ws.onboardingFlags?.inventoryOnboardingCompleted ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-medium">
                              <CheckCircle className="w-2.5 h-2.5" /> Inventory App
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/40 text-[10px] font-medium">
                              <Clock className="w-2.5 h-2.5" /> Inventory App
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-[11px] text-slate-400">
                      {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : "—"}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="Reset Onboarding flow"
                          onClick={() => handleResetOnboarding(ws)}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {ws.status === "active" ? (
                          <button
                            title="Suspend organization"
                            onClick={() => handleSuspend(ws)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            title="Activate organization"
                            onClick={() => handleActivate(ws)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          title="Delete organization"
                          onClick={() => handleDelete(ws)}
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

      {/* Structured Suspend Organization Modal */}
      {suspendModalOrg && (
        <SuspendModal
          isOpen={!!suspendModalOrg}
          targetType="organization"
          targetName={suspendModalOrg.name}
          targetId={suspendModalOrg.id}
          isLoading={actionLoading}
          onClose={() => setSuspendModalOrg(null)}
          onConfirm={handleConfirmSuspend}
        />
      )}

      {/* Structured Delete Organization Modal */}
      {deleteModalOrg && (
        <DeleteModal
          isOpen={!!deleteModalOrg}
          targetType="organization"
          targetName={deleteModalOrg.name}
          targetId={deleteModalOrg.id}
          isLoading={actionLoading}
          onClose={() => setDeleteModalOrg(null)}
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

export default Organizations;
