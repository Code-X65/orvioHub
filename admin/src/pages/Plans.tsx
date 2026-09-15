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
  Sliders,
  Building2,
  Layers,
  GitBranch,
  Users as UsersIcon,
  PlusCircle,
} from "lucide-react";
import { adminBillingApi, type PlanRecord, type PlanLimits } from "../api/adminBilling";

export const Plans: React.FC = () => {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Modal State
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    type: "paid" as "free" | "paid",
    currency: "NGN",
    interval: "month" as "month" | "year",
    trialDurationDays: 30,
    monthlyPriceNaira: 0,
    annualPriceNaira: 0,
    isActive: true,
    maxOrganizations: 1,
    maxAppsPerOrganization: "1" as string | number,
    maxBranchesPerApp: "1" as string | number,
    maxMembersPerOrganization: 2,
    maxProductsPerWorkspace: 500,
    maxTransactionsPerMonth: 500,
    appsIncluded: ["inventory", "tasks"],
    advancedReports: true,
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

  const handleOpenCreate = () => {
    setIsCreatingPlan(true);
    setEditingPlan(null);
    setFormData({
      key: "",
      name: "",
      type: "paid",
      currency: "NGN",
      interval: "month",
      trialDurationDays: 30,
      monthlyPriceNaira: 7500,
      annualPriceNaira: 75000,
      isActive: true,
      maxOrganizations: 3,
      maxAppsPerOrganization: 3,
      maxBranchesPerApp: 3,
      maxMembersPerOrganization: 10,
      maxProductsPerWorkspace: 5000,
      maxTransactionsPerMonth: 5000,
      appsIncluded: ["inventory", "tasks"],
      advancedReports: true,
    });
  };

  const handleOpenEdit = (plan: PlanRecord) => {
    setIsCreatingPlan(false);
    setEditingPlan(plan);
    const limits = plan.limits || {};
    const monthlyVal = plan.price?.monthly ?? (plan.monthlyPrice ? plan.monthlyPrice / 100 : plan.priceAmount ?? 0);
    const annualVal = plan.price?.annual ?? (plan.annualPrice ? plan.annualPrice / 100 : monthlyVal * 10);

    const apps = plan.features?.appsIncluded || plan.allowedApps || ["inventory"];

    setFormData({
      key: plan.key,
      name: plan.name,
      type: (plan as any).type || (monthlyVal === 0 ? "free" : "paid"),
      currency: plan.currency || "NGN",
      interval: "month",
      trialDurationDays: (plan as any).trialDurationDays || plan.trialDays || 30,
      monthlyPriceNaira: monthlyVal,
      annualPriceNaira: annualVal,
      isActive: plan.isActive !== false,
      maxOrganizations: limits.maxOrganizations ?? limits.maxWorkspaces ?? 1,
      maxAppsPerOrganization: limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? 1,
      maxBranchesPerApp: limits.maxBranchesPerApp ?? 1,
      maxMembersPerOrganization: limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? 2,
      maxProductsPerWorkspace: limits.maxProductsPerWorkspace ?? 500,
      maxTransactionsPerMonth: limits.maxTransactionsPerMonth ?? 500,
      appsIncluded: apps,
      advancedReports: Boolean(plan.features?.advancedReports ?? true),
    });
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key.trim() || !formData.name.trim()) {
      alert("Please enter a plan key and display name.");
      return;
    }

    setActionLoading(true);
    try {
      const parsedApps =
        formData.maxAppsPerOrganization === "unlimited"
          ? ("unlimited" as const)
          : Math.max(1, Number(formData.maxAppsPerOrganization) || 1);

      const parsedBranches =
        formData.maxBranchesPerApp === "unlimited"
          ? ("unlimited" as const)
          : Math.max(1, Number(formData.maxBranchesPerApp) || 1);

      const limitsPayload: PlanLimits = {
        maxOrganizations: Number(formData.maxOrganizations) || 1,
        maxAppsPerOrganization: parsedApps,
        maxBranchesPerApp: parsedBranches,
        maxMembersPerOrganization: Number(formData.maxMembersPerOrganization) || 2,
        maxProductsPerWorkspace: Number(formData.maxProductsPerWorkspace) || 500,
        maxTransactionsPerMonth: Number(formData.maxTransactionsPerMonth) || 500,
      };

      const priceAmount = formData.type === "free" ? 0 : Number(formData.monthlyPriceNaira);

      await adminBillingApi.createPlan({
        key: formData.key.trim().toLowerCase().replace(/\s+/g, "_"),
        name: formData.name.trim(),
        type: formData.type,
        priceAmount,
        currency: formData.currency,
        interval: formData.interval,
        trialDurationDays: formData.type === "free" ? Number(formData.trialDurationDays) || 30 : undefined,
        limits: limitsPayload,
        features: {
          maxApplications: parsedApps === "unlimited" ? 999999 : Number(parsedApps),
          maxBranchesPerApplication: parsedBranches === "unlimited" ? 999999 : Number(parsedBranches),
          appsIncluded: formData.appsIncluded,
          advancedReports: formData.advancedReports,
        },
        allowedApps: formData.appsIncluded,
        isActive: formData.isActive,
      });

      setIsCreatingPlan(false);
      await loadPlans();
    } catch (err: any) {
      alert(err.message || "Failed to create plan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setActionLoading(true);
    try {
      const parsedApps =
        formData.maxAppsPerOrganization === "unlimited"
          ? ("unlimited" as const)
          : Math.max(1, Number(formData.maxAppsPerOrganization) || 1);

      const parsedBranches =
        formData.maxBranchesPerApp === "unlimited"
          ? ("unlimited" as const)
          : Math.max(1, Number(formData.maxBranchesPerApp) || 1);

      const limitsPayload: PlanLimits = {
        maxOrganizations: Number(formData.maxOrganizations) || 1,
        maxAppsPerOrganization: parsedApps,
        maxBranchesPerApp: parsedBranches,
        maxMembersPerOrganization: Number(formData.maxMembersPerOrganization) || 2,
        maxProductsPerWorkspace: Number(formData.maxProductsPerWorkspace) || 500,
        maxTransactionsPerMonth: Number(formData.maxTransactionsPerMonth) || 500,
        maxWorkspaces: Number(formData.maxOrganizations) || 1,
        maxAppsPerWorkspace: parsedApps,
        maxMembersPerWorkspace: Number(formData.maxMembersPerOrganization) || 2,
      };

      const monthlyPrice = Math.round(Number(formData.monthlyPriceNaira));
      const annualPrice = Math.round(Number(formData.annualPriceNaira));

      await adminBillingApi.updatePlan(editingPlan.key, {
        name: formData.name,
        price: {
          monthly: monthlyPrice,
          annual: annualPrice,
        },
        monthlyPrice: monthlyPrice * 100, // convert to kobo
        annualPrice: annualPrice * 100,
        limits: limitsPayload,
        features: {
          maxApplications: parsedApps === "unlimited" ? 999999 : Number(parsedApps),
          maxBranchesPerApplication: parsedBranches === "unlimited" ? 999999 : Number(parsedBranches),
          appsIncluded: formData.appsIncluded,
          advancedReports: formData.advancedReports,
        },
        allowedApps: formData.appsIncluded,
        isActive: formData.isActive,
      } as any);

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

  const AVAILABLE_APPS = [
    { key: "inventory", name: "Inventory & Stock" },
    { key: "tasks", name: "Task Management" },
    { key: "pos", name: "Point of Sale (POS)" },
    { key: "booking", name: "Appointments & Booking" },
    { key: "gym", name: "Gym & Fitness" },
    { key: "crm", name: "CRM & Customers" },
    { key: "analytics", name: "Advanced Analytics" },
    { key: "invoicing", name: "Invoicing & Billing" },
    { key: "hr", name: "Human Resources" },
  ];

  const handleToggleApp = (appKey: string) => {
    if (formData.appsIncluded.includes(appKey)) {
      setFormData({
        ...formData,
        appsIncluded: formData.appsIncluded.filter((k) => k !== appKey),
      });
    } else {
      setFormData({
        ...formData,
        appsIncluded: [...formData.appsIncluded, appKey],
      });
    }
  };

  const getPlanIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case "free":
      case "free_trial":
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
            <h1 className="text-xl font-bold text-white tracking-tight">Subscription Plans & Batch Limits</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure subscription tiers (Free Trial, Standard, Premium), pricing in Naira (₦), and strict entitlement limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Plan</span>
          </button>
          <button
            onClick={loadPlans}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>


      {/* Plans Content */}
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
              Initialize default Free (₦0), Standard (₦7,500), and Premium (₦20,000) plans with batch limits.
            </p>
          </div>
          <button
            onClick={handleSeedDefaults}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Seed Default Subscription Plans</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const monthlyNaira = p.price?.monthly ?? ((p.monthlyPrice || 0) / 100);
              const annualNaira = p.price?.annual ?? ((p.annualPrice || 0) / 100);
              const limits = p.limits || {};

              const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? (p.key === "premium" ? 10 : p.key === "standard" ? 3 : 1);
              const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? (p.key === "premium" ? "unlimited" : p.key === "standard" ? 3 : 1);
              const maxBranches = limits.maxBranchesPerApp ?? (p.key === "premium" ? 10 : p.key === "standard" ? 3 : 1);
              const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? (p.key === "premium" ? 50 : p.key === "standard" ? 10 : 2);
              const maxProducts = limits.maxProductsPerWorkspace ?? (p.key === "premium" ? 25000 : p.key === "standard" ? 5000 : 500);
              const maxTransactions = limits.maxTransactionsPerMonth ?? (p.key === "premium" ? 25000 : p.key === "standard" ? 5000 : 500);

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
                        <div className="text-xs text-purple-400 font-semibold">30-Day Free Trial (1 App, 1 Branch)</div>
                      )}
                    </div>

                    {/* Limits Mini Badges */}
                    <div className="pt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-slate-300 font-medium truncate">{maxOrgs} Orgs</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-slate-300 font-medium truncate">{maxApps === "unlimited" ? "Unlimited" : `${maxApps} Apps/Org`}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-300 font-medium truncate">{maxBranches} Branches/App</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-1.5">
                        <UsersIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-300 font-medium truncate">{maxMembers} Members</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Products & Volume:</span>
                      <span className="font-mono text-slate-200">
                        {maxProducts.toLocaleString()} items &bull; {maxTransactions.toLocaleString()} txs/mo
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => handleToggleActive(p)}
                        disabled={actionLoading}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {p.isActive ? (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-500" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Re-enable</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Limits & Price</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plan Limits Comprehensive Comparison Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-400" />
                <h3 className="font-bold text-sm text-white">Plan Limits & Entitlements Matrix</h3>
              </div>
              <span className="text-[11px] text-slate-400">Strict server-side batch rules applied</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Plan Name</th>
                    <th className="py-3 px-4">Price (Monthly)</th>
                    <th className="py-3 px-4">Price (Annual)</th>
                    <th className="py-3 px-4">Max Orgs</th>
                    <th className="py-3 px-4">Max Apps / Org</th>
                    <th className="py-3 px-4">Max Branches / App</th>
                    <th className="py-3 px-4">Max Members</th>
                    <th className="py-3 px-4">Max Products</th>
                    <th className="py-3 px-4">Max Transactions</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {plans.map((p) => {
                    const monthlyNaira = p.price?.monthly ?? ((p.monthlyPrice || 0) / 100);
                    const annualNaira = p.price?.annual ?? ((p.annualPrice || 0) / 100);
                    const limits = p.limits || {};

                    const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? (p.key === "premium" ? 10 : p.key === "standard" ? 3 : 1);
                    const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? (p.key === "premium" ? "unlimited" : p.key === "standard" ? 3 : 1);
                    const maxBranches = limits.maxBranchesPerApp ?? (p.key === "premium" ? 10 : p.key === "standard" ? 3 : 1);
                    const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? (p.key === "premium" ? 50 : p.key === "standard" ? 10 : 2);
                    const maxProducts = limits.maxProductsPerWorkspace ?? (p.key === "premium" ? 25000 : p.key === "standard" ? 5000 : 500);
                    const maxTransactions = limits.maxTransactionsPerMonth ?? (p.key === "premium" ? 25000 : p.key === "standard" ? 5000 : 500);

                    return (
                      <tr key={`table-${p._id || p.key}`} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-brand-400" />
                          <span>{p.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({p.key})</span>
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          {monthlyNaira === 0 ? "Free (₦0)" : `₦${monthlyNaira.toLocaleString()}`}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {annualNaira === 0 ? "₦0" : `₦${annualNaira.toLocaleString()}`}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{maxOrgs}</td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                          {maxApps === "unlimited" ? (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                              Unlimited
                            </span>
                          ) : (
                            maxApps
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{maxBranches}</td>
                        <td className="py-3 px-4 font-mono text-emerald-400">{maxMembers}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{maxProducts.toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{maxTransactions.toLocaleString()}/mo</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {p.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Plan & Limits Modal */}
      {(isCreatingPlan || editingPlan) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="max-w-2xl w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  {isCreatingPlan ? "Create New Subscription Plan" : `Edit ${editingPlan?.name} Plan & Batch Limits`}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setIsCreatingPlan(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isCreatingPlan ? handleCreatePlan : handleSavePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Plan Key */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Plan Unique Key</label>
                  <input
                    type="text"
                    required
                    disabled={!isCreatingPlan}
                    placeholder="e.g. enterprise, standard_annual"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 font-mono"
                  />
                </div>

                {/* Plan Display Name */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Tier"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Type, Currency & Interval */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Plan Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="free">Free / Evaluation</option>
                    <option value="paid">Paid Subscription</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Default Interval</label>
                  <select
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Annual</option>
                  </select>
                </div>
              </div>

              {/* Pricing Section */}
              {formData.type === "paid" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold">Monthly Price (₦)</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.monthlyPriceNaira}
                      onChange={(e) => setFormData({ ...formData, monthlyPriceNaira: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold">Annual Price (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.annualPriceNaira}
                      onChange={(e) => setFormData({ ...formData, annualPriceNaira: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Trial Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.trialDurationDays}
                    onChange={(e) => setFormData({ ...formData, trialDurationDays: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Apps Included Feature Flags */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="text-slate-300 font-semibold block">Included Applications</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_APPS.map((app) => {
                    const isSelected = formData.appsIncluded.includes(app.key);
                    return (
                      <button
                        type="button"
                        key={app.key}
                        onClick={() => handleToggleApp(app.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span>{app.name}</span>
                        {isSelected && <span className="text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Reports Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={formData.advancedReports}
                  onChange={(e) => setFormData({ ...formData, advancedReports: e.target.checked })}
                  className="rounded border-slate-700 accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Enable Advanced Reports & Analytics Feature</span>
              </label>

              {/* Tier Batch Limits Section */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Tier Batch Rules & Entitlement Limits</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Organizations</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.maxOrganizations}
                      onChange={(e) => setFormData({ ...formData, maxOrganizations: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Apps per Org</label>
                    <div className="flex items-center gap-2">
                      <input
                        type={formData.maxAppsPerOrganization === "unlimited" ? "text" : "number"}
                        min={1}
                        required
                        disabled={formData.maxAppsPerOrganization === "unlimited"}
                        value={formData.maxAppsPerOrganization}
                        onChange={(e) =>
                          setFormData({ ...formData, maxAppsPerOrganization: parseInt(e.target.value, 10) || 1 })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            maxAppsPerOrganization:
                              formData.maxAppsPerOrganization === "unlimited" ? 3 : "unlimited",
                          })
                        }
                        className={`px-2 py-2 rounded-xl text-[10px] font-bold border transition cursor-pointer whitespace-nowrap ${
                          formData.maxAppsPerOrganization === "unlimited"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {formData.maxAppsPerOrganization === "unlimited" ? "Unlimited (✓)" : "Set Unlimited"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Branches per App</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.maxBranchesPerApp === "unlimited" ? 10 : formData.maxBranchesPerApp}
                      onChange={(e) => setFormData({ ...formData, maxBranchesPerApp: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Members per Org</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.maxMembersPerOrganization}
                      onChange={(e) =>
                        setFormData({ ...formData, maxMembersPerOrganization: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Products</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.maxProductsPerWorkspace}
                      onChange={(e) =>
                        setFormData({ ...formData, maxProductsPerWorkspace: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Transactions/mo</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.maxTransactionsPerMonth}
                      onChange={(e) =>
                        setFormData({ ...formData, maxTransactionsPerMonth: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-700 accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Active (available for organization subscriptions)</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlan(null);
                    setIsCreatingPlan(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreatingPlan ? "Create Billing Plan" : "Save Plan Limits & Pricing"}</span>
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

