import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { api } from "@/lib/api";
import {
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  Ban,
} from "lucide-react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { toast } from "sonner";

export const BillingSettingsPage: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const [subData, setSubData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const fetchBillingData = async () => {
      if (!currentWorkspace?.id) return;
      try {
        const subRes: any = await api.get(`/billing/subscription?workspaceId=${currentWorkspace.id}`);
        if (subRes.data?.data?.subscription) {
          setSubData(subRes.data.data.subscription);
        }
        const invRes: any = await api.get(`/billing/invoices?workspaceId=${currentWorkspace.id}`);
        if (invRes.data?.data?.invoices) {
          setInvoices(invRes.data.data.invoices);
        }
      } catch {
        // Fallback gracefully
      }
    };
    fetchBillingData();
  }, [currentWorkspace?.id]);

  const planKey = (subData?.planKey || currentWorkspace?.planId || "free_trial").toLowerCase();
  const isTrial = planKey === "free" || planKey === "free_trial";
  const planName = isTrial
    ? "30-Day Free Trial"
    : planKey === "standard"
    ? "Standard Plan"
    : "Premium Plan";

  const trialEndsAt = subData?.trialEndsAt;
  const currentPeriodEnd = subData?.currentPeriodEnd;

  const handleOpenUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeModalOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!currentWorkspace?.id) return;
    if (!window.confirm("Are you sure you want to cancel this organization's subscription at the end of the billing period?")) {
      return;
    }
    try {
      await api.post("/billing/cancel", { workspaceId: currentWorkspace.id });
      toast.success("Subscription scheduled for cancellation at the end of the current period.");
      setSubData((prev: any) => ({ ...prev, cancelAtPeriodEnd: true }));
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel subscription.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold mb-2">
            <Building2 className="w-3 h-3" />
            <span>Organization Billing: {currentWorkspace?.name || "Current Business"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Subscription & Billing
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your organization's subscription plan, trial periods, and payment receipts. Each business is billed independently.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {isTrial ? (
            <button
              onClick={() => handleOpenUpgrade("upgrade_to_standard")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
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

      {/* Subscription Card */}
      <div className="p-6 rounded-2xl bg-[#140d12] border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c79dbd]">
              Active Organization Plan
            </span>
            <h2 className="text-2xl font-bold text-white mt-1">{planName}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {isTrial
                ? "30-Day Free Evaluation for testing inventory, branches, and team access."
                : planKey === "standard"
                ? "Standard Plan: ₦7,500/month (or ₦75,000/year). Multi-branch, multi-user access enabled."
                : "Premium Plan with enterprise scale and custom limits."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isTrial
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {isTrial ? "TRIALING" : "ACTIVE"}
            </span>
          </div>
        </div>

        {/* Plan Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#c79dbd]" />
              {isTrial ? "Trial Ends On" : "Billing Period End"}
            </span>
            <p className="text-sm font-bold text-white">
              {isTrial && trialEndsAt
                ? new Date(trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : currentPeriodEnd
                ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "14 Days Remaining"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#c79dbd]" />
              Billing Boundary
            </span>
            <p className="text-sm font-bold text-white">
              Per-Organization Only
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#c79dbd]" />
              Organization
            </span>
            <p className="text-sm font-bold text-white truncate">
              {currentWorkspace?.name || "Current Organization"}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="p-6 rounded-2xl bg-[#140d12] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Payment & Receipt History</h3>
            <p className="text-xs text-slate-400">Past subscription receipts and payments recorded for this organization.</p>
          </div>
        </div>

        {invoices.length > 0 ? (
          <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-black/30">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-white">{inv.invoiceNumber}</div>
                  <div className="text-slate-400 text-[11px]">
                    {new Date(inv.paidAt || Date.now()).toLocaleDateString()} &bull; {inv.items?.[0]?.description || "Subscription"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white">₦{Number(inv.amount || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-emerald-400 font-medium uppercase">{inv.status || "Paid"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 bg-black/20 rounded-xl border border-white/5">
            No previous paid receipts recorded for this organization.
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={currentWorkspace?.id || ""}
        workspaceSlug={currentWorkspace?.slug || "org"}
        triggerReason={upgradeReason}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </div>
  );
};
export default BillingSettingsPage;
