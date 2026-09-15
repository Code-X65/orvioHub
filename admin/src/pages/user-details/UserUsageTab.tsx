import React, { useState } from "react";
import {
  Gauge,
  Building,
  RefreshCw,
  Layers,
  Users,
  GitBranch,
  Package,
  Activity,
} from "lucide-react";

interface UserUsageTabProps {
  usageData: any;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
}

export const UserUsageTab: React.FC<UserUsageTabProps> = ({ usageData, loading, onRefresh }) => {
  const [recalculating, setRecalculating] = useState(false);

  if (loading || !usageData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading usage quotas and entitlement meters...
      </div>
    );
  }

  const { organizations } = usageData;

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      if (onRefresh) await onRefresh();
      alert("Entitlements and usage counters recalculated successfully.");
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Recalculate */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-brand-400" />
            <h3 className="text-base font-bold text-white">Usage & Entitlements Dashboard</h3>
          </div>
          <p className="text-xs text-slate-400">
            Real-time usage metrics against active plan quotas across all owned organizations.
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
          <span>Recalculate Entitlements</span>
        </button>
      </div>

      {/* Per Organization Usage Meters */}
      {organizations.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
          No owned organizations with active usage meters found for this user.
        </div>
      ) : (
        <div className="space-y-6">
          {organizations.map((org: any) => {
            const { limits, currentUsage } = org;

            const renderMeter = (
              label: string,
              current: number,
              max: number | string,
              icon: React.ReactNode
            ) => {
              const isUnlimited = max === "unlimited";
              const numMax = typeof max === "number" ? max : 100;
              const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / numMax) * 100));
              const isWarning = percentage >= 85;

              return (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-300">
                      {icon}
                      <span>{label}</span>
                    </div>
                    <span className="font-bold text-white">
                      {current} / {isUnlimited ? "Unlimited" : max}
                    </span>
                  </div>

                  {!isUnlimited && (
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isWarning ? "bg-amber-500" : "bg-brand-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div
                key={org.workspaceId}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-brand-400" />
                    <div>
                      <span className="font-bold text-white text-sm">{org.organizationName}</span>
                      <span className="font-mono text-[11px] text-slate-500 block">slug: {org.slug}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 font-bold text-[10px] border border-blue-500/20 capitalize">
                    {org.planName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {renderMeter(
                    "Activated Apps",
                    currentUsage.apps,
                    limits.maxApps,
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  )}

                  {renderMeter(
                    "Store Branches",
                    currentUsage.branches,
                    limits.maxBranches,
                    <GitBranch className="w-3.5 h-3.5 text-brand-400" />
                  )}

                  {renderMeter(
                    "Team Members",
                    currentUsage.members,
                    limits.maxMembers,
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                  )}

                  {renderMeter(
                    "Products Catalog",
                    currentUsage.products,
                    limits.maxProducts,
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                  )}

                  {renderMeter(
                    "Monthly Transactions",
                    currentUsage.transactions,
                    limits.maxTransactions,
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserUsageTab;
