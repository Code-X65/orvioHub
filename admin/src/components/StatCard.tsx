import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
  variant?: "default" | "brand" | "emerald" | "indigo" | "amber" | "rose";
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  variant = "default",
}) => {
  const variantStyles = {
    default: "bg-slate-900/80 border-slate-800 text-slate-400",
    brand: "bg-slate-900/80 border-brand-500/30 text-brand-400",
    emerald: "bg-slate-900/80 border-emerald-500/30 text-emerald-400",
    indigo: "bg-slate-900/80 border-indigo-500/30 text-indigo-400",
    amber: "bg-slate-900/80 border-amber-500/30 text-amber-400",
    rose: "bg-slate-900/80 border-rose-500/30 text-rose-400",
  };

  const iconStyles = {
    default: "bg-slate-800 text-slate-300 border-slate-700",
    brand: "bg-brand-500/10 text-brand-400 border-brand-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <div className={`p-5 rounded-2xl border ${variantStyles[variant]} shadow-xl space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className={`p-2 rounded-xl border ${iconStyles[variant]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        <div className="flex items-center justify-between text-[11px]">
          {subtext && <span className="text-slate-400">{subtext}</span>}
          {trend && (
            <span
              className={`font-semibold ${
                trend.positive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
