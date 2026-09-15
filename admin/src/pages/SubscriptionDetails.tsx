import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Building2,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Edit2,
  FileText,
  DollarSign,
  Save,
  X,
} from "lucide-react";
import { adminBillingApi } from "../api/adminBilling";
import { RecordPaymentModal } from "../components/RecordPaymentModal";

export const SubscriptionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit Subscription Modal / Form State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPlanKey, setEditPlanKey] = useState("standard");
  const [editStatus, setEditStatus] = useState("active");
  const [editInterval, setEditInterval] = useState<"monthly" | "annual">("monthly");
  const [editTrialEndsAtDate, setEditTrialEndsAtDate] = useState("");
  const [editPeriodEndDate, setEditPeriodEndDate] = useState("");
  const [editCancelAtPeriodEnd, setEditCancelAtPeriodEnd] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const fetchSubscription = async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await adminBillingApi.getSubscription(id);
      if (data) {
        setSubscription(data);
        setEditPlanKey(data.planKey || "standard");
        setEditStatus(data.status || "active");
        setEditInterval(data.billingInterval || "monthly");
        setEditCancelAtPeriodEnd(Boolean(data.cancelAtPeriodEnd));

        if (data.trialEndsAt || data.trialEnd) {
          const tDate = new Date(data.trialEndsAt || data.trialEnd);
          setEditTrialEndsAtDate(tDate.toISOString().split("T")[0]);
        }
        if (data.currentPeriodEnd) {
          const pDate = new Date(data.currentPeriodEnd);
          setEditPeriodEndDate(pDate.toISOString().split("T")[0]);
        }
      } else {
        setErrorMessage("Subscription not found.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load subscription details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [id]);

  const handleAdjustSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription) return;

    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      let trialTimestamp = undefined;
      if (editTrialEndsAtDate) {
        trialTimestamp = new Date(editTrialEndsAtDate).getTime();
      }

      let periodEndTimestamp = undefined;
      if (editPeriodEndDate) {
        periodEndTimestamp = new Date(editPeriodEndDate).getTime();
      }

      await adminBillingApi.adjustSubscription({
        subscriptionId: subscription._id || subscription.id,
        planKey: editPlanKey,
        status: editStatus,
        billingInterval: editInterval,
        trialEndsAt: trialTimestamp,
        currentPeriodEnd: periodEndTimestamp,
        cancelAtPeriodEnd: editCancelAtPeriodEnd,
        notes: editNotes || "Adjusted via superadmin subscription control panel",
      });

      setSuccessMessage("Subscription successfully updated!");
      setEditModalOpen(false);
      fetchSubscription();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to adjust subscription.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickExtendTrial = async (days: number) => {
    if (!subscription) return;
    setActionLoading(true);
    try {
      const currentExpiry = subscription.trialEndsAt || subscription.trialEnd || Date.now();
      const base = currentExpiry > Date.now() ? currentExpiry : Date.now();
      const newExpiry = base + days * 86_400_000;

      await adminBillingApi.adjustSubscription({
        subscriptionId: subscription._id || subscription.id,
        trialEndsAt: newExpiry,
        status: "trialing",
        notes: `Trial extended by +${days} days by superadmin`,
      });

      setSuccessMessage(`Trial extended by ${days} days.`);
      fetchSubscription();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to extend trial.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!subscription) return;
    if (!window.confirm(`Are you sure you want to mark this subscription as "${newStatus.toUpperCase()}"?`)) return;

    setActionLoading(true);
    try {
      await adminBillingApi.adjustSubscription({
        subscriptionId: subscription._id || subscription.id,
        status: newStatus,
        notes: `Status changed to ${newStatus} by superadmin`,
      });
      setSuccessMessage(`Subscription status set to "${newStatus}".`);
      fetchSubscription();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update status.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (ts?: number) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Active (Paid)
          </span>
        );
      case "trial":
      case "trialing":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Free Trial
          </span>
        );
      case "past_due":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Past Due
          </span>
        );
      case "canceled":
      case "cancelled":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Canceled
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
        <p className="text-sm font-medium">Loading subscription details...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Subscription Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested subscription ID <code className="font-mono text-emerald-400">{id}</code> could not be found.
        </p>
        <Link
          to="/subscriptions"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Subscriptions
        </Link>
      </div>
    );
  }

  const org = subscription.organization;
  const plan = subscription.plan;
  const isTrial = (subscription.planKey || "").includes("free") || subscription.status === "trialing" || subscription.status === "trial";

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/subscriptions")}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Subscription: {org?.name || "Organization"}
              </h1>
              {getStatusBadge(subscription.status)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">ID: {subscription._id || id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Adjust Subscription
          </button>
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organization Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              Organization Profile
            </span>
            {org?._id && (
              <Link
                to={`/organizations/${org._id}`}
                className="text-xs text-emerald-400 hover:underline font-semibold"
              >
                View Details →
              </Link>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-500 block">Name</span>
              <span className="text-sm font-bold text-white">{org?.name || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Slug / Identifier</span>
              <span className="font-mono text-slate-300">{org?.slug || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Category / Industry</span>
              <span className="text-slate-200">{org?.category || "Retail / Business"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Address & Currency</span>
              <span className="text-slate-200">
                {org?.address || "Nigeria"} • <strong className="text-emerald-400">{org?.currency || "NGN"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Plan Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-400" />
              Plan & Billing Tier
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {subscription.billingInterval || "monthly"}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-500 block">Active Plan</span>
              <span className="text-sm font-bold text-white capitalize">
                {plan?.name || subscription.planKey || "Standard"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Rate</span>
              <span className="text-base font-extrabold text-emerald-400">
                ₦{((subscription.amount ?? (subscription.planKey === "premium" ? 20000 : 7500))).toLocaleString()}
                <span className="text-xs font-normal text-slate-400"> / {subscription.billingInterval || "month"}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Applications & Branches Quota</span>
              <span className="text-slate-200 font-medium">
                {plan?.features?.maxApplications || 3} Apps • {plan?.features?.maxBranchesPerApplication || 3} Branches/app
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Auto-Renew Status</span>
              <span className={subscription.cancelAtPeriodEnd ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {subscription.cancelAtPeriodEnd ? "Cancels at Period End" : "Active Auto-Renewal"}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline & Quick Controls */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-400" />
              Dates & Quick Actions
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {isTrial && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-purple-300 font-semibold block">Trial Expiration</span>
                <span className="text-sm font-bold text-purple-200">
                  {formatDate(subscription.trialEndsAt || subscription.trialEnd)}
                </span>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-purple-500/20">
                  <span className="text-[11px] text-purple-300">Quick Extend:</span>
                  <button
                    onClick={() => handleQuickExtendTrial(7)}
                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[10px] font-bold"
                  >
                    +7 Days
                  </button>
                  <button
                    onClick={() => handleQuickExtendTrial(14)}
                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[10px] font-bold"
                  >
                    +14 Days
                  </button>
                  <button
                    onClick={() => handleQuickExtendTrial(30)}
                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[10px] font-bold"
                  >
                    +30 Days
                  </button>
                </div>
              </div>
            )}

            <div>
              <span className="text-slate-500 block">Current Period Start</span>
              <span className="text-slate-200">{formatDate(subscription.currentPeriodStart)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Current Period End / Renewal</span>
              <span className="text-slate-200 font-semibold">{formatDate(subscription.currentPeriodEnd)}</span>
            </div>

            <div className="pt-2 flex flex-wrap gap-1.5">
              <span className="text-slate-500 text-[11px] w-full block">Set Status:</span>
              <button
                onClick={() => handleQuickStatusChange("active")}
                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/20"
              >
                Mark Active
              </button>
              <button
                onClick={() => handleQuickStatusChange("past_due")}
                className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold border border-rose-500/20"
              >
                Mark Past Due
              </button>
              <button
                onClick={() => handleQuickStatusChange("canceled")}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700"
              >
                Mark Canceled
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Invoices & Receipts</h2>
          </div>
          <span className="text-xs text-slate-400">
            {subscription.invoices?.length || 0} Total Generated
          </span>
        </div>

        {(!subscription.invoices || subscription.invoices.length === 0) ? (
          <p className="text-xs text-slate-500 py-4 text-center">No invoices recorded yet for this organization.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscription.invoices.map((inv: any) => (
                  <tr key={inv._id || inv.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                    <td className="py-2.5 px-3">{formatDate(inv.issuedAt || inv.createdAt)}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      ₦{(inv.amount || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inv.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {inv.paymentReference || inv.paystackPaymentId || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments History Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Payment Transactions</h2>
          </div>
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="text-xs text-emerald-400 hover:underline font-semibold flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Record New Payment
          </button>
        </div>

        {(!subscription.payments || subscription.payments.length === 0) ? (
          <p className="text-xs text-slate-500 py-4 text-center">No payment transactions recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscription.payments.map((pm: any) => (
                  <tr key={pm._id || pm.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3">{formatDate(pm.completedAt || pm.createdAt)}</td>
                    <td className="py-2.5 px-3 uppercase font-semibold text-slate-200">
                      {pm.provider || pm.paymentMethod || "paystack"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      ₦{(pm.amount || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {pm.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {pm.reference || pm.providerReference || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Subscription Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Adjust Subscription</h2>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubscription} className="space-y-4 text-xs">
              {/* Plan Key */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Plan Tier</label>
                <select
                  value={editPlanKey}
                  onChange={(e) => setEditPlanKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                >
                  <option value="free_trial">Free Trial (30-Day Evaluation)</option>
                  <option value="standard">Standard Plan (Paid)</option>
                  <option value="premium">Premium Enterprise Plan</option>
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Subscription Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="trialing">Trialing (Free Trial Active)</option>
                  <option value="past_due">Past Due (Grace Period)</option>
                  <option value="canceled">Canceled</option>
                  <option value="suspended">Suspended / Expired</option>
                </select>
              </div>

              {/* Billing Cycle */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Billing Interval</label>
                <select
                  value={editInterval}
                  onChange={(e) => setEditInterval(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              {/* Trial End Date */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Trial End Date (if trialing)</label>
                <input
                  type="date"
                  value={editTrialEndsAtDate}
                  onChange={(e) => setEditTrialEndsAtDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                />
              </div>

              {/* Current Period End Date */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Period End / Renewal Date</label>
                <input
                  type="date"
                  value={editPeriodEndDate}
                  onChange={(e) => setEditPeriodEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
                />
              </div>

              {/* Cancel at period end checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editCancelAtPeriodEnd}
                  onChange={(e) => setEditCancelAtPeriodEnd(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className="text-slate-300 text-xs">Cancel subscription at the end of the billing period</span>
              </label>

              {/* Notes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-slate-300 font-semibold block">Admin Audit Reason / Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Reason for adjusting this organization's subscription..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{actionLoading ? "Saving Changes..." : "Save Adjustments"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={paymentModalOpen}
        workspaceId={subscription.workspaceId || subscription.organizationId || id || ""}
        workspaceName={org?.name || subscription.organizationName || "Organization"}
        currentPlanKey={subscription.planKey || "standard"}
        adminUserId="superadmin_control_panel"
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage("Manual payment successfully recorded and invoice generated!");
          fetchSubscription();
        }}
      />
    </div>
  );
};
