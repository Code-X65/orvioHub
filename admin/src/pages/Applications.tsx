import React, { useEffect, useState } from "react";
import {
  LayoutGrid,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Archive,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Sliders,
  History,
  Check,
  X,
  Lock,
} from "lucide-react";
import { adminApplicationsApi, type PlatformApplication } from "../api/adminApplications";
import { useAuth } from "../hooks/useAuth";
import { canAdmin } from "../auth/permissions";
import ConfirmDialog from "../components/ConfirmDialog";

const AVAILABLE_PLANS = [
  { key: "free_trial", label: "Free Trial" },
  { key: "free", label: "Free Tier" },
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
  { key: "enterprise", label: "Enterprise" },
];

export const Applications: React.FC = () => {
  const { sessionToken, admin } = useAuth();
  const canManageApplications = canAdmin(admin?.role, "admin.applications.manage");
  const [applications, setApplications] = useState<PlatformApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<PlatformApplication | null>(null);
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    status: "active" as "active" | "coming_soon" | "maintenance" | "deprecated",
    isCore: false,
    planRequirements: ["standard", "premium"] as string[],
    subdomain: "",
    description: "",
    badge: "",
    displayOrder: 1,
  });

  // Audit Logs Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedAppForAudit, setSelectedAppForAudit] = useState<PlatformApplication | null>(null);

  // Confirm dialog
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

  const loadApplications = async () => {
    try {
      setLoading(true);
      const apps = await adminApplicationsApi.listApplications();
      setApplications(apps || []);
    } catch (err) {
      console.error("Failed to load platform applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [sessionToken]);

  const handleOpenCreate = () => {
    if (!canManageApplications) return;
    setEditingApp(null);
    setFormData({
      key: "",
      name: "",
      status: "coming_soon",
      isCore: false,
      planRequirements: ["standard", "premium"],
      subdomain: "",
      description: "",
      badge: "",
      displayOrder: (applications.length || 0) + 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (app: PlatformApplication) => {
    if (!canManageApplications) return;
    setEditingApp(app);
    setFormData({
      key: app.key,
      name: app.name,
      status: app.status,
      isCore: app.isCore,
      planRequirements: app.planRequirements || ["standard", "premium"],
      subdomain: app.subdomain || app.key,
      description: app.description || "",
      badge: app.badge || "",
      displayOrder: app.displayOrder || 1,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key.trim() || !formData.name.trim()) return;

    try {
      setActionLoading(true);
      if (!sessionToken) throw new Error("Admin session expired. Please sign in again.");
      if (editingApp) {
        await adminApplicationsApi.updateApplication(sessionToken, editingApp.key, {
          name: formData.name,
          status: formData.status,
          isCore: formData.isCore,
          planRequirements: formData.planRequirements,
          subdomain: formData.subdomain || formData.key,
          description: formData.description,
          badge: formData.badge,
          displayOrder: formData.displayOrder,
        });
      } else {
        await adminApplicationsApi.createApplication(sessionToken, {
          key: formData.key.toLowerCase().trim(),
          name: formData.name,
          status: formData.status,
          isCore: formData.isCore,
          planRequirements: formData.planRequirements,
          subdomain: formData.subdomain || formData.key.toLowerCase().trim(),
          description: formData.description,
          badge: formData.badge,
          displayOrder: formData.displayOrder,
        });
      }
      setIsModalOpen(false);
      await loadApplications();
    } catch (err: any) {
      alert(err.message || "Failed to save application.");
    } finally {
      setActionLoading(false);
    }
  };

  const togglePlanRequirement = (planKey: string) => {
    setFormData((prev) => {
      const exists = prev.planRequirements.includes(planKey);
      if (exists) {
        return {
          ...prev,
          planRequirements: prev.planRequirements.filter((p) => p !== planKey),
        };
      } else {
        return {
          ...prev,
          planRequirements: [...prev.planRequirements, planKey],
        };
      }
    });
  };

  const handleDelete = (app: PlatformApplication) => {
    if (!canManageApplications) return;
    if (app.isCore) {
      alert(`${app.name} is a core application and cannot be deleted.`);
      return;
    }
    setDialogConfig({
      isOpen: true,
      title: `Delete Application: ${app.name}`,
      message: `Are you sure you want to delete "${app.name}" (${app.key})? This action cannot be undone.`,
      isDestructive: true,
      confirmLabel: "Delete Application",
      action: async () => {
        try {
          setActionLoading(true);
          if (!sessionToken) throw new Error("Admin session expired. Please sign in again.");
          await adminApplicationsApi.deleteApplication(sessionToken, app.key);
          await loadApplications();
        } catch (err: any) {
          alert(err.message || "Failed to delete application.");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.subdomain && app.subdomain.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = applications.filter((a) => a.status === "active").length;
  const coreCount = applications.filter((a) => a.isCore).length;
  const comingSoonCount = applications.filter((a) => a.status === "coming_soon").length;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "coming_soon":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Coming Soon
          </span>
        );
      case "maintenance":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <AlertTriangle className="w-3 h-3" />
            Maintenance
          </span>
        );
      case "deprecated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Archive className="w-3 h-3" />
            Deprecated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-brand-400" />
            Platform Applications Registry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Centrally manage application modules, platform entitlement rules, and core protection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadApplications}
            disabled={loading}
            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canManageApplications && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Register Application
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Registered</div>
          <div className="text-2xl font-bold text-white mt-1">{applications.length}</div>
          <div className="text-xs text-slate-500 mt-1">Catalog applications in database</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Active Apps</div>
          <div className="text-2xl font-bold text-white mt-1">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-1">Live & activatable by eligible tenants</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Core Protected</div>
          <div className="text-2xl font-bold text-white mt-1">{coreCount}</div>
          <div className="text-xs text-slate-500 mt-1">Protected from tenant deactivation</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-xs font-medium text-amber-400 uppercase tracking-wider">Coming Soon</div>
          <div className="text-2xl font-bold text-white mt-1">{comingSoonCount}</div>
          <div className="text-xs text-slate-500 mt-1">In roadmap / waitlist preview mode</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, key, or subdomain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="coming_soon">Coming Soon</option>
            <option value="maintenance">Maintenance</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Application</th>
                <th className="py-3.5 px-4">Subdomain</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Protection</th>
                <th className="py-3.5 px-4">Plan Requirements</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-400 mb-2" />
                    Loading platform applications...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No applications matched the search criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.key} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white">
                          {app.badge ? (
                            <span className="text-xs text-brand-400 uppercase">{app.badge.slice(0, 2)}</span>
                          ) : (
                            <LayoutGrid className="w-5 h-5 text-brand-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            {app.name}
                            {app.badge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                                {app.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-400">{app.key}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="font-mono text-xs text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        {app.subdomain}.orviohub.com
                      </span>
                    </td>

                    <td className="py-4 px-4">{renderStatusBadge(app.status)}</td>

                    <td className="py-4 px-4">
                      {app.isCore ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          <Lock className="w-3 h-3" />
                          Core Protected
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Optional Module</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {app.planRequirements && app.planRequirements.length > 0 ? (
                          app.planRequirements.map((p) => (
                            <span
                              key={p}
                              className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">All Plans</span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedAppForAudit(app);
                            setIsAuditModalOpen(true);
                          }}
                          title="View Lifecycle History"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {canManageApplications && <>
                          <button
                            onClick={() => handleOpenEdit(app)}
                            title="Edit Application Settings"
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!app.isCore && (
                            <button
                              onClick={() => handleDelete(app)}
                              title="Delete Application"
                              className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-400" />
                {editingApp ? `Edit Application: ${editingApp.name}` : "Register New Platform Application"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Application Key *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingApp)}
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().trim() })}
                    placeholder="e.g. inventory, pos, gym"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white disabled:opacity-50 focus:outline-none focus:border-brand-500 transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Inventory Management"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Subdomain *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().trim() })}
                    placeholder="inventory"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 transition"
                  >
                    <option value="active">Active (Activatable)</option>
                    <option value="coming_soon">Coming Soon</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Badge (Optional)
                </label>
                <input
                  type="text"
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  placeholder="e.g. Flagship, Coming Soon, Beta"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of application features and purpose"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              {/* Core Application Checkbox */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isCore"
                  checked={formData.isCore}
                  onChange={(e) => setFormData({ ...formData, isCore: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-brand-600 bg-slate-900 border-slate-700 focus:ring-brand-500"
                />
                <label htmlFor="isCore" className="text-xs text-slate-300 cursor-pointer">
                  <span className="font-semibold text-white block">Core Platform Application</span>
                  When enabled, organization owners and members cannot deactivate or uninstall this application.
                </label>
              </div>

              {/* Plan Requirements Multi-Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Required Subscription Plans
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Select all subscription tiers permitted to activate and access this application module:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PLANS.map((plan) => {
                    const selected = formData.planRequirements.includes(plan.key);
                    return (
                      <button
                        type="button"
                        key={plan.key}
                        onClick={() => togglePlanRequirement(plan.key)}
                        className={`p-2 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition ${
                          selected
                            ? "bg-brand-600/10 border-brand-500/40 text-brand-300"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {plan.label}
                        {selected && <Check className="w-3.5 h-3.5 text-brand-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingApp ? "Save Changes" : "Create Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {isAuditModalOpen && selectedAppForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-brand-400" />
                Lifecycle History: {selectedAppForAudit.name}
              </h2>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">Application Key: <span className="text-white font-mono">{selectedAppForAudit.key}</span></div>
                <div className="text-slate-400">Current Status: <span className="text-white capitalize">{selectedAppForAudit.status}</span></div>
                <div className="text-slate-400">Core Status: <span className="text-white">{selectedAppForAudit.isCore ? "Protected Core" : "Standard Module"}</span></div>
              </div>

              <div className="border-l-2 border-slate-800 ml-3 pl-4 space-y-4 text-xs">
                <div>
                  <div className="text-slate-200 font-semibold">Application Registered</div>
                  <div className="text-slate-500">Registry initialization event</div>
                </div>
                <div>
                  <div className="text-slate-200 font-semibold">Plan Requirements Configured</div>
                  <div className="text-slate-500">Tiers: {selectedAppForAudit.planRequirements?.join(", ") || "All"}</div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        isDestructive={dialogConfig.isDestructive}
        confirmLabel={dialogConfig.confirmLabel}
        onConfirm={dialogConfig.action}
        onCancel={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Applications;
