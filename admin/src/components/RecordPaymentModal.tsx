import React, { useState, useEffect } from "react";
import { X, CreditCard, CheckCircle, Calendar, Hash, AlertCircle, Loader2 } from "lucide-react";
import { adminBillingApi } from "../api/adminBilling";

interface RecordPaymentModalProps {
  isOpen: boolean;
  workspaceId: string;
  workspaceName: string;
  currentPlanKey?: string;
  adminUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  workspaceId,
  workspaceName,
  currentPlanKey = "standard",
  adminUserId,
  onClose,
  onSuccess,
}) => {
  const [planKey, setPlanKey] = useState<string>("standard");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [amountNaira, setAmountNaira] = useState<number>(7500);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [extensionDays, setExtensionDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialPlan = currentPlanKey === "premium" ? "premium" : "standard";
      setPlanKey(initialPlan);
      setBillingCycle("monthly");
      setAmountNaira(initialPlan === "premium" ? 20000 : 7500);
      setExtensionDays(30);
      setPaymentReference("");
      setNotes("");
      setError(null);
    }
  }, [isOpen, currentPlanKey]);

  // Sync default amount and extension days when plan or cycle changes
  const handlePlanChange = (newPlan: string) => {
    setPlanKey(newPlan);
    if (billingCycle === "annual") {
      setAmountNaira(newPlan === "premium" ? 200000 : 75000);
    } else {
      setAmountNaira(newPlan === "premium" ? 20000 : 7500);
    }
  };

  const handleCycleChange = (newCycle: "monthly" | "annual") => {
    setBillingCycle(newCycle);
    if (newCycle === "annual") {
      setAmountNaira(planKey === "premium" ? 200000 : 75000);
      setExtensionDays(365);
    } else {
      setAmountNaira(planKey === "premium" ? 20000 : 7500);
      setExtensionDays(30);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentReference.trim()) {
      setError("Please enter a payment reference or receipt number.");
      return;
    }
    if (amountNaira <= 0) {
      setError("Please enter a valid amount in Naira.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await adminBillingApi.recordManualPayment({
        workspaceId,
        planKey,
        amount: Math.round(amountNaira * 100), // convert to kobo
        currency: "NGN",
        billingCycle,
        paymentReference: paymentReference.trim(),
        paymentMethod,
        recordedBy: adminUserId,
        notes: notes.trim() || undefined,
        extensionDays: Number(extensionDays) || (billingCycle === "annual" ? 365 : 30),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-xl w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Offline / Manual Payment</h2>
              <p className="text-xs text-slate-400">
                Workspace: <span className="text-slate-200 font-medium">{workspaceName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Plan & Cycle Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Plan Tier
              </label>
              <select
                value={planKey}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
              >
                <option value="standard">Standard Plan</option>
                <option value="premium">Premium Plan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Billing Cycle
              </label>
              <select
                value={billingCycle}
                onChange={(e) => handleCycleChange(e.target.value as "monthly" | "annual")}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
              >
                <option value="monthly">Monthly (+30 days)</option>
                <option value="annual">Annual (+365 days)</option>
              </select>
            </div>
          </div>

          {/* Amount (₦) & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount Paid (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₦</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={amountNaira}
                  onChange={(e) => setAmountNaira(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-mono font-medium focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Channel
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
              >
                <option value="bank_transfer">Direct Bank Transfer</option>
                <option value="pos">POS Terminal</option>
                <option value="cash">Cash Payment</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other / Invoicing</option>
              </select>
            </div>
          </div>

          {/* Reference & Extension Days */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Reference / Receipt #
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. GTB-NIP-9481948"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Days to Extend
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="number"
                  min="1"
                  max="730"
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Internal Admin Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Paid via corporate account transfer, invoice #INV-2026-081"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Record & Extend Plan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
