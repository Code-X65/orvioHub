import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  Clock,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  Building2,
} from "lucide-react";
import { adminBillingApi, SubscriptionRecord, SubscriptionStats } from "../api/adminBilling";
import { RecordPaymentModal } from "../components/RecordPaymentModal";

export const Subscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("" );
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Record Payment Modal State
  const [paymentModalState, setPaymentModalState] = useState<{
    isOpen: boolean;
    workspaceId: string;
    workspaceName: string;
    currentPlanKey: string;
  }>({
    isOpen: false,
    workspaceId: "",
    workspaceName: "",
    currentPlanKey: "standard",
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [subsData, statsData] = await Promise.all([
        adminBillingApi.listAllSubscriptions({
          planKey: planFilter !== "all" ? planFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
        }),
        adminBillingApi.getSubscriptionOverviewStats(),
      ]);
      setSubscriptions(subsData);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load subscriptions data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [planFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysRemaining = (endTimestamp?: number) => {
    if (!endTimestamp) return null;
    const diff = endTimestamp - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getPlanBadge = (planKey: string) => {
    switch (planKey.toLowerCase()) {
      case "premium":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Premium (₦20k)
          </span>
        );
      case "standard":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Standard (₦7.5k)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Free (₦0)
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Active
          </span>
        );
      case "past_due":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Past Due
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Subscriptions Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor all workspace subscription plans, track MRR, and record manual offline payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/plans"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition"
          >
            Manage Plan Pricing
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated MRR */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated MRR</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {stats ? `₦${stats.totalMRRNaira.toLocaleString()}` : "₦0"}
          </p>
          <p className="text-xs text-slate-500">Monthly recurring revenue</p>
        </div>

        {/* Total Subscriptions */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Subscriptions</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {stats ? stats.totalSubscriptions : 0}
          </p>
          <p className="text-xs text-slate-500">Across all platform workspaces</p>
        </div>

        {/* Paid Subscribers Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Plan Distribution</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-bold text-amber-400">
              {stats?.countsByPlan.premium || 0} Premium
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-bold text-blue-400">
              {stats?.countsByPlan.standard || 0} Standard
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">{stats?.countsByPlan.free || 0} Free</span>
          </div>
          <p className="text-xs text-slate-500">Active tiered workspaces</p>
        </div>

        {/* Expiring Soon */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring in &lt; 7 Days</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {stats ? stats.expiringSoonCount : 0}
          </p>
          <p className="text-xs text-slate-500">Require renewal or extension</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-96 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search workspace or owner email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Plan Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 outline-none"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/40 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Workspace</th>
                <th className="py-3.5 px-4">Owner</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Period Expiry</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No subscriptions found matching your filters.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => {
                  const daysLeft = getDaysRemaining(sub.currentPeriodEnd);
                  const isExpiringSoon =
                    sub.planKey !== "free" &&
                    sub.status === "active" &&
                    daysLeft !== null &&
                    daysLeft <= 7 &&
                    daysLeft >= 0;

                  return (
                    <tr key={sub.workspaceId} className="hover:bg-slate-800/30 transition">
                      {/* Workspace */}
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/organizations/${sub.workspaceId}`}
                          className="font-bold text-white hover:text-emerald-400 transition flex items-center gap-1.5"
                        >
                          {sub.workspaceName || "Workspace"}
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </Link>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {sub.workspaceSlug || sub.workspaceId}
                        </p>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-200">{sub.ownerName || "—"}</p>
                        <p className="text-[11px] text-slate-400">{sub.ownerEmail || "—"}</p>
                      </td>

                      {/* Plan Tier */}
                      <td className="py-3.5 px-4">{getPlanBadge(sub.planKey)}</td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">
                            {formatDate(sub.currentPeriodEnd)}
                          </span>
                          {isExpiringSoon && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {daysLeft}d left
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              setPaymentModalState({
                                isOpen: true,
                                workspaceId: sub.workspaceId,
                                workspaceName: sub.workspaceName || "Workspace",
                                currentPlanKey: sub.planKey,
                              })
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Record Payment
                          </button>
                          <Link
                            to={`/organizations/${sub.workspaceId}`}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={paymentModalState.isOpen}
        workspaceId={paymentModalState.workspaceId}
        workspaceName={paymentModalState.workspaceName}
        currentPlanKey={paymentModalState.currentPlanKey}
        adminUserId="admin_manual_recorder"
        onClose={() => setPaymentModalState((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
};
