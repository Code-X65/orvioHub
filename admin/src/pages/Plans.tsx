import React, { useEffect, useState } from "react";
import {
  CreditCard,
  RefreshCw,
  Loader2,
  Edit2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  Zap,
  Crown,
  X,
} from "lucide-react";
import { adminBillingApi, type PlanRecord } from "../api/adminBilling";

export const Plans: React.FC = () => {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Modal State
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    monthlyPriceNaira: 0,
    annualPriceNaira: 0,
    isActive: true,
  });

  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await adminBillingApi.listPlans();
      setPlans(res || []);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleOpenEdit = (plan: PlanRecord) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      monthlyPriceNaira: (plan.monthlyPrice || 0) / 100,
      annualPriceNaira: (plan.annualPrice || 0) / 100,
      isActive: plan.isActive !== false,
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setActionLoading(true);
    try {
      await adminBillingApi.updatePlan(editingPlan.key, {
        name: formData.name,
        monthlyPrice: Math.round(Number(formData.monthlyPriceNaira) * 100), // convert to kobo
        annualPrice: Math.round(Number(formData.annualPriceNaira) * 100),
        isActive: formData.isActive,
      });
      setEditingPlan(null);
      await loadPlans();
    } catch (err: any) {
      alert(err.message || "Failed to update plan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (plan: PlanRecord) => {
    setActionLoading(true);
    try {
      await adminBillingApi.updatePlan(plan.key, {
        isActive: !plan.isActive,
      });
      await loadPlans();
    } catch (err: any) {
      alert(err.message || "Failed to toggle plan status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    setActionLoading(true);
    try {
      await adminBillingApi.seedDefaultPlans();
      await loadPlans();
    } catch (err) {
      console.error("Seed error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const getPlanIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case "free":
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case "standard":
        return <Zap className="w-5 h-5 text-amber-400" />;
      case "premium":
        return <Crown className="w-5 h-5 text-purple-400" />;
      default:
        return <CreditCard className="w-5 h-5 text-brand-400" />;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Subscription Plans & Pricing (MVP)</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage manual subscription tiers (Free, Standard, Premium), prices in Nigerian Naira (₦), and active states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadPlans}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          <p className="text-xs text-slate-400">Loading plan configuration...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No plans configured yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Initialize default Free (₦0), Standard (₦7,500), and Premium (₦20,000) plans.
            </p>
          </div>
          <button
            onClick={handleSeedDefaults}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Seed Default Subscription Plans</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const monthlyNaira = (p.monthlyPrice || 0) / 100;
            const annualNaira = (p.annualPrice || 0) / 100;

            return (
              <div
                key={p._id || p.key}
                className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between space-y-6 hover:border-slate-700 transition"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                        {getPlanIcon(p.key)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{p.name}</h3>
                        <span className="text-[11px] font-mono text-slate-500">key: {p.key}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {p.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-white">
                      ₦{monthlyNaira.toLocaleString()}
                      <span className="text-xs font-normal text-slate-400 ml-1">/ month</span>
                    </div>
                    {annualNaira > 0 ? (
                      <div className="text-xs text-slate-400">
                        ₦{annualNaira.toLocaleString()} / year (save 2 months)
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">Free forever for basic use</div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Currency:</span>
                    <span className="font-mono text-slate-200">{p.currency || "NGN"}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleToggleActive(p)}
                      disabled={actionLoading}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                    >
                      {p.isActive ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-500" />
                          <span>Hide from new signups</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Re-enable plan</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Price</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-400" />
                <h3 className="font-bold text-base text-white">Edit {editingPlan.name} Plan</h3>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Plan Display Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Monthly Price (₦)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.monthlyPriceNaira}
                    onChange={(e) => setFormData({ ...formData, monthlyPriceNaira: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Annual Price (₦)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.annualPriceNaira}
                    onChange={(e) => setFormData({ ...formData, annualPriceNaira: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-700 accent-brand-500 w-4 h-4"
                />
                <span>Active (available for new workspace subscriptions)</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-brand-600/30"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plans;
