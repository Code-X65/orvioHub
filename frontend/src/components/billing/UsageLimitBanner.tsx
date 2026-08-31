import React from "react";
import { AlertCircle, AlertTriangle, ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UsageLimitBannerProps {
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
      className={`relative w-full rounded-xs p-4 sm:p-5 shadow-2xl backdrop-blur-xl overflow-hidden group transition-all animate-in fade-in duration-300 ${
        isReached
          ? "bg-gradient-to-r from-[#1c0c11] via-[#14080c] to-[#0a0406] border border-rose-900/40"
          : "bg-gradient-to-r from-[#1c1308] via-[#140c05] to-[#0a0602] border border-amber-900/40"
      }`}
    >
      {/* Top glowing accent line */}
      <div
        className={`absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-current to-transparent pointer-events-none opacity-40 ${
          isReached ? "text-rose-500" : "text-amber-500"
        }`}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        {/* Left icon + copy */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xs flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform ${
              isReached
                ? "bg-rose-950/50 border border-rose-800/50 text-rose-400"
                : "bg-amber-950/50 border border-amber-800/50 text-amber-400"
            }`}
          >
            {isReached ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-xs ${
                  isReached
                    ? "bg-rose-900/30 text-rose-300 border border-rose-700/40"
                    : "bg-amber-900/30 text-amber-300 border border-amber-700/40"
                }`}
              >
                {isReached ? "Limit Reached" : "Approaching Limit"}
              </span>
              <span className="text-xs text-slate-400 capitalize font-medium">({planKey} Plan)</span>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">{warningMessage}</p>
          </div>
        </div>

        {/* Right upgrade button */}
        <Button
          onClick={onUpgradeClick}
          className={`h-9 px-4 rounded-xs text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 self-end sm:self-center shrink-0 ${
            isReached
              ? "bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 hover:from-rose-600 hover:to-rose-500 text-white shadow-rose-950/50"
              : "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-500 text-white shadow-amber-950/50"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Upgrade Plan</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
