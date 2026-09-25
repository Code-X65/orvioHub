import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OperationStep } from '@/hooks/useOperationProgress';

export interface OperationProgressModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  steps: OperationStep[];
  currentStepIndex: number;
  completedSteps: string[];
  progressPercentage: number;
  isRunning: boolean;
  isCompleted: boolean;
  error?: string | null;
  onClose?: () => void;
}

export const OperationProgressModal: React.FC<OperationProgressModalProps> = ({
  isOpen,
  title,
  description,
  steps,
  currentStepIndex,
  completedSteps,
  progressPercentage,
  isRunning,
  isCompleted,
  error,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-[#120a11] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6 text-white animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#FDB02F] uppercase tracking-wider bg-[#FDB02F]/10 px-2 py-0.5 rounded-full border border-[#FDB02F]/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Operation in Progress</span>
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            {description && <p className="text-xs text-slate-400">{description}</p>}
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">
              {isCompleted ? 'Completed' : error ? 'Failed' : 'Processing...'}
            </span>
            <span className="text-[#FDB02F]">{progressPercentage}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
            <div
              className={cn(
                'h-full transition-all duration-300 rounded-full',
                error
                  ? 'bg-rose-500'
                  : isCompleted
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-[#714b67] via-[#a36993] to-[#FDB02F]'
              )}
              style={{ width: `${Math.max(5, progressPercentage)}%` }}
            />
          </div>
        </div>

        {/* Steps Checklist */}
        <div className="space-y-2.5 pt-1">
          {steps.map((step, idx) => {
            const isDone = completedSteps.includes(step.id) || idx < currentStepIndex || isCompleted;
            const isCurrent = idx === currentStepIndex && isRunning && !isCompleted && !error;
            const isStepFailed = idx === currentStepIndex && Boolean(error);

            return (
              <div
                key={step.id}
                className={cn(
                  'p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 text-xs',
                  isDone
                    ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                    : isCurrent
                    ? 'bg-[#714b67]/20 border-[#714b67]/40 text-white font-medium shadow-sm'
                    : isStepFailed
                    ? 'bg-rose-950/20 border-rose-500/20 text-rose-300'
                    : 'bg-white/[0.02] border-white/5 text-slate-500'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-[#FDB02F] animate-spin shrink-0" />
                  ) : isStepFailed ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/10 shrink-0" />
                  )}
                  <span className="truncate">{step.name}</span>
                </div>

                {isCurrent && (
                  <span className="text-[10px] text-slate-400 shrink-0 animate-pulse">Running…</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Error Alert if failed */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Close Button on completion or failure */}
        {(isCompleted || error) && onClose && (
          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={onClose}
              size="sm"
              className={cn(
                'h-8 px-4 text-xs font-semibold rounded-lg shadow-md cursor-pointer',
                isCompleted
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              )}
            >
              {isCompleted ? 'Done' : 'Dismiss'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
