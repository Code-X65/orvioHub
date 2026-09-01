import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ProductCardData } from './ProductCard';

export interface ProductActivationModalProps {
  product: ProductCardData;
  isOpen: boolean;
  onClose: () => void;
  onActivated: (productKey: string) => void;
}

export const ProductActivationModal: React.FC<ProductActivationModalProps> = ({
  product,
  isOpen,
  onClose,
  onActivated,
}) => {
  const { currentWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const workspaceId = currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id');
  const orgName = currentWorkspace?.name || 'Your Organization';
  const planKey = (currentWorkspace?.type || 'free').toLowerCase();

  const handleActivate = async () => {
    if (!workspaceId) {
      toast.error('No active organization selected.');
      return;
    }

    setIsActivating(true);
    setErrorMessage(null);

    try {
      await api.post(`/workspaces/${workspaceId}/products/${product.key}/activate`, {
        planId: planKey,
      });

      toast.success(`Application "${product.name}" activated for ${orgName}!`);
      await fetchWorkspaces();
      onActivated(product.key);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to activate product.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  const isLimitError =
    errorMessage?.toLowerCase().includes('limit') ||
    errorMessage?.toLowerCase().includes('upgrade');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#120b10] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 overflow-hidden">
        {/* Decorative Background Accent */}
        <div
          className="absolute -bottom-10 -right-10 w-36 h-36 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23FDB02F' stroke-width='2'/%3E%3Cpath d='M10 10L30 30M10 30L30 10' stroke='%23714B67' stroke-width='2'/%3E%3C/svg%3E\")",
            backgroundSize: '40px 40px',
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F] font-bold text-xl shrink-0">
            {product.key === 'inventory' || product.name.toLowerCase().includes('inventory') ? (
              <InventoryIcon className="w-7 h-7" />
            ) : (
              <span>{product.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FDB02F] uppercase tracking-wider bg-[#FDB02F]/10 px-2 py-0.5 rounded-full border border-[#FDB02F]/20">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Modular App Activation</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Activate {product.name}
            </h2>
            <p className="text-xs text-slate-400">
              Enable this application for <strong className="text-slate-200">{orgName}</strong>.
            </p>
          </div>
        </div>

        {/* Description & Features */}
        <div className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300">
          <p className="leading-relaxed text-slate-300">
            {product.description || product.headline}
          </p>

          {product.features && product.features.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Included Features:
              </span>
              {product.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-300 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Limit Warning / Error Feedback */}
        {isLimitError ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Plan App Limit Reached</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {errorMessage || 'Your current organization plan has reached its limit of active applications.'}
            </p>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isActivating}
            className="text-xs h-10 border-white/10 text-slate-300 hover:text-white"
          >
            Cancel
          </Button>

          {isLimitError ? (
            <a
              href="/pricing"
              className="h-10 px-4 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-[#714b67]/20"
            >
              <span>Upgrade Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <Button
              type="button"
              onClick={handleActivate}
              disabled={isActivating}
              className="h-10 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#714b67]/20"
            >
              {isActivating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <span>Activate for {orgName}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
