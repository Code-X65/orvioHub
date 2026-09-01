import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useHost } from '@/host/useHost';
import { getLauncherUrl } from '@orviohub/shared';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface ProductNotActivatedProps {
  productKey?: string;
  onActivated?: () => void;
}

export const ProductNotActivated: React.FC<ProductNotActivatedProps> = ({
  productKey = 'inventory',
  onActivated,
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  const host = useHost();
  const env = host.environment;
  const launcherUrl = getLauncherUrl(env);

  const workspaceId = currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id');
  const workspaceName = currentWorkspace?.name || 'Your Organization';

  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    if (!workspaceId) {
      toast.error('No active workspace selected.');
      return;
    }

    setIsActivating(true);
    try {
      await api.post(
        `/workspaces/${workspaceId}/products/${productKey}/activate`,
        { planId: 'standard' }
      );
      toast.success('Application activated successfully for your workspace!');
      onActivated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate product.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-[#714b67]">
      <div className="max-w-md w-full bg-[#120b10] border border-white/10 rounded-2xl p-7 sm:p-8 space-y-6 shadow-2xl text-center relative overflow-hidden">
        {/* Decorative pattern accent */}
        <div
          className="absolute -bottom-8 -right-8 w-32 h-32 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23FDB02F' stroke-width='2'/%3E%3Cpath d='M10 10L30 30M10 30L30 10' stroke='%23714B67' stroke-width='2'/%3E%3C/svg%3E\")",
            backgroundSize: '40px 40px',
          }}
        />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#1d101b] border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#FDB02F] shadow-lg">
          <InventoryIcon className="w-9 h-9" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c79dbd] bg-[#714b67]/20 px-2.5 py-0.5 rounded-full border border-[#714b67]/30">
            <Sparkles className="w-3 h-3 text-[#FDB02F]" />
            <span>Workspace Activation Required</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Activate Inventory & POS
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            Your workspace <strong>{workspaceName}</strong> has not yet enabled the Inventory module. Activate now to start tracking stock and POS sales.
          </p>
        </div>

        {/* Features preview bullets */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-left text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Real-time multi-branch stock levels</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Barcode scanner & receipt generation</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>14-day full free trial with all features</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white font-semibold text-xs rounded-lg shadow-lg shadow-[#714b67]/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isActivating && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            <span>{isActivating ? 'Activating Module...' : 'Activate for This Workspace'}</span>
            {!isActivating && <ArrowRight className="w-4 h-4" />}
          </Button>

          <a
            href={launcherUrl}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to App Launcher</span>
          </a>
        </div>
      </div>
    </div>
  );
};
