import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export interface MinimumViableWorkspaceChecklistProps {
  steps: ChecklistStep[];
  completedSteps: string[];
  onStepClick?: (step: ChecklistStep) => void;
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  storageKey?: string;
}

function isDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(key) === 'true';
}

export const MinimumViableWorkspaceChecklist: React.FC<MinimumViableWorkspaceChecklistProps> = ({
  steps,
  completedSteps,
  onStepClick,
  className,
  dismissible = true,
  onDismiss,
  storageKey = 'orvio_mvw_checklist_dismissed',
}) => {
  const [hidden, setHidden] = useState<boolean>(() => isDismissed(storageKey));

  const completedCount = steps.filter((s) => completedSteps.includes(s.id)).length;
  const allDone = completedCount === steps.length;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, 'true');
    }
    setHidden(true);
    onDismiss?.();
  };

  if (hidden || allDone) return null;

  return (
    <div
      className={cn(
        'rounded-sm border border-[#714b67]/30 bg-[#120a11]/90 backdrop-blur-sm p-4 space-y-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#c79dbd] bg-[#714b67]/20 px-2 py-0.5 rounded-sm border border-[#714b67]/30 uppercase tracking-wider">
              Setup Progress
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {completedCount} of {steps.length}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Complete your workspace setup
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Finish these steps to unlock full Inventory operations.
          </p>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-sm text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss checklist"
          >
            <Circle className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {steps.map((step) => {
          const isDone = completedSteps.includes(step.id);
          return (
            <Link
              key={step.id}
              to={step.href}
              onClick={() => onStepClick?.(step)}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-sm transition-colors group',
                isDone
                  ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                  : 'bg-white/5 hover:bg-white/10'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-sm flex items-center justify-center shrink-0',
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-slate-400 group-hover:text-white'
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : step.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-xs font-semibold truncate',
                    isDone ? 'text-emerald-400' : 'text-white group-hover:text-white'
                  )}
                >
                  {step.label}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {step.description}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
            </Link>
          );
        })}
      </div>

      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#714b67] to-[#FDB02F] transition-all duration-300"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default MinimumViableWorkspaceChecklist;