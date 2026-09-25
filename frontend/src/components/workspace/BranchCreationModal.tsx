import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { X, PlusCircle, Sparkles } from 'lucide-react';
import { BranchForm, type BranchFormData } from '@/components/branch';
import { useBranchLimit } from '@/hooks/useBranchLimit';

interface BranchCreationModalProps {
  isOpen: boolean;
  workspaceId: string;
  applicationKey?: string;
  onClose: () => void;
  onSuccess?: (newBranch: Branch) => void;
}

export const BranchCreationModal: React.FC<BranchCreationModalProps> = ({
  isOpen,
  workspaceId,
  applicationKey = 'inventory',
  onClose,
  onSuccess,
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { createBranch, branches } = useBranchStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const initialPlan = (currentWorkspace?.planKey || currentWorkspace?.planId || 'free_trial').toLowerCase();
  const [planKey, setPlanKey] = useState<string>(initialPlan);

  useEffect(() => {
    if (currentWorkspace) {
      const pk = (currentWorkspace.planKey || currentWorkspace.planId || 'free_trial').toLowerCase();
      setPlanKey(pk);
    }
    if (workspaceId) {
      api.get<any>(`/organizations/${workspaceId}/subscription`)
        .then((res) => {
          const sub = res?.subscription || res?.data?.subscription;
          const pk = (
            sub?.activePlan ||
            (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
            sub?.planKey ||
            res?.planKey ||
            initialPlan
          );
          if (pk) setPlanKey(String(pk).toLowerCase());
        })
        .catch(() => {});
    }
  }, [workspaceId, initialPlan, currentWorkspace]);

  const { atLimit, isFreeTrial, limitMessage, planName } = useBranchLimit({
    planKey,
    currentCount: branches.length,
  });

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmitBranch = async (formData: BranchFormData) => {
    if (!workspaceId) {
      toast.error('Organization context is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newBranch = await createBranch({
        workspaceId,
        organizationId: workspaceId,
        applicationKey,
        name: formData.name,
        code: formData.code,
        isPrimary: formData.isPrimary || branches.length === 0,
        country: formData.country || 'Nigeria',
        state: formData.state,
        stateCode: formData.stateCode,
        lga: formData.lga,
        city: formData.city,
        street: formData.street,
        blockNumber: formData.blockNumber,
        area: formData.area,
        landmark: formData.landmark,
        postalCode: formData.postalCode,
        address: formData.address,
        formattedAddress: formData.address,
        phone: formData.phone,
        email: formData.email,
      });

      toast.success(`Branch '${newBranch.name}' created successfully!`);
      if (onSuccess) onSuccess(newBranch);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0c080b]/95 border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-7 relative overflow-hidden my-auto max-h-[90vh] flex flex-col backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 text-[#d4a8c9] flex items-center justify-center shrink-0 shadow-inner">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Create New Branch</h3>
              <p className="text-xs text-slate-400">Add a store, warehouse, or operational branch</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {atLimit ? (
          <div className="py-8 px-4 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h4 className="text-base font-bold text-white">Branch Quota Limit Reached</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isFreeTrial
                  ? 'Organizations on the 30-Day Free Trial are entitled to 1 primary operational branch. To add more branch locations, manage multiple stores, and enable cross-branch inventory, please upgrade your subscription.'
                  : `Your organization has reached the limit on the ${planName} plan. Upgrade your subscription to add more branches.`}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-xs mx-auto">
              <Button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="w-full bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-[#714b67]/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FDB02F] mr-1.5" />
                <span>Upgrade Plan</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="w-full text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-y-auto pr-1">
            <BranchForm
              organizationId={workspaceId}
              showCode={true}
              showEmail={true}
              showPrimaryCheckbox={branches.length > 0}
              isPrimaryDefault={branches.length === 0}
              showOrgPrefill={true}
              variant="plain"
              theme="plum"
              isSubmitting={isSubmitting}
              submitLabel="Create Branch"
              submittingLabel="Creating..."
              onCancel={onClose}
              onSubmit={handleSubmitBranch}
            />
          </div>
        )}
      </div>

      {isUpgradeModalOpen && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          workspaceId={workspaceId}
          workspaceSlug={currentWorkspace?.slug}
          currentPlanKey={planKey}
          triggerReason="branch_limit"
          onClose={() => setIsUpgradeModalOpen(false)}
          onSuccess={() => {
            setIsUpgradeModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default BranchCreationModal;
