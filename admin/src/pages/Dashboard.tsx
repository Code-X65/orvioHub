import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  Activity,
  Package,
  ArrowRight,
  TrendingUp,
  Clock,
  Loader2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminDashboardApi } from "../api/adminDashboard";
import StatCard from "../components/StatCard";
import OnboardingFunnel from "../components/OnboardingFunnel";
import ActivityFeed from "../components/ActivityFeed";

export const Dashboard: React.FC = () => {
  const { sessionToken, admin } = useAuth();
  const [data, setData] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;

    const load = async () => {
      try {
        setLoading(true);
        const [overview, growth] = await Promise.all([
          adminDashboardApi.getDashboardOverview(sessionToken).catch(() => null),
          adminDashboardApi.getUserStats(sessionToken).catch(() => null),
        ]);
        setData(overview);
        setUserStats(growth);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400 font-medium">Aggregating platform metrics...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const funnel = data?.onboardingFunnel || {};
  const productActivations = data?.productActivations || {};

  const funnelStages = [
    {
      id: "signup",
      name: "1. Account Created",
      count: funnel.totalSignups || 0,
      conversionRate: 100,
      dropoffRate: 0,
    },
    {
      id: "profile",
      name: "2. Profile Completed",
      count: funnel.profileCompleted || 0,
      conversionRate: funnel.totalSignups ? Math.round((funnel.profileCompleted / funnel.totalSignups) * 100) : 0,
      dropoffRate: funnel.totalSignups ? 100 - Math.round((funnel.profileCompleted / funnel.totalSignups) * 100) : 0,
    },
    {
      id: "organization",
      name: "3. Organization Provisioned",
      count: funnel.orgCreated || 0,
      conversionRate: funnel.profileCompleted ? Math.round((funnel.orgCreated / funnel.profileCompleted) * 100) : 0,
      dropoffRate: funnel.profileCompleted ? 100 - Math.round((funnel.orgCreated / funnel.profileCompleted) * 100) : 0,
    },
    {
      id: "product",
      name: "4. Product Activated",
      count: funnel.productActivated || 0,
      conversionRate: funnel.orgCreated ? Math.round((funnel.productActivated / funnel.orgCreated) * 100) : 0,
      dropoffRate: funnel.orgCreated ? 100 - Math.round((funnel.productActivated / funnel.orgCreated) * 100) : 0,
    },
    {
      id: "completed",
      name: "5. Onboarding Finished",
      count: funnel.onboardingCompleted || 0,
      conversionRate: funnel.productActivated ? Math.round((funnel.onboardingCompleted / funnel.productActivated) * 100) : 0,
      dropoffRate: funnel.productActivated ? 100 - Math.round((funnel.onboardingCompleted / funnel.productActivated) * 100) : 0,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-brand-900/50 via-slate-900 to-indigo-950/40 border border-brand-500/20 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 bg-brand-500/20 px-2.5 py-0.5 rounded-full border border-brand-500/30">
                Super Admin Console
              </span>
              <span className="text-xs text-slate-400">Authenticated: {admin?.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Platform Command Center
            </h1>
            <p className="text-xs md:text-sm text-slate-300">
              Live monitoring of tenant onboarding, user growth, active organizations, and product activations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/onboarding"
              className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              Onboarding Funnel
            </Link>
            <Link
              to="/users"
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition flex items-center gap-1.5"
            >
              <span>Manage Users</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Registered Users"
          value={stats.totalUsers || 0}
          subtext={`${stats.verifiedUsers || 0} verified (${userStats?.verificationRate || 0}%)`}
          icon={Users}
          variant="brand"
          trend={{ value: `+${stats.newUsersThisMonth || 0} this mo`, positive: true }}
        />

        <StatCard
          label="Total Organizations"
          value={stats.totalOrganizations || 0}
          subtext={`${stats.activeOrganizations || 0} active organizations`}
          icon={Building2}
          variant="indigo"
          trend={{ value: `+${stats.organizationsCreatedToday || 0} today`, positive: true }}
        />

        <StatCard
          label="Active Users (24h)"
          value={stats.activeUsersLast24h || 0}
          subtext={`${userStats?.totalActiveSessions || 0} concurrent sessions`}
          icon={Activity}
          variant="emerald"
        />

        <StatCard
          label="Incomplete Onboarding"
          value={stats.incompleteOnboarding || 0}
          subtext="Users currently in setup"
          icon={Clock}
          variant="amber"
        />
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Onboarding Funnel */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
          <OnboardingFunnel
            stages={funnelStages}
            overallConversionRate={
              funnel.totalSignups
                ? Math.round((funnel.onboardingCompleted / funnel.totalSignups) * 100)
                : 0
            }
          />

          {/* User Signups Timeline snippet */}
          {userStats?.dailyGrowth && userStats.dailyGrowth.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-brand-400" />
                  Signups Trend (Recent 14 Days)
                </span>
                <span className="text-[11px] text-slate-500">Live platform telemetry</span>
              </div>

              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-2">
                {userStats.dailyGrowth.slice(-14).map((d: any) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div className="w-full bg-slate-950 rounded-lg p-1.5 border border-slate-800/80 flex flex-col items-center justify-end h-16">
                      <div
                        style={{ height: `${Math.min(100, Math.max(15, d.signups * 25))}%` }}
                        className="w-full bg-brand-500 rounded-md transition-all"
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {d.date.split("-").slice(1).join("/")}
                    </span>
                    <span className="text-[10px] font-bold text-white">{d.signups}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Products & Quick Controls */}
        <div className="space-y-6">
          {/* Product Activations Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Product Activations</h3>
              </div>
              <Link to="/products" className="text-xs text-brand-400 hover:text-brand-300">
                View all
              </Link>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Inventory & POS</p>
                  <p className="text-[11px] text-slate-500">inventory.orviohub.com</p>
                </div>
                <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {productActivations["inventory"] || 0} Orgs
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Task Management</p>
                  <p className="text-[11px] text-slate-500">tasks.orviohub.com</p>
                </div>
                <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                  {productActivations["taskmanagement"] || 0} Orgs
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Customer CRM</p>
                  <p className="text-[11px] text-slate-500">crm.orviohub.com</p>
                </div>
                <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  {productActivations["crm"] || 0} Orgs
                </span>
              </div>
            </div>
          </div>

          {/* Quick Platform Controls */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              Quick Actions
            </h3>

            <div className="space-y-2 text-xs">
              <Link
                to="/invitations"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-brand-500/40 text-slate-300 hover:text-white transition"
              >
                <span>Manage Invitations</span>
                <span className="text-slate-500">→</span>
              </Link>
              <Link
                to="/audit-logs"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-brand-500/40 text-slate-300 hover:text-white transition"
              >
                <span>Audit Trail & Security Logs</span>
                <span className="text-slate-500">→</span>
              </Link>
              <Link
                to="/settings"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-brand-500/40 text-slate-300 hover:text-white transition"
              >
                <span>System Config & Feature Flags</span>
                <span className="text-slate-500">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Recent Admin Activity Feed</h3>
          </div>
          <Link to="/audit-logs" className="text-xs text-brand-400 hover:text-brand-300">
            View full log
          </Link>
        </div>

        <ActivityFeed items={data?.recentActivities || []} />
      </div>
    </div>
  );
};

export default Dashboard;
