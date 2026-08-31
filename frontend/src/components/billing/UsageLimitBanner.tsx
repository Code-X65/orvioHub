import React from "react";
import { AlertTriangle, AlertCircle, ArrowUpRight, Sparkles } from "lucide-react";

interface UsageLimitBannerProps {
  warningMessage?: string | null;
  isReached?: boolean;
  onUpgradeClick: () => void;
  planKey?: string;
}

export const UsageLimitBanner: React.FC<UsageLimitBannerProps> = ({
  warningMessage,
  isReached = false,
  onUpgradeClick,
  planKey = "free",
}) => {
  if (!warningMessage) return null;

  return (
    <div
      className={`w-full p-3.5 sm:p-4 rounded-2xl border transition-all animate-fadeIn flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        isReached
          ? "bg-rose-500/10 border-rose-500/30 text-rose-200 shadow-lg shadow-rose-500/5"
          : "bg-amber-500/10 border-amber-500/30 text-amber-200 shadow-lg shadow-amber-500/5"
      }`}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div
          className={`p-2 rounded-xl shrink-0 ${
            isReached
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {isReached ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isReached
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              {isReached ? "Limit Reached" : "Approaching Plan Limit"}
            </span>
            <span className="text-xs text-slate-400 capitalize">({planKey} Plan)</span>
          </div>
          <p className="text-xs mt-1 font-medium leading-relaxed">{warningMessage}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onUpgradeClick}
        className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md cursor-pointer ${
          isReached
            ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
            : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Upgrade Plan</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
