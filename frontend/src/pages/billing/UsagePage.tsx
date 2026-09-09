import React, { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  Building2,
  Layers,
  Store,
  Users,
  Package,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

const PLAN_LIMITS_MAP: Record<
  string,
  {
    name: string;
    maxWorkspaces: number;
    maxApps: number | "unlimited";
    maxBranches: number;
    maxMembers: number;
    maxProducts: number;
    maxTransactions: number;
  }
> = {
  free: {
    name: "30-Day Free Trial",
    maxWorkspaces: 1,
    maxApps: 1,
    maxBranches: 1,
    maxMembers: 2,
    maxProducts: 500,
    maxTransactions: 500,
  },
  free_trial: {
    name: "30-Day Free Trial",
    maxWorkspaces: 1,
    maxApps: 1,
    maxBranches: 1,
    maxMembers: 2,
    maxProducts: 500,
    maxTransactions: 500,
  },
  standard: {
    name: "Standard Plan",
    maxWorkspaces: 3,
    maxApps: 3,
    maxBranches: 3,
    maxMembers: 10,
    maxProducts: 5000,
    maxTransactions: 5000,
  },
  premium: {
    name: "Premium Plan",
    maxWorkspaces: 10,
    maxApps: "unlimited",
    maxBranches: 10,
    maxMembers: 50,
    maxProducts: 25000,
    maxTransactions: 25000,
  },
};

interface UsageItemProps {
  label: string;
  icon: React.ReactNode;
  current: number;
  max: number | "unlimited";
  unit: string;
}

const UsageMetricCard: React.FC<UsageItemProps> = ({
  label,
  icon,
  current,
  max,
  unit,
}) => {
  const isUnlimited = max === "unlimited" || (typeof max === "number" && max >= 999);
  const numericMax = typeof max === "number" ? max : 100;
  const percentage = isUnlimited ? 0 : Math.min(Math.round((current / numericMax) * 100), 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className="p-5 rounded-xl bg-[#140d12] border border-white/10 space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#714b67]/20 text-[#c79dbd] border border-[#714b67]/30">
            {icon}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{label}</h4>
            <p className="text-[11px] text-slate-400">
              {current} / {isUnlimited ? "∞" : numericMax.toLocaleString()} {unit}
            </p>
          </div>
        </div>

        {!isUnlimited && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isAtLimit
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : isNearLimit
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}
          >
            {percentage}%
          </span>
        )}
      </div>

      {!isUnlimited && (
        <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isAtLimit
                ? "bg-rose-500"
                : isNearLimit
                ? "bg-amber-500"
                : "bg-[#714b67]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {isAtLimit && (
        <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
          <AlertTriangle className="w-3 h-3" />
          Plan quota reached. Upgrade to expand capacity.
        </p>
      )}
    </div>
  );
};

export const UsagePage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentWorkspace, workspaces, products } = useWorkspaceStore();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);

  const planKey = (currentWorkspace?.type || "free").toLowerCase();
  const planInfo = PLAN_LIMITS_MAP[planKey] || PLAN_LIMITS_MAP.free;

  const handleOpenUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeModalOpen(true);
  };

  const activeAppsCount = (products || []).filter(
    (p) => (p.status || "").toLowerCase() === "active" || (p.status || "").toLowerCase() === "trial"
  ).length;

  const isNearAnyLimit =
    workspaces.length >= planInfo.maxWorkspaces ||
    (typeof planInfo.maxApps === "number" && activeAppsCount >= planInfo.maxApps);

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Zoho-Style Per-User Subscription</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Usage & Capacity Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time resource utilization across all your workspaces and business applications.
          </p>
        </div>

        <button
          onClick={() => handleOpenUpgrade("usage_limit")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition cursor-pointer self-start sm:self-center shrink-0"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Upgrade Capacity</span>
        </button>
      </div>

      {/* Near Limit Alert */}
      {isNearAnyLimit && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              You have reached or are approaching your current plan limits. Upgrade to Standard or Premium for higher resource capacity.
            </span>
          </div>
          <button
            onClick={() => handleOpenUpgrade("usage_limit")}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#180f16] to-[#0d070b] border border-[#714b67]/40 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c79dbd]">
              Active Plan
            </span>
            <h2 className="text-2xl font-extrabold text-white mt-0.5">
              {planInfo.name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Covers all organizations and applications owned by{" "}
              <span className="text-slate-200 font-medium">{user?.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              ACTIVE
            </span>
            <button
              onClick={() => handleOpenUpgrade("general")}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
            >
              Change Plan
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Usage Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <UsageMetricCard
          label="Workspaces / Orgs"
          icon={<Building2 className="w-4 h-4" />}
          current={workspaces.length || 1}
          max={planInfo.maxWorkspaces}
          unit="workspaces"
        />

        <UsageMetricCard
          label="Apps per Workspace"
          icon={<Layers className="w-4 h-4" />}
          current={activeAppsCount || 1}
          max={planInfo.maxApps}
          unit="apps"
        />

        <UsageMetricCard
          label="Branches per App"
          icon={<Store className="w-4 h-4" />}
          current={1}
          max={planInfo.maxBranches}
          unit="branches"
        />

        <UsageMetricCard
          label="Team Members"
          icon={<Users className="w-4 h-4" />}
          current={1}
          max={planInfo.maxMembers}
          unit="members"
        />

        <UsageMetricCard
          label="Products Catalogue"
          icon={<Package className="w-4 h-4" />}
          current={0}
          max={planInfo.maxProducts}
          unit="products"
        />

        <UsageMetricCard
          label="Monthly Transactions"
          icon={<Receipt className="w-4 h-4" />}
          current={0}
          max={planInfo.maxTransactions}
          unit="transactions"
        />
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
export default UsagePage;
