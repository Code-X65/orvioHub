import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Shield,
  Package,
  MapPin,
  Loader2,
  Ban,
  Power,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminOrganizationsApi } from "../api/adminOrganizations";
import { adminBillingApi, ManualPaymentRecord } from "../api/adminBilling";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { RecordPaymentModal } from "../components/RecordPaymentModal";

export const OrganizationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { sessionToken, admin } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [manualPayments, setManualPayments] = useState<ManualPaymentRecord[]>([]);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);

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

  const loadDetails = async () => {
    if (!id || !sessionToken) return;
    try {
      const [res, payments] = await Promise.all([
        adminOrganizationsApi.getOrganizationDetails(sessionToken, id),
        adminBillingApi.listManualPayments(id),
      ]);
      setData(res);
      setManualPayments(payments || []);
    } catch (err) {
      console.error("Failed to load organization details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [sessionToken, id]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400">Loading organization topology and products...</p>
      </div>
    );
  }

  if (!data?.organization) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-sm text-slate-400">Organization not found.</p>
        <Link
          to="/organizations"
          className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300"
        >
          <ArrowLeft className="w-4 h-4" /> Back to organizations
        </Link>
      </div>
    );
  }

  const org = data.organization;
  const owner = data.owner;
  const members = data.members || [];
  const products = data.products || [];
  const branches = data.branches || [];

  const handleToggleProduct = (productKey: string, isCurrentlyActive: boolean) => {
    setDialogConfig({
      isOpen: true,
      title: isCurrentlyActive ? `Disable Product: ${productKey}` : `Enable Product: ${productKey}`,
      message: isCurrentlyActive
        ? `Disable ${productKey} for "${org.name}"? Workspace members will lose access immediately.`
        : `Activate ${productKey} for "${org.name}"?`,
      confirmLabel: isCurrentlyActive ? "Disable Product" : "Enable Product",
      isDestructive: isCurrentlyActive,
      action: async () => {
        setActionLoading(true);
        try {
          if (isCurrentlyActive) {
            await adminOrganizationsApi.disableProduct(sessionToken!, org.id, productKey);
          } else {
            await adminOrganizationsApi.enableProduct(sessionToken!, org.id, productKey);
          }
          await loadDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSuspend = () => {
    setDialogConfig({
      isOpen: true,
      title: "Suspend Organization",
      message: `Suspend "${org.name}"?`,
      confirmLabel: "Suspend",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminOrganizationsApi.suspendOrganization(sessionToken!, org.id);
          await loadDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleActivate = () => {
    setDialogConfig({
      isOpen: true,
      title: "Activate Organization",
      message: `Reactivate "${org.name}"?`,
      confirmLabel: "Activate",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminOrganizationsApi.activateOrganization(sessionToken!, org.id);
          await loadDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/organizations"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Organizations
        </Link>

        <div className="flex items-center gap-2">
          {org.status === "active" ? (
            <button
              onClick={handleSuspend}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend Organization</span>
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Activate Organization</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-brand-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-indigo-600/30 shrink-0">
            {org.name?.charAt(0)?.toUpperCase() || "O"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white">{org.name}</h1>
              <StatusBadge status={org.status} size="sm" />
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Slug: /{org.slug} • Type: <span className="uppercase">{org.type}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Workspace ID: <span className="font-mono text-slate-400">{org.id}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Owner</span>
            {owner ? (
              <Link to={`/users/${owner.id}`} className="font-semibold text-brand-400 hover:underline block mt-0.5">
                {owner.name}
              </Link>
            ) : (
              <span className="text-slate-400 block mt-0.5">Unassigned</span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Location</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {org.country || "Nigeria"} ({org.currency || "NGN"})
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Provisioned</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Subscription & Plan Management Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Subscription & Plan Tier</h2>
              <p className="text-xs text-slate-400">Current tier entitlements, plan limits, and manual overrides.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRecordPaymentOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Record Payment
            </button>

            <span className="text-xs text-slate-400 font-medium">Change Tier:</span>
            <select
              value={org.planId || "free"}
              onChange={async (e) => {
                const newPlan = e.target.value;
                setActionLoading(true);
                try {
                  await adminBillingApi.changeWorkspacePlan(org.id, newPlan);
                  await loadDetails();
                } catch (err: any) {
                  alert(err.message || "Failed to change plan.");
                } finally {
                  setActionLoading(false);
                }
              }}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-brand-500 uppercase cursor-pointer"
            >
              <option value="free">Free (₦0/mo)</option>
              <option value="standard">Standard (₦7,500/mo)</option>
              <option value="premium">Premium (₦20,000/mo)</option>
            </select>
          </div>
        </div>

        {/* Plan Limits & Live Resource Usage */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Active Apps</span>
            <p className="text-xl font-bold text-white">{products.length} <span className="text-xs font-normal text-slate-400">apps</span></p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Team Members</span>
            <p className="text-xl font-bold text-white">{members.length} <span className="text-xs font-normal text-slate-400">members</span></p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Branches</span>
            <p className="text-xl font-bold text-white">{branches.length} <span className="text-xs font-normal text-slate-400">locations</span></p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Subscription Status</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1">
              Active
            </span>
          </div>
        </div>

        {/* Offline Payment History */}
        {manualPayments.length > 0 && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Offline Payment History ({manualPayments.length})
              </h3>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Method & Ref</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {manualPayments.map((p) => (
                    <tr key={p._id || p.paymentReference} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3">
                        {new Date(p.paidAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-200 uppercase">{p.planKey}</span> ({p.billingCycle})
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        ₦{(p.amount / 100).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-slate-200 capitalize">{p.paymentMethod.replace("_", " ")}</span>
                        <p className="text-[10px] text-slate-400 font-mono">{p.paymentReference}</p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {p.recordedByName || "Admin"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Products & Members */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enabled Products Control */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Product Activations ({products.length})</h3>
            </div>
          </div>

          <div className="space-y-3">
            {["inventory", "taskmanagement", "crm"].map((productKey) => {
              const activeProd = products.find((p: any) => p.productKey === productKey);
              const isActive = activeProd && (activeProd.status === "ACTIVE" || activeProd.status === "active");

              return (
                <div
                  key={productKey}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-white uppercase">{productKey}</p>
                    <p className="text-[11px] text-slate-400">
                      {isActive
                        ? `Active since ${new Date(activeProd.activatedAt || Date.now()).toLocaleDateString()}`
                        : "Not activated for this workspace"}
                    </p>
                  </div>

                  <button
                    onClick={() => handleToggleProduct(productKey, !!isActive)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                      isActive
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{isActive ? "Disable" : "Enable"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workspace Members */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Team Members ({members.length})</h3>
          </div>

          {members.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No members found.</p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {members.map((m: any) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <Link
                      to={`/users/${m.userId}`}
                      className="font-bold text-white hover:text-brand-400 transition"
                    >
                      {m.name}
                    </Link>
                    <p className="text-[11px] text-slate-400">{m.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-bold text-[10px] border border-indigo-500/20">
                      {m.role}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Joined: {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branches & Topology */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">Registered Branches ({branches.length})</h3>
        </div>

        {branches.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No physical branch locations registered (Default single-store setup).
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {branches.map((b: any) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-white">{b.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">Code: {b.code || "MAIN"}</p>
                </div>
                <StatusBadge status={b.status || "active"} size="sm" />
              </div>
            ))}
          </div>
        )}
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

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        workspaceId={org.id}
        workspaceName={org.name}
        currentPlanKey={org.planId || "standard"}
        adminUserId={admin?.id || "admin_user"}
        onClose={() => setIsRecordPaymentOpen(false)}
        onSuccess={() => {
          loadDetails();
        }}
      />
    </div>
  );
};

export default OrganizationDetails;
