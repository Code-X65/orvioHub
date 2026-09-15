import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { api } from "@/lib/api";
import {
  Building2,
  Layers,
  Store,
  Users,
  Package,
  Sparkles,
  AlertTriangle,
  ShoppingBag,
} from "lucide-react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

const PLAN_LIMITS_MAP: Record<
  string,
  {
    name: string;
    maxWorkspaces: number;
    maxApps: number;
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
    maxApps: 10,
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
  onUpgrade?: () => void;
}

const UsageMetricCard: React.FC<UsageItemProps> = ({
  label,
  icon,
  current,
  max,
  unit,
  onUpgrade,
}) => {
  const isUnlimited = max === "unlimited" || (typeof max === "number" && max >= 99999);
  const numericMax = typeof max === "number" ? max : 100;
  const percentage = isUnlimited ? 0 : Math.min(Math.round((current / numericMax) * 100), 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className="p-5 rounded-2xl bg-[#140d12] border border-white/10 space-y-3 relative overflow-hidden shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#714b67]/20 text-[#c79dbd] border border-[#714b67]/30">
            {icon}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{label}</h4>
            <p className="text-[11px] text-slate-400">
              {current.toLocaleString()} / {isUnlimited ? "∞" : numericMax.toLocaleString()} {unit}
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
                ? "bg-rose-500 shadow-sm shadow-rose-500/50"
                : isNearLimit
                ? "bg-amber-500 shadow-sm shadow-amber-500/50"
                : "bg-[#714b67]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {isAtLimit && (
        <div className="pt-1 flex items-center justify-between text-[11px]">
          <span className="text-rose-400 flex items-center gap-1 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Quota reached
          </span>
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="text-[#c79dbd] hover:text-white font-bold underline cursor-pointer"
            >
              Upgrade
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const UsagePage: React.FC = () => {
  const { currentWorkspace, workspaces, products } = useWorkspaceStore();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const [liveUsage, setLiveUsage] = useState<any>(null);

  const effectiveOrgId = currentWorkspace?.id || workspaces[0]?.workspace?.id;
  const effectiveOrgName = currentWorkspace?.name || workspaces[0]?.workspace?.name || "Your Business";

  const fetchUsage = async () => {
    if (!effectiveOrgId) return;
    try {
      const res: any = await api.get(`/usage?workspaceId=${effectiveOrgId}&organizationId=${effectiveOrgId}`).catch(() => null);
      if (res?.data) {
        setLiveUsage(res.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUsage();
  }, [effectiveOrgId]);

  const sub = currentWorkspace?.subscription;
  const planKey = (
    sub?.activePlan ||
    (sub?.status === "active" ? (sub?.selectedPlan || sub?.planKey) : null) ||
    currentWorkspace?.planKey ||
    currentWorkspace?.planId ||
    "free_trial"
  ).toLowerCase();
  const planInfo = PLAN_LIMITS_MAP[planKey] || PLAN_LIMITS_MAP.free_trial;

  const handleOpenUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeModalOpen(true);
  };

  // Metric derivations
  const currentWorkspacesCount = workspaces.length || 1;
  const currentAppsCount = (products || []).filter(
    (p) => (p.status || "").toLowerCase() === "active" || (p.status || "").toLowerCase() === "trial"
  ).length || 1;
  const currentBranchesCount = liveUsage?.branches || 1;
  const currentMembersCount = liveUsage?.members || 1;
  const currentProductsCount = liveUsage?.products || 0;
  const currentTxCount = liveUsage?.transactions || 0;

  const isNearAnyLimit =
    currentWorkspacesCount >= planInfo.maxWorkspaces ||
    currentAppsCount >= planInfo.maxApps ||
    currentBranchesCount >= planInfo.maxBranches;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold mb-2">
            <Building2 className="w-3 h-3 text-[#FDB02F]" />
            <span>Organization: {effectiveOrgName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Resource Usage & Quotas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time capacity tracking for {planInfo.name}. All limits are shared across this organization.
          </p>
        </div>

        <button
          onClick={() => handleOpenUpgrade("usage_limit")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition cursor-pointer self-start sm:self-center shrink-0 active:scale-95"
        >
          <Sparkles className="w-4 h-4 text-[#FDB02F]" />
          <span>Upgrade Capacity</span>
        </button>
      </div>

      {/* Near Limit Alert */}
      {isNearAnyLimit && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              You have reached or are approaching one or more resource limits on the <strong>{planInfo.name}</strong>. Upgrade to unlock higher capacity.
            </span>
          </div>
          <button
            onClick={() => handleOpenUpgrade("capacity_exceeded")}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold border border-amber-500/40 cursor-pointer shrink-0"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UsageMetricCard
          label="Organizations / Workspaces"
          icon={<Building2 className="w-4 h-4" />}
          current={currentWorkspacesCount}
          max={planInfo.maxWorkspaces}
          unit="orgs"
          onUpgrade={() => handleOpenUpgrade("workspace_limit")}
        />

        <UsageMetricCard
          label="Active Applications"
          icon={<Layers className="w-4 h-4" />}
          current={currentAppsCount}
          max={planInfo.maxApps}
          unit="apps"
          onUpgrade={() => handleOpenUpgrade("app_limit")}
        />

        <UsageMetricCard
          label="Branches per Application"
          icon={<Store className="w-4 h-4" />}
          current={currentBranchesCount}
          max={planInfo.maxBranches}
          unit="branches"
          onUpgrade={() => handleOpenUpgrade("branch_limit")}
        />

        <UsageMetricCard
          label="Team Members / Staff"
          icon={<Users className="w-4 h-4" />}
          current={currentMembersCount}
          max={planInfo.maxMembers}
          unit="members"
          onUpgrade={() => handleOpenUpgrade("member_limit")}
        />

        <UsageMetricCard
          label="Catalogue Products (SKUs)"
          icon={<Package className="w-4 h-4" />}
          current={currentProductsCount}
          max={planInfo.maxProducts}
          unit="products"
          onUpgrade={() => handleOpenUpgrade("product_limit")}
        />

        <UsageMetricCard
          label="Monthly Transactions"
          icon={<ShoppingBag className="w-4 h-4" />}
          current={currentTxCount}
          max={planInfo.maxTransactions}
          unit="transactions"
          onUpgrade={() => handleOpenUpgrade("transaction_limit")}
        />
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={effectiveOrgId || ""}
        workspaceSlug={currentWorkspace?.slug || "org"}
        triggerReason={upgradeReason}
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={() => {
          fetchUsage();
        }}
      />
    </div>
  );
};

export default UsagePage;
