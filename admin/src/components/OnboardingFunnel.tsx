import React from "react";
import { Users, TrendingDown, ArrowRight } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

interface OnboardingFunnelProps {
  stages: Stage[];
  overallConversionRate?: number;
}

export const OnboardingFunnel: React.FC<OnboardingFunnelProps> = ({
  stages,
  overallConversionRate,
}) => {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">Onboarding Conversion Funnel</h3>
        </div>
        {overallConversionRate !== undefined && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Overall Conversion: {overallConversionRate}%
          </span>
        )}
      </div>

      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const widthPercent = Math.max(8, Math.round((stage.count / maxCount) * 100));

          return (
            <div key={stage.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{stage.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">{stage.count} users</span>
                  <span className="text-[11px] text-brand-300 font-semibold bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                    {stage.conversionRate}% conv
                  </span>
                </div>
              </div>

              {/* Progress visual bar */}
              <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
                <div
                  style={{ width: `${widthPercent}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx === 0
                      ? "bg-gradient-to-r from-brand-600 to-brand-400"
                      : idx === stages.length - 1
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                      : "bg-gradient-to-r from-indigo-600 to-brand-500"
                  }`}
                />
              </div>

              {idx < stages.length - 1 && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-slate-600" /> Next stage step
                  </span>
                  <span className="text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Dropoff: {stages[idx + 1] ? 100 - stages[idx + 1].conversionRate : 0}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingFunnel;
