import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { api } from "@/lib/api";
import {
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  Ban,
  FileText,
  Download,
  ShieldCheck,
  Mail,
  Layers,
  GitBranch,
  Users,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { toast } from "sonner";
import type { WorkspaceItem, UserWorkspaceEntry } from "@/stores/useWorkspaceStore";

function normalizeWs(w: WorkspaceItem | UserWorkspaceEntry): WorkspaceItem {
  return "workspace" in w ? w.workspace : w;
}

export const BillingSettingsPage: React.FC = () => {
  const { orgId: routeOrgId } = useParams<{ orgId?: string }>();
  const { currentWorkspace, workspaces } = useWorkspaceStore();
  const { user } = useAuthStore();

  const normalizedWorkspaces = workspaces.map(normalizeWs);
  const effectiveOrgId = routeOrgId || currentWorkspace?.id;
  const effectiveOrg = normalizedWorkspaces.find((w) => w.id === effectiveOrgId) || currentWorkspace;

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const [subData, setSubData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Billing Contact Setting
  const [billingEmail, setBillingEmail] = useState(user?.email || "");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const fetchBillingData = async () => {
    if (!effectiveOrgId) return;
    setIsLoading(true);
    try {
      let sub: any = null;
      try {
        const subRes: any = await api.get(`/billing/subscription?workspaceId=${effectiveOrgId}&organizationId=${effectiveOrgId}`);
        sub = subRes.data?.data?.subscription || subRes.data?.subscription || subRes.data;
      } catch {
        try {
          const orgSubRes: any = await api.get(`/organizations/${effectiveOrgId}/subscription`);
          sub = orgSubRes.data?.subscription || orgSubRes.data;
        } catch {}
      }

      if (sub) {
        setSubData(sub);
      }
      
      let invList: any[] = [];
      try {
        const orgInvRes: any = await api.get(`/billing/organizations/${effectiveOrgId}/invoices`);
        if (orgInvRes.data?.data && Array.isArray(orgInvRes.data.data)) {
          invList = orgInvRes.data.data;
        } else if (Array.isArray(orgInvRes.data)) {
          invList = orgInvRes.data;
        }
      } catch {}

      if (invList.length === 0) {
        try {
          const invRes: any = await api.get(`/billing/invoices?workspaceId=${effectiveOrgId}`);
          if (invRes.data?.data?.invoices && Array.isArray(invRes.data.data.invoices)) {
            invList = invRes.data.data.invoices;
          }
        } catch {}
      }
      setInvoices(invList);
    } catch {
      // Fallback gracefully
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [effectiveOrgId]);

  const planKey = (
    subData?.activePlan ||
    (subData?.status === "active" ? (subData?.selectedPlan || subData?.planKey) : null) ||
    subData?.planKey ||
    effectiveOrg?.planKey ||
    effectiveOrg?.planId ||
    "free_trial"
  ).toLowerCase();
  const isTrial = planKey === "free" || planKey === "free_trial" || planKey === "trial";
  const planName = isTrial
    ? "30-Day Free Trial"
    : planKey === "standard"
    ? "Standard Plan"
    : "Premium Enterprise Plan";

  const trialEndsAt = subData?.trialEndsAt || subData?.trialEnd;
  const currentPeriodEnd = subData?.currentPeriodEnd;
  const rawStatus = (subData?.status || (isTrial ? "trial" : "active")).toLowerCase();

  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleOpenUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeModalOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!effectiveOrgId) return;
    if (!window.confirm("Are you sure you want to cancel this organization's subscription at the end of the billing period?")) {
      return;
    }
    try {
      await api.post("/billing/cancel", { workspaceId: effectiveOrgId, organizationId: effectiveOrgId });
      toast.success("Subscription scheduled for cancellation at the end of the current period.");
      setSubData((prev: any) => ({ ...prev, cancelAtPeriodEnd: true }));
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel subscription.");
    }
  };

  const handleSaveBillingEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveOrgId) return;
    setIsSavingEmail(true);
    try {
      await api.patch(`/organizations/${effectiveOrgId}`, {
        email: billingEmail,
      }).catch(() => {});
      toast.success("Billing contact email updated successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update billing email.");
    } finally {
      setIsSavingEmail(false);
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

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold mb-2">
            <Building2 className="w-3 h-3 text-[#FDB02F]" />
            <span>Organization: {effectiveOrg?.name || "Your Business"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Subscription & Billing Details
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your organization's subscription plan, trial periods, and official receipts. Subscriptions are billed per organization.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {isTrial ? (
            <button
              onClick={() => handleOpenUpgrade("upgrade_to_standard")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition cursor-pointer shrink-0 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-[#FDB02F]" />
              <span>Upgrade to Standard</span>
            </button>
          ) : (
            <button
              onClick={handleCancelSubscription}
              disabled={subData?.cancelAtPeriodEnd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:border-rose-500/30 bg-black/40 hover:bg-rose-950/20 text-slate-300 hover:text-rose-300 text-xs font-medium transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{subData?.cancelAtPeriodEnd ? "Cancellation Scheduled" : "Cancel at Period End"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Current Plan Card */}
      <div className="p-6 rounded-2xl bg-[#140d12] border border-white/10 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c79dbd]">
              Current Active Plan
            </span>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-2xl font-bold text-white">{planName}</h2>
              {isTrial && daysLeftInTrial !== null && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{daysLeftInTrial} days remaining</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isTrial
                ? "30-Day Free Evaluation period with 1 integrated application and 1 branch limit."
                : planKey === "standard"
                ? "Standard Plan (₦7,500/month or ₦75,000/year). Multi-app and multi-branch features enabled."
                : "Premium Plan with custom enterprise limits."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isTrial
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : rawStatus === "past_due"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {isTrial ? "TRIALING" : rawStatus === "past_due" ? "PAST DUE" : "ACTIVE"}
            </span>
          </div>
        </div>

        {/* Plan Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#c79dbd]" />
              {isTrial ? "Trial Expiration" : "Current Period End"}
            </span>
            <p className="text-sm font-bold text-white">
              {isTrial && trialEndsAt
                ? formatDate(trialEndsAt)
                : currentPeriodEnd
                ? formatDate(currentPeriodEnd)
                : "Active"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#c79dbd]" />
              Rate & Billing Interval
            </span>
            <p className="text-sm font-bold text-white">
              {isTrial ? "₦0 / 30 Days" : `₦${(subData?.amount || 7500).toLocaleString()} / ${subData?.billingInterval || "monthly"}`}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#c79dbd]" />
              Billing Model
            </span>
            <p className="text-sm font-bold text-white">
              Per-Organization
            </p>
          </div>
        </div>

        {/* Features Summary */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white">Plan Features & Limits</h4>
            <Link
              to="/billing/usage"
              className="text-[11px] font-semibold text-[#c79dbd] hover:text-white flex items-center gap-1 transition"
            >
              <span>View Usage Breakdown</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Applications</span>
                <span className="font-semibold text-white">{isTrial ? "1 Application" : "Up to 3 Applications"}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2.5">
              <GitBranch className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Branches</span>
                <span className="font-semibold text-white">{isTrial ? "1 Branch / App" : "Up to 3 Branches / App"}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2.5">
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Team Members</span>
                <span className="font-semibold text-white">{isTrial ? "Up to 2 Members" : "Up to 10 Members"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Billing Settings & Payment Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Billing Contact */}
        <div className="p-6 rounded-2xl bg-[#140d12] border border-white/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Mail className="w-4 h-4 text-[#c79dbd]" />
            <h3 className="text-sm font-bold text-white">Billing Contact</h3>
          </div>
          <p className="text-xs text-slate-400">
            Official payment confirmations and PDF invoice receipts are sent to this address.
          </p>
          <form onSubmit={handleSaveBillingEmail} className="space-y-3">
            <input
              type="email"
              required
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:ring-1 focus:ring-[#714b67] outline-none"
            />
            <button
              type="submit"
              disabled={isSavingEmail}
              className="px-4 py-2 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer transition disabled:opacity-50"
            >
              {isSavingEmail ? "Saving..." : "Save Billing Email"}
            </button>
          </form>
        </div>

        {/* Payment Method Summary */}
        <div className="p-6 rounded-2xl bg-[#140d12] border border-white/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <CreditCard className="w-4 h-4 text-[#c79dbd]" />
            <h3 className="text-sm font-bold text-white">Payment Method</h3>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Paystack / Direct Transfer Checkout</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Supports Nigerian debit cards (Mastercard, Visa, Verve) and direct bank transfers with automated invoice reconciliation.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Invoice History */}
      <div className="p-6 rounded-2xl bg-[#140d12] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#c79dbd]" />
              <span>Payment History & Invoices</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Download and view past official receipts and invoices generated for {effectiveOrg?.name || "this organization"}.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-xs text-slate-400 bg-black/20 rounded-xl border border-white/5 space-y-2">
            <div className="w-5 h-5 border-2 border-[#714b67] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[11px]">Loading billing and invoice records...</p>
          </div>
        ) : invoices.length > 0 ? (
          <div className="border border-white/10 rounded-xl overflow-x-auto bg-black/30">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-semibold">Invoice #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Plan & Period</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((inv) => {
                  const invId = inv.id || inv._id || inv.invoiceNumber;
                  const formattedDate = formatDate(inv.issuedAt || inv.paidAt || inv.createdAt);
                  const planDescription = inv.items?.[0]?.description || "Orviohub Standard Plan";

                  return (
                    <tr key={invId} className="hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#FDB02F]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {formattedDate}
                      </td>
                      <td className="py-3.5 px-4 text-white font-medium">
                        {planDescription}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        ₦{Number(inv.amount || 0).toLocaleString("en-NG")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {inv.status || "paid"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/invoices/${invId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#714b67]/20 hover:bg-[#714b67]/40 border border-[#714b67]/40 text-white text-[11px] font-medium transition cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-[#c79dbd]" />
                          <span>View Invoice</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-slate-400 bg-black/20 rounded-xl border border-white/5 space-y-1">
            <FileText className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">No invoices generated yet</p>
            <p className="text-[11px]">Invoices will appear here automatically when your organization activates or renews a Standard subscription.</p>
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={effectiveOrgId || ""}
        workspaceSlug={effectiveOrg?.slug || "org"}
        triggerReason={upgradeReason}
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={() => {
          fetchBillingData();
        }}
      />
    </div>
  );
};

export default BillingSettingsPage;
