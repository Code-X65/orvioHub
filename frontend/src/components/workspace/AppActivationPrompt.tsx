import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Layers,
  Sparkles,
  ArrowRight,
  X,
  AlertCircle,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppActivationPromptProps {
  organizationId: string;
  organizationName: string;
  planKey?: string;
  onActivated?: () => void;
  className?: string;
  storageKey?: string;
}

function isDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(key) === 'true';
}

/**
 * Persistent, dismissible app-activation prompt.
 *
 * Unlike the one-time onboarding modal, this card remains accessible from the
 * Workplace/launcher surface so users who skipped onboarding can activate
 * Inventory at any time without being locked out.
 */
export const AppActivationPrompt: React.FC<AppActivationPromptProps> = ({
  organizationId,
  organizationName,
  planKey = 'free_trial',
  onActivated,
  className,
  storageKey = 'orvio_app_activation_prompt_dismissed',
}) => {
  const [hidden, setShown] = useState<boolean>(() => isDismissed(storageKey));
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFreeTrial = planKey === 'free_trial' || planKey === 'free';
  const canActivate = !isFreeTrial || true; // free_trial allows 1 app

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, 'true');
    }
    setShown(false);
    onActivated?.();
  };

  const handleActivate = async () => {
    if (!organizationId) return;
    setIsActivating(true);
    setError(null);
    try {
      await api.post(`/organizations/${organizationId}/applications/inventory/activate`, {
        planKey,
      });
      toast.success('Inventory & POS activated successfully!');
      onActivated?.();
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Failed to activate application.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  if (hidden) return null;

  return (
    <div
      className={cn(
        'rounded-sm border border-[#714b67]/40 bg-gradient-to-r from-[#1a0e16] to-[#120a11] p-4 sm:p-5 shadow-xl space-y-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-sm bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-[#c79dbd] bg-[#714b67]/20 px-2 py-0.5 rounded-sm border border-[#714b67]/30 uppercase tracking-wider">
                Not Setup
              </span>
              {isFreeTrial && (
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-sm border border-amber-500/20 flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Free Trial
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Activate Inventory & POS for {organizationName}
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Track stock, process sales, and manage branches. Activate now to get started.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-sm text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss activation prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-2 rounded-sm bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleActivate}
          disabled={isActivating || !canActivate}
          className="flex-1 h-9 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {isActivating ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>Activating…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
              <span>Activate Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
        <Link
          to="/settings/billing"
          className="h-9 px-3 rounded-sm border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Crown className="w-3 h-3" />
          <span>Upgrade</span>
        </Link>
      </div>
    </div>
  );
};

export default AppActivationPrompt;