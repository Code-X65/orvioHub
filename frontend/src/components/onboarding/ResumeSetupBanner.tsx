import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ResumeSetupBannerProps {
  orgName?: string;
  step?: number;
  product?: string;
  currentStepName?: string;
  onResume: () => void;
  onDismiss: () => void;
}

const STEP_NAMES: Record<number, string> = {
  1: 'Organization Details',
  2: 'Branch & Location',
  3: 'Contact & Verification',
  4: 'Team Invitations',
  5: 'Final Launch',
};

export const ResumeSetupBanner: React.FC<ResumeSetupBannerProps> = ({
  orgName,
  step = 1,
  currentStepName,
  onResume,
  onDismiss,
}) => {
  const stepLabel = currentStepName || STEP_NAMES[step] || `Step ${step}`;

  return (
    <div className="relative w-full rounded-xs bg-gradient-to-r from-[#170e15] via-[#100a0e] to-[#0a0609] border border-[#714b67]/40 p-4 sm:p-5 shadow-2xl backdrop-blur-xl overflow-hidden group transition-all animate-in fade-in duration-300">
      {/* Top subtle glow accent line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#c79dbd]/40 to-transparent pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        {/* Left icon + copy */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xs bg-[#241320] border border-[#714b67]/50 text-[#e2b9d8] flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-[#f0d8e8]" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Continue Your Organization Setup
              </h3>
              {orgName && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-[#714b67]/25 text-[#f0d8e8] border border-[#714b67]/40">
                  {orgName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 font-normal leading-relaxed">
              You left off on <strong className="text-white font-medium">Step {step}</strong> ({stepLabel}). Complete setup to start managing your business and launching apps.
            </p>
          </div>
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 px-3 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer rounded-xs"
          >
            Dismiss
          </button>
          <Button
            onClick={onResume}
            className="h-9 px-4 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#825576] hover:to-[#9f6690] text-white rounded-xs text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <span>Resume Setup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
