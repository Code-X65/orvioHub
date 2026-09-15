import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  CheckCircle2,
  Building2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Boxes,
  AlertTriangle,
} from 'lucide-react';

export const ApplicationActivationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [orgId, setOrgId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('Your Business');
  const [isActivating, setIsActivating] = useState(false);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);

  // Entitlement & Subscription Status
  const [subscription, setSubscription] = useState<any>(null);
  const [canActivate, setCanActivate] = useState<boolean>(true);
  const [limitReason, setLimitReason] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaces('inventory').catch(() => {});
  }, [fetchWorkspaces]);

  useEffect(() => {
    let isMounted = true;
    const rawOrg =
      searchParams.get('org') ||
      searchParams.get('organizationId') ||
      localStorage.getItem('orvio_active_workspace_id') ||
      '';

    const checkActivationEligibility = async (targetOrgId: string) => {
      try {
        setIsCheckingOrg(true);
        // 1. Fetch organization details
        const orgRes: any = await api.get(`/organizations/${targetOrgId}`).catch(() => null);
        if (isMounted && orgRes?.data) {
          setOrgName(orgRes.data.organization?.name || orgRes.data.name || 'Your Business');
        }

        // 2. Fetch subscription & check entitlements
        const subRes: any = await api.get(`/organizations/${targetOrgId}/subscription`).catch(() => null);
        const sub = subRes?.data?.subscription || subRes?.subscription || subRes?.data;
        if (isMounted) {
          setSubscription(sub);
        }

        // Check entitlement endpoint
        const entRes: any = await api
          .get(`/entitlements/can-activate-app?workspaceId=${targetOrgId}&organizationId=${targetOrgId}&appKey=inventory`)
          .catch(() => null);

        if (isMounted) {
          if (entRes?.data?.allowed === false || entRes?.allowed === false) {
            setCanActivate(false);
            setLimitReason(
              entRes?.data?.reason ||
                entRes?.reason ||
                'Your current organization subscription has reached its application limit.'
            );
          } else {
            setCanActivate(true);
            setLimitReason(null);
          }
        }
      } catch {
        if (isMounted) {
          setCanActivate(true);
        }
      } finally {
        if (isMounted) {
          setIsCheckingOrg(false);
        }
      }
    };

    if (rawOrg) {
      setOrgId(rawOrg);
      checkActivationEligibility(rawOrg);
    } else if (workspaces.length > 0) {
      const firstId = workspaces[0].workspace?.id || (workspaces[0] as any).id;
      setOrgId(firstId);
      setOrgName(workspaces[0].workspace?.name || (workspaces[0] as any).name || 'Your Business');
      checkActivationEligibility(firstId);
    } else {
      setIsCheckingOrg(false);
    }

    return () => {
      isMounted = false;
    };
  }, [searchParams, workspaces]);

  const handleActivate = async () => {
    if (!orgId) {
      toast.error('No organization selected. Please select a business first.');
      return;
    }

    if (!canActivate) {
      setUpgradeModalOpen(true);
      return;
    }

    setIsActivating(true);
    try {
      await api.post(`/organizations/${orgId}/applications/inventory/activate`, {
        applicationKey: 'inventory',
      });
      toast.success(`Inventory application activated for ${orgName}!`);
      navigate(`/onboard/app?org=${orgId}`);
    } catch (err: any) {
      if (err?.message?.includes('limit') || err?.code === 'LIMIT_EXCEEDED') {
        setCanActivate(false);
        setLimitReason(err.message);
        setUpgradeModalOpen(true);
      } else {
        toast.error(err?.message || 'Failed to activate Inventory application.');
      }
    } finally {
      setIsActivating(false);
    }
  };

  const planKey = (
    subscription?.activePlan ||
    (subscription?.status === 'active' ? (subscription?.selectedPlan || subscription?.planKey) : null) ||
    subscription?.planKey ||
    'free_trial'
  ).toLowerCase();
  const isTrial = planKey === 'free' || planKey === 'free_trial' || planKey === 'trial';

  if (isCheckingOrg) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Verifying organization subscription entitlements...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8 animate-in fade-in duration-300">
        {/* Header Badge & Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-[#c79dbd] text-xs font-bold shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-[#FDB02F]" />
            <span>Organization: {orgName}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Activate Inventory Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
            Set up stock tracking, barcode scanning, POS checkout, and branch sales for <strong className="text-white">{orgName}</strong>.
          </p>
        </div>

        {/* Subscription Status Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#140d12] border border-white/10 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#c79dbd]">
                <Boxes className="w-6 h-6 text-[#FDB02F]" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Organization Subscription
                </span>
                <h3 className="text-lg font-bold text-white">
                  {isTrial ? '30-Day Free Trial' : 'Standard Plan'}
                </h3>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-center ${
              isTrial
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {isTrial ? 'FREE TRIAL ACTIVE' : 'ACTIVE SUBSCRIPTION'}
            </span>
          </div>

          {/* Features Included Under Org Subscription */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Included with your organization plan:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Fast POS Checkout & Receipts</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Live Inventory & Low Stock Alerts</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Single or Multi-Branch Stock Control</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Audit Trail & Daily Sales Reports</span>
              </div>
            </div>
          </div>

          {/* Limit Notice if Cannot Activate */}
          {!canActivate && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">Application Quota Limit Reached</p>
                <p className="text-slate-300 leading-relaxed">
                  {limitReason || 'Your current organization subscription has reached its maximum application quota. Please upgrade to the Standard Plan to activate more applications.'}
                </p>
              </div>
            </div>
          )}

          {/* Action CTA */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#c79dbd]" />
              <span>Application creation is managed under your organization entitlement.</span>
            </div>

            {canActivate ? (
              <Button
                onClick={handleActivate}
                disabled={isActivating}
                className="w-full sm:w-auto h-11 px-8 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                {isActivating ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    <span>Activating Inventory...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Inventory Onboarding</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setUpgradeModalOpen(true)}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Upgrade Plan to Add Application</span>
              </Button>
            )}
          </div>
        </div>
      </main>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={orgId}
        workspaceSlug={orgName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
        triggerReason="app_limit"
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={() => {
          setCanActivate(true);
          setUpgradeModalOpen(false);
          toast.success('Organization upgraded successfully! You can now activate Inventory.');
        }}
      />
    </div>
  );
};

export default ApplicationActivationPage;
