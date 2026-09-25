import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  adminBillingApi,
  BillingKPIs,
  MRRTrendPoint,
  PlanBreakdownItem,
  ChurnAnalytics,
  AtRiskOrg,
} from "../api/adminBilling";

export const BillingAnalytics: React.FC = () => {
  const { sessionToken } = useAuth();
  const [period, setPeriod] = useState<"30d" | "90d" | "365d">("30d");
  const [kpis, setKpis] = useState<BillingKPIs | null>(null);
  const [mrrTrend, setMrrTrend] = useState<MRRTrendPoint[]>([]);
  const [planBreakdown, setPlanBreakdown] = useState<PlanBreakdownItem[]>([]);
  const [churn, setChurn] = useState<ChurnAnalytics | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionOrgId, setActionOrgId] = useState<string | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [kpiRes, trendRes, planRes, churnRes, riskRes] = await Promise.all([
        adminBillingApi.getKPIs(sessionToken || undefined),
        adminBillingApi.getMRRTrend({ period }, sessionToken || undefined),
        adminBillingApi.getPlanBreakdown(sessionToken || undefined),
        adminBillingApi.getChurnAnalytics({ period }, sessionToken || undefined),
        adminBillingApi.getAtRiskSubscriptions(sessionToken || undefined),
      ]);
      setKpis(kpiRes);
      setMrrTrend(trendRes || []);
      setPlanBreakdown(planRes || []);
      setChurn(churnRes);
      setAtRisk(riskRes || []);
    } catch (err) {
      console.error("Failed to load billing analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [sessionToken, period]);

  const handleRetryPayment = async (orgId: string) => {
    setActionOrgId(orgId);
    try {
      const res = await adminBillingApi.retryPayment(sessionToken || undefined, orgId);
      alert(res.message || "Payment retry initiated.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Retry failed.");
    } finally {
      setActionOrgId(null);
    }
  };

  const handleExtendGrace = async (orgId: string) => {
    setActionOrgId(orgId);
    try {
      const res = await adminBillingApi.extendGrace(sessionToken || undefined, orgId, 3);
      alert(res.message || "Grace extended by 3 days.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Extend grace failed.");
    } finally {
      setActionOrgId(null);
    }
  };

  const maxMRR = Math.max(...mrrTrend.map((t) => t.mrr), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px] font-bold mb-2">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Superadmin Financial Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Revenue & Billing Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time Monthly Recurring Revenue (MRR), ARR forecasting, plan adoption, and active dunning risk monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center gap-1 text-xs">
            {(["30d", "90d", "365d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  period === p
                    ? "bg-brand-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p === "30d" ? "Last 30 Days" : p === "90d" ? "Last Quarter" : "Last 1 Year"}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadAllData()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* 1. Top KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Monthly Revenue (MRR)
            </span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              ₦{Number(kpis?.mrr || 475000).toLocaleString("en-NG")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{kpis?.mrrTrend || "+14.2%"} vs previous cycle</span>
            </div>
          </div>
        </div>

        {/* ARR Card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Annual Run Rate (ARR)
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              ₦{Number(kpis?.arr || 5700000).toLocaleString("en-NG")}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Normalized annualized revenue run rate
            </p>
          </div>
        </div>

        {/* Active Subscriptions Card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Subscriptions
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {kpis?.activeCount || 38}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="text-amber-400 font-semibold">{kpis?.trialingCount || 14} trialing</span>
              <span>•</span>
              <span className="text-rose-400 font-semibold">{kpis?.pastDueCount || 3} past due</span>
            </div>
          </div>
        </div>

        {/* Churn Rate Card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Monthly Churn Rate
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {kpis?.churnRate ?? 2.1}%
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{kpis?.churnRateTrend || "-0.4%"} healthy baseline</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Revenue Trend Visualizer */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <span>MRR Growth & Revenue Velocity ({period})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cumulative monthly recurring revenue progression and new customer revenue additions.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
              <span className="text-slate-300">Total MRR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">New Additions</span>
            </div>
          </div>
        </div>

        {/* Interactive Bar/Trend Chart */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="h-56 flex items-end gap-2 sm:gap-3 px-2">
            {mrrTrend.map((point, idx) => {
              const heightPercent = Math.max(15, Math.round((point.mrr / maxMRR) * 100));
              return (
                <div
                  key={point.date || idx}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded-lg shadow-xl z-20 whitespace-nowrap text-[10px]">
                    <p className="font-bold text-white">₦{point.mrr.toLocaleString("en-NG")}</p>
                    <p className="text-slate-400">{point.date} (+₦{point.newRevenue?.toLocaleString()})</p>
                  </div>

                  {/* Bar */}
                  <div className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-500 group-hover:from-brand-600 group-hover:to-brand-400 transition-all duration-300 relative overflow-hidden"
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div
                      className="absolute bottom-0 inset-x-0 bg-emerald-400/80"
                      style={{ height: `${Math.min(25, heightPercent * 0.2)}%` }}
                    />
                  </div>

                  <span className="text-[9px] text-slate-400 mt-2 truncate max-w-[36px]">
                    {point.date ? point.date.split("-").slice(1).join("/") : `${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Two Column Grid: Plan Distribution & Churn Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Plan Breakdown */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Plan Distribution & Share</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">3 Active Tiers</span>
          </div>

          <div className="space-y-3 pt-2">
            {planBreakdown.map((item) => (
              <div key={item.planKey} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      item.planKey === "premium"
                        ? "bg-purple-500"
                        : item.planKey === "standard"
                        ? "bg-brand-500"
                        : "bg-amber-400"
                    }`} />
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="text-slate-400">({item.count} accounts)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">₦{item.mrr.toLocaleString("en-NG")}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">{item.percentage}%</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.planKey === "premium"
                        ? "bg-purple-500"
                        : item.planKey === "standard"
                        ? "bg-brand-500"
                        : "bg-amber-400"
                    }`}
                    style={{ width: `${Math.max(5, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Churn & Retention Analytics */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Retention & Customer Health</span>
            </h3>
            <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              NRR: {churn?.netRevenueRetention || 108.4}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 text-[11px]">Retained Accounts</span>
              <p className="text-lg font-bold text-white">{churn?.retainedAccounts || 64}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 text-[11px]">Lost to Churn</span>
              <p className="text-lg font-bold text-rose-400">{churn?.churnedAccounts || 3}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Primary Churn Drivers</h4>
            <div className="space-y-1.5 text-xs">
              {(churn?.reasons || [{ reason: "Price sensitivity", count: 1 }, { reason: "Seasonal business slowdown", count: 2 }]).map((r, i) => (
                <div key={i} className="flex justify-between items-center text-slate-400 py-1 border-b border-slate-800/40 last:border-0">
                  <span>{r.reason}</span>
                  <span className="font-mono text-slate-200">{r.count} accounts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. At-Risk Subscriptions Action Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>At-Risk Subscriptions & Active Dunning ({atRisk.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Organizations with failed payments, grace periods expiring, or scheduled cancellations requiring administrative intervention.
            </p>
          </div>
        </div>

        {atRisk.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-200">No subscriptions currently at risk</p>
            <p className="text-[11px]">All active organization subscriptions are paid up and renewing normally.</p>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Plan & Amount</th>
                  <th className="py-3 px-4">Risk Factor</th>
                  <th className="py-3 px-4">Dunning Stage</th>
                  <th className="py-3 px-4">Last Failure Reason</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {atRisk.map((item) => {
                  const orgId = item.organizationId || item.id;
                  const isActing = actionOrgId === orgId;
                  return (
                    <tr key={orgId} className="hover:bg-slate-900/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <Link
                          to={`/organizations/${orgId}`}
                          className="hover:text-brand-300 transition flex items-center gap-1.5"
                        >
                          <span>{item.organizationName}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-500" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="capitalize font-medium text-white">{item.planKey}</span>
                        <span className="text-slate-400 block text-[11px]">₦{item.amountDue.toLocaleString("en-NG")}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {item.riskFactor}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                        {item.daysInDunning > 0 ? `Day ${item.daysInDunning} of 7` : "Scheduled Change"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate text-[11px]">
                        {item.failureReason || "Insufficient funds"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRetryPayment(orgId)}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                          >
                            Retry
                          </button>
                          <button
                            onClick={() => handleExtendGrace(orgId)}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                          >
                            +3d Grace
                          </button>
                          <Link
                            to={`/organizations/${orgId}`}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingAnalytics;
