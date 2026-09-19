import React, { useState, useEffect } from 'react';

export interface OverviewMetrics {
  users?: { total: number; active: number; pendingVerification: number; suspended: number };
  organizations?: {
    total: number;
    active: number;
    trial: number;
    standard: number;
    premium: number;
    pastDue: number;
    gracePeriod: number;
    suspended: number;
  };
  subscriptions?: {
    activePaid: number;
    trialing: number;
    mrr: number;
    arr: number;
    complimentaryMrr: number;
    currency: string;
    displayMrr: string;
    displayArr: string;
  };
  inventory?: {
    activations: number;
    setupCompletions: number;
    demoBranches: number;
    memberships: number;
    pendingInvitations: number;
    products: string;
    stockValue: string;
    salesVolume: string;
    customerDebt: string;
    mvpNotice: string;
  };
  payments?: {
    successful: number;
    failed: number;
    volume: number;
    displayVolume: string;
    failedWebhooks: number;
    billingMismatches: number;
  };
  overrides?: {
    active: number;
    expiringIn7Days: number;
  };
  freshness?: {
    computedAt: number;
    freshness: string;
    sourcePeriod: string;
    timezone: string;
    currency: string;
  };
}

export interface RevenueMetrics {
  mrr?: { value: number; displayValue: string; currency: string; asOf: number };
  arr?: { value: number; displayValue: string; currency: string; asOf: number };
  complimentary?: { mrr: number; displayMrr: string };
  breakdown?: {
    standard: { monthlyCount: number; annualCount: number; totalMrr: number; displayMrr: string };
    premium: { monthlyCount: number; annualCount: number; totalMrr: number; displayMrr: string };
  };
  history?: Array<{ date: string; mrr: number; arr: number; paymentVolume: number }>;
  freshness?: { computedAt: number; freshness: string; timezone: string };
}

export const AdminAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'subscriptions' | 'trials' | 'payments' | 'entitlements'>('overview');
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState<boolean>(false);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('adminToken') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [resOverview, resRev] = await Promise.all([
        fetch('/api/v1/admin/analytics/overview', { headers }),
        fetch('/api/v1/admin/analytics/revenue', { headers }),
      ]);

      if (!resOverview.ok || !resRev.ok) {
        throw new Error('Failed to load analytics. Please check admin permissions.');
      }

      const dataOverview = await resOverview.json();
      const dataRev = await resRev.json();

      setOverview(dataOverview.data);
      setRevenue(dataRev.data);
    } catch (err: any) {
      setError(err.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRebuildDaily = async () => {
    try {
      setRebuilding(true);
      setRebuildMessage(null);
      const token = localStorage.getItem('adminToken') || '';
      const res = await fetch('/api/v1/admin/analytics/rebuild', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Manual admin dashboard trigger' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Rebuild failed');
      setRebuildMessage(`Success: ${data.message || 'Daily aggregates rebuilt.'}`);
      await fetchAnalytics();
    } catch (err: any) {
      setRebuildMessage(`Error: ${err.message}`);
    } finally {
      setRebuilding(false);
    }
  };

  const handleReconcileRevenue = async () => {
    try {
      setRebuilding(true);
      setRebuildMessage(null);
      const token = localStorage.getItem('adminToken') || '';
      const res = await fetch('/api/v1/admin/analytics/reconcile-revenue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Reconciliation failed');
      setRebuildMessage(`Reconciled: MRR ₦${((data.data?.mrr || 0) / 100).toLocaleString('en-NG')} across ${data.data?.activePaidSubscriptions || 0} active subscriptions.`);
      await fetchAnalytics();
    } catch (err: any) {
      setRebuildMessage(`Error: ${err.message}`);
    } finally {
      setRebuilding(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Computing analytics aggregations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl">
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Analytics Error</h3>
        <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Freshness, Timezone & Currency pills */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Platform Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Organization-scoped billing, subscription, trial conversion, and demo inventory telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold">
            Timezone: Africa/Lagos (UTC+1)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
            Currency: NGN (₦)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Freshness: {overview?.freshness?.freshness || 'fresh'} (Period: {overview?.freshness?.sourcePeriod})
          </span>
        </div>
      </div>

      {rebuildMessage && (
        <div className="p-3 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 text-xs font-medium border border-blue-200 dark:border-blue-900 flex justify-between items-center">
          <span>{rebuildMessage}</span>
          <button onClick={() => setRebuildMessage(null)} className="text-xs underline font-semibold">Dismiss</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-4">
        {(['overview', 'revenue', 'subscriptions', 'trials', 'payments', 'entitlements'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Monthly Recurring Revenue</span>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {overview?.subscriptions?.displayMrr || '₦0'}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                ARR: {overview?.subscriptions?.displayArr || '₦0'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Paid Organizations</span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {overview?.subscriptions?.activePaid || 0}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Standard: {overview?.organizations?.standard || 0} | Premium: {overview?.organizations?.premium || 0}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Active Free Trials</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {overview?.organizations?.trial || 0}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Past Due: {overview?.organizations?.pastDue || 0} | Grace: {overview?.organizations?.gracePeriod || 0}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Demo Inventory Activations</span>
              <div className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
                {overview?.inventory?.activations || 0}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Setup Complete: {overview?.inventory?.setupCompletions || 0} | Branches: {overview?.inventory?.demoBranches || 0}
              </div>
            </div>
          </div>

          {/* MVP Scope Disclaimer Notice */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold">MVP Boundary Assurance:</span> Inventory is currently a demo dashboard. Business record analytics (products, stock valuation, sales volume, customer debt) are returned as <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">not_available</code> to guarantee no fabricated operational telemetry is shown.
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRebuildDaily}
              disabled={rebuilding}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              {rebuilding ? 'Processing...' : 'Rebuild Daily Aggregates'}
            </button>
            <button
              onClick={handleReconcileRevenue}
              disabled={rebuilding}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition"
            >
              Reconcile Revenue Metrics
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Revenue */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Paid MRR</span>
              <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">
                {revenue?.mrr?.displayValue || '₦0'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Standard & Premium active organizations with annual plans normalized (divided by 12).
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Standard Plan MRR</span>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                {revenue?.breakdown?.standard?.displayMrr || '₦0'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Monthly: {revenue?.breakdown?.standard?.monthlyCount || 0} orgs | Annual: {revenue?.breakdown?.standard?.annualCount || 0} orgs
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Premium Plan MRR</span>
              <div className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-2">
                {revenue?.breakdown?.premium?.displayMrr || '₦0'}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Monthly: {revenue?.breakdown?.premium?.monthlyCount || 0} orgs | Annual: {revenue?.breakdown?.premium?.annualCount || 0} orgs
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
