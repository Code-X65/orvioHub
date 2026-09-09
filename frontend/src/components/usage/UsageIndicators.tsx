import React, { useState } from "react";
import {
  Building2,
  Layers,
  Store,
  Users,
  Package,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

export interface PlanLimits {
  name?: string;
  maxOrganizations?: number;
  maxWorkspaces?: number;
  maxAppsPerOrganization?: number | "unlimited";
  maxApps?: number | "unlimited";
  maxBranchesPerApp?: number;
  maxBranches?: number;
  maxMembersPerOrganization?: number;
  maxMembers?: number;
  maxProductsPerWorkspace?: number;
  maxProducts?: number;
  maxTransactionsPerMonth?: number;
  maxTransactions?: number;
}

export interface CurrentUsage {
  organizations?: number;
  workspaces?: number;
  apps?: number;
  branches?: number;
  members?: number;
  products?: number;
  transactions?: number;
}

export interface UsageIndicatorsProps {
  planKey?: string;
  limits?: PlanLimits;
  usage?: CurrentUsage;
  workspaceId?: string;
  workspaceSlug?: string;
  onUpgradeClick?: () => void;
}

export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    name: "30-Day Free Trial",
    maxOrganizations: 1,
    maxAppsPerOrganization: 1,
    maxBranchesPerApp: 1,
    maxMembersPerOrganization: 2,
    maxProductsPerWorkspace: 500,
    maxTransactionsPerMonth: 500,
  },
  free_trial: {
    name: "30-Day Free Trial",
    maxOrganizations: 1,
    maxAppsPerOrganization: 1,
    maxBranchesPerApp: 1,
    maxMembersPerOrganization: 2,
    maxProductsPerWorkspace: 500,
    maxTransactionsPerMonth: 500,
  },
  standard: {
    name: "Standard Plan",
    maxOrganizations: 3,
    maxAppsPerOrganization: 3,
    maxBranchesPerApp: 3,
    maxMembersPerOrganization: 10,
    maxProductsPerWorkspace: 5000,
    maxTransactionsPerMonth: 5000,
  },
  premium: {
    name: "Premium Plan",
    maxOrganizations: 10,
    maxAppsPerOrganization: "unlimited",
    maxBranchesPerApp: 10,
    maxMembersPerOrganization: 50,
    maxProductsPerWorkspace: 25000,
    maxTransactionsPerMonth: 25000,
  },
};

interface MetricItemProps {
  label: string;
  icon: React.ReactNode;
  current: number;
  max: number | "unlimited";
  unit: string;
  onUpgrade?: () => void;
}

export const UsageMetricItem: React.FC<MetricItemProps> = ({
  label,
  icon,
  current,
  max,
  unit,
  onUpgrade,
}) => {
  const isUnlimited = max === "unlimited" || (typeof max === "number" && max >= 999);
  const numericMax = typeof max === "number" ? max : 100;
  const percentage = isUnlimited ? 0 : Math.min(Math.round((current / numericMax) * 100), 100);
  const isAtLimit = !isUnlimited && current >= numericMax;
  const isNearLimit = !isUnlimited && !isAtLimit && percentage >= 80;

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#140d12] border border-white/10 space-y-3 relative overflow-hidden">
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
              isAtLimit ? "bg-rose-500" : isNearLimit ? "bg-amber-500" : "bg-[#714b67]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {isAtLimit && (
        <div className="pt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Plan limit reached ({current}/{numericMax}).</span>
          </p>
          {onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="text-[10px] font-bold text-[#c79dbd] hover:text-white flex items-center gap-0.5 cursor-pointer underline"
            >
              <span>Upgrade</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const UsageIndicators: React.FC<UsageIndicatorsProps> = ({
  planKey = "free_trial",
  limits: customLimits,
  usage: customUsage,
  workspaceId = "",
  workspaceSlug = "store",
  onUpgradeClick,
}) => {
  const [internalUpgradeOpen, setInternalUpgradeOpen] = useState(false);

  const normalizedKey = (planKey || "free_trial").toLowerCase();
  const defaultLimits = DEFAULT_PLAN_LIMITS[normalizedKey] || DEFAULT_PLAN_LIMITS.free_trial;

  const resolvedLimits: PlanLimits = {
    ...defaultLimits,
    ...customLimits,
  };

  const currentOrg = customUsage?.organizations ?? customUsage?.workspaces ?? 1;
  const maxOrg = resolvedLimits.maxOrganizations ?? resolvedLimits.maxWorkspaces ?? 1;

  const currentApps = customUsage?.apps ?? 1;
  const maxApps = resolvedLimits.maxAppsPerOrganization ?? resolvedLimits.maxApps ?? 1;

  const currentBranches = customUsage?.branches ?? 1;
  const maxBranches = resolvedLimits.maxBranchesPerApp ?? resolvedLimits.maxBranches ?? 1;

  const currentMembers = customUsage?.members ?? 1;
  const maxMembers = resolvedLimits.maxMembersPerOrganization ?? resolvedLimits.maxMembers ?? 2;

  const currentProducts = customUsage?.products ?? 0;
  const maxProducts = resolvedLimits.maxProductsPerWorkspace ?? resolvedLimits.maxProducts ?? 500;

  const currentTx = customUsage?.transactions ?? 0;
  const maxTx = resolvedLimits.maxTransactionsPerMonth ?? resolvedLimits.maxTransactions ?? 500;

  const triggerUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      setInternalUpgradeOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <UsageMetricItem
          label="Organizations"
          icon={<Building2 className="w-4 h-4" />}
          current={currentOrg}
          max={maxOrg}
          unit="orgs"
          onUpgrade={triggerUpgrade}
        />

        <UsageMetricItem
          label="Apps in Organization"
          icon={<Layers className="w-4 h-4" />}
          current={currentApps}
          max={maxApps}
          unit="apps"
          onUpgrade={triggerUpgrade}
        />

        <UsageMetricItem
          label="Branches per App"
          icon={<Store className="w-4 h-4" />}
          current={currentBranches}
          max={maxBranches}
          unit="branches"
          onUpgrade={triggerUpgrade}
        />

        <UsageMetricItem
          label="Team Members"
          icon={<Users className="w-4 h-4" />}
          current={currentMembers}
          max={maxMembers}
          unit="members"
          onUpgrade={triggerUpgrade}
        />

        <UsageMetricItem
          label="Products"
          icon={<Package className="w-4 h-4" />}
          current={currentProducts}
          max={maxProducts}
          unit="products"
          onUpgrade={triggerUpgrade}
        />

        <UsageMetricItem
          label="Monthly Transactions"
          icon={<Receipt className="w-4 h-4" />}
          current={currentTx}
          max={maxTx}
          unit="tx"
          onUpgrade={triggerUpgrade}
        />
      </div>

      <UpgradeModal
        isOpen={internalUpgradeOpen}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        currentPlanKey={planKey}
        triggerReason="usage_limit"
        onClose={() => setInternalUpgradeOpen(false)}
      />
    </>
  );
};

export default UsageIndicators;
