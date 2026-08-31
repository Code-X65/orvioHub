import React from "react";
import { Sparkles, Layers, Users, Package, ShoppingBag, ArrowUpRight } from "lucide-react";

interface ResourceMetric {
  current: number;
  limit: number;
  percent: number;
  isApproaching: boolean;
  isReached: boolean;
}

interface UsageSummaryData {
  workspaceId: string;
  planKey: string;
  metrics: {
    workspaces: ResourceMetric;
    apps: ResourceMetric;
    members: ResourceMetric;
    products: ResourceMetric;
    transactions: ResourceMetric;
  };
  hasApproachingLimits: boolean;
  hasExceededLimits: boolean;
  warningMessage?: string | null;
}

interface UsageWidgetProps {
  summary: UsageSummaryData | null;
  onUpgradeClick: () => void;
}

export const UsageWidget: React.FC<UsageWidgetProps> = ({ summary, onUpgradeClick }) => {
  if (!summary) return null;

  const { planKey, metrics } = summary;

  const getProgressBarColor = (percent: number) => {
    if (percent >= 100) return "bg-rose-500 shadow-rose-500/20";
    if (percent >= 80) return "bg-amber-500 shadow-amber-500/20";
    return "bg-emerald-500 shadow-emerald-500/20";
  };

  const getPercentTextColor = (percent: number) => {
    if (percent >= 100) return "text-rose-400";
    if (percent >= 80) return "text-amber-400";
    return "text-emerald-400";
  };

  const resources = [
    {
      label: "Active Applications",
      icon: Layers,
      data: metrics.apps,
      unit: "apps",
    },
    {
      label: "Team Members",
      icon: Users,
      data: metrics.members,
      unit: "members",
    },
    {
      label: "Inventory Products",
      icon: Package,
      data: metrics.products,
      unit: "products",
    },
    {
      label: "Monthly Transactions",
      icon: ShoppingBag,
      data: metrics.transactions,
      unit: "txs",
    },
  ];

  return (
    <div className="p-5 md:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Plan & Resource Quotas</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {planKey} Plan
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Live resource capacity tracking for this billing period.</p>
        </div>

        {planKey !== "premium" && (
          <button
            type="button"
            onClick={onUpgradeClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Progress Bars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {resources.map((res) => {
          const Icon = res.icon;
          const { current, limit, percent } = res.data;
          const limitDisplay = limit >= 999999 ? "Unlimited" : limit.toLocaleString();

          return (
            <div key={res.label} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{res.label}</span>
                </div>
                <span className={`text-xs font-mono font-bold ${getPercentTextColor(percent)}`}>
                  {current.toLocaleString()} / {limitDisplay}
                </span>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(percent)}`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{percent}% consumed</span>
                {percent >= 100 ? (
                  <span className="text-rose-400 font-bold">Quota Full</span>
                ) : percent >= 80 ? (
                  <span className="text-amber-400 font-bold">Nearing Quota</span>
                ) : (
                  <span className="text-emerald-400">Normal</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
