import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { openPaystackPopup } from '@/lib/payment';
import {
  Package,
  CheckCircle2,
  Check,
  Building2,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PlanKey = 'free_trial' | 'standard';
type BillingCycle = 'monthly' | 'annual';

interface PlanOption {
  key: PlanKey;
  name: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  appLimitText: string;
  branchLimitText: string;
  memberLimitText: string;
  productLimitText: string;
  features: string[];
}

const ORG_PLANS: PlanOption[] = [
  {
    key: 'free_trial',
    name: '30-Day Free Trial',
    badge: 'No Card Required',
    badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    description: 'Full exploration of all features for your organization for 30 days.',
    monthlyPrice: 0,
    annualPrice: 0,
    appLimitText: '1 Activated App (Inventory)',
    branchLimitText: '1 Branch Location (Main Store)',
    memberLimitText: 'Up to 2 Team Members',
    productLimitText: '500 Products & 500 Tx/mo',
    features: [
      '1 Activated Application (Inventory)',
      '1 Branch Location (Main Store)',
      'Full POS checkouts & receipt generation',
      'Stock alert notifications & multi-user',
      '1 free trial organization per user',
    ],
  },
  {
    key: 'standard',
    name: 'Standard Plan',
    badge: 'Recommended for Growth',
    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    description: 'Multi-app & multi-branch management for growing Nigerian businesses.',
    monthlyPrice: 7500,
    annualPrice: 75000,
    appLimitText: 'Up to 3 Applications Included',
    branchLimitText: 'Up to 3 Branches per app',
    memberLimitText: 'Up to 10 Team Members',
    productLimitText: '5,000 Products & 5,000 Tx/mo',
    features: [
      'Up to 3 Applications for your organization',
      'Up to 3 Branches per application',
      'Up to 10 Organization Staff / Cashiers',
      '5,000 Products & 5,000 Monthly Tx',
      'Comprehensive audit trail & logs',
      'Priority Nigerian business support',
    ],
  },
];

export const ApplicationActivationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [orgId, setOrgId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('Your Business');
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('free_trial');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isActivating, setIsActivating] = useState(false);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);

  useEffect(() => {
    fetchWorkspaces('inventory').catch(() => {});
  }, [fetchWorkspaces]);

  useEffect(() => {
    const rawOrg =
      searchParams.get('org') ||
      searchParams.get('organizationId') ||
      localStorage.getItem('orvio_active_workspace_id') ||
      '';

    if (rawOrg) {
      setOrgId(rawOrg);
      api
        .get<{ success: boolean; data: any }>(`/organizations/${rawOrg}`)
        .then((res) => {
          if (res?.data?.organization?.name) {
            setOrgName(res.data.organization.name);
          } else if (res?.data?.name) {
            setOrgName(res.data.name);
          }
        })
        .catch(() => {
          const matchedWs = workspaces.find((w) => w.workspace.id === rawOrg);
          if (matchedWs) {
            setOrgName(matchedWs.workspace.name);
          }
        });

      // Check organization subscription status
      api
        .get<{ success: boolean; data: any }>(`/organizations/${rawOrg}/subscription`)
        .then((res) => {
          if (res?.data?.subscription?.planKey) {
            const plan = res.data.subscription.planKey;
            if (plan === 'standard') {
              setSelectedPlan(plan);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsCheckingOrg(false);
        });
    } else if (workspaces.length > 0) {
      setOrgId(workspaces[0].workspace.id);
      setOrgName(workspaces[0].workspace.name);
      setIsCheckingOrg(false);
    } else {
      setIsCheckingOrg(false);
    }
  }, [searchParams, workspaces]);

  const activePlanDetails = ORG_PLANS.find((p) => p.key === selectedPlan) || ORG_PLANS[0];
  const activePrice = billingCycle === 'annual' ? activePlanDetails.annualPrice : activePlanDetails.monthlyPrice;

  const handleActivate = async () => {
    if (!orgId) {
      toast.error('No organization selected. Please select a business first.');
      return;
    }

    // Paid Plan Flow (Standard Plan)
    if (selectedPlan === 'standard') {
      setIsActivating(true);
      const amount = billingCycle === 'annual' ? activePlanDetails.annualPrice : activePlanDetails.monthlyPrice;
      try {
        await openPaystackPopup({
          email: user?.email || 'customer@business.localhost',
          amountInNaira: amount,
          planName: `${orgName} - ${activePlanDetails.name} (${billingCycle})`,
          onSuccess: async (reference) => {
            try {
              await api.post(`/organizations/${orgId}/applications/inventory/activate`, {
                planKey: selectedPlan,
                billingCycle,
                paymentReference: reference,
                paymentGateway: 'paystack',
              });
              toast.success(`${orgName} upgraded to ${activePlanDetails.name} and Inventory activated!`);
              navigate(`/onboard/app?org=${orgId}`);
            } catch (err: any) {
              toast.error(err?.message || 'Activation failed after payment. Please contact support.');
            } finally {
              setIsActivating(false);
            }
          },
          onClose: () => {
            setIsActivating(false);
          },
        });
      } catch (err: any) {
        setIsActivating(false);
        toast.error(err?.message || 'Failed to initialize Paystack gateway.');
      }
      return;
    }

    // Free Trial Flow
    setIsActivating(true);
    try {
      await api.post(`/organizations/${orgId}/applications/inventory/activate`, {
        planKey: 'free_trial',
        billingCycle: 'monthly',
      });
      toast.success('30-Day Free Trial activated for ' + orgName + '! Welcome to Inventory.');
      navigate(`/onboard/app?org=${orgId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate Inventory application.');
    } finally {
      setIsActivating(false);
    }
  };

  if (isCheckingOrg) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Loading business subscription details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Banner Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-[#c79dbd] text-xs font-bold shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-[#FDB02F]" />
            <span>Organization: {orgName}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Choose Plan for {orgName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Payments and subscriptions are strictly <strong className="text-slate-200">per organization</strong>. Your plan covers all applications (including Inventory), branches, and staff under this business.
          </p>

          {/* Org-Level Billing Reminder Callout */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
            <Info className="w-4 h-4 text-[#FDB02F] shrink-0" />
            <span>
              <strong>Organization-Level Billing:</strong> You do not pay per application or per branch. One plan unlocks the entire organization.
            </span>
          </div>
        </div>

        {/* Billing Cycle Switcher */}
        <div className="flex items-center justify-center">
          <div className="bg-[#120b10] p-1 rounded-xl border border-white/10 flex items-center shadow-inner">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                'px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer',
                billingCycle === 'monthly'
                  ? 'bg-[#714b67] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={cn(
                'px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer',
                billingCycle === 'annual'
                  ? 'bg-[#714b67] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-bold">
                2 Months Free
              </span>
            </button>
          </div>
        </div>

        {/* 2-Tier Organization Plans Grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {ORG_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.key;
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            const formattedPrice = price === 0 ? '₦0' : `₦${price.toLocaleString('en-NG')}`;
            const cycleText = price === 0 ? '/ 30 days' : billingCycle === 'annual' ? '/ year' : '/ month';

            return (
              <div
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                className={cn(
                  'p-6 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 relative overflow-hidden',
                  isSelected
                    ? 'bg-gradient-to-br from-[#241321] via-[#140b12] to-black border-[#714b67] shadow-xl shadow-[#714b67]/25 ring-2 ring-[#714b67]'
                    : 'bg-[#120b10] border-white/10 hover:border-white/20'
                )}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider',
                        plan.badgeColor
                      )}
                    >
                      {plan.badge}
                    </span>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border flex items-center justify-center transition-colors',
                        isSelected ? 'border-[#714b67] bg-[#714b67] text-white' : 'border-white/30'
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>
                  </div>

                  <div className="py-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-white">{formattedPrice}</span>
                    <span className="text-xs text-slate-400">{cycleText}</span>
                  </div>

                  {/* Highlights Pill */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-[11px]">
                    <div className="text-[#c79dbd] font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
                      <span>{plan.appLimitText}</span>
                    </div>
                    <div className="text-slate-300 font-medium">{plan.branchLimitText}</div>
                    <div className="text-slate-400">{plan.memberLimitText}</div>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-white/5 text-xs text-slate-300">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    {plan.key === 'free_trial' ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-[#FDB02F]" />
                        <span>Instant activation • No card required</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-purple-300" />
                        <span>Secure checkout via Paystack / Flutterwave</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Bar */}
        <div className="p-6 rounded-2xl bg-[#120b10] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
              <Package className="w-4 h-4 text-[#FDB02F]" />
              <span>Activate Inventory for {orgName}</span>
            </h4>
            <p className="text-xs text-slate-400">
              Selected Organization Plan:{' '}
              <strong className="text-white">
                {activePlanDetails.name} (
                {activePrice === 0
                  ? '₦0'
                  : `₦${activePrice.toLocaleString('en-NG')}${billingCycle === 'annual' ? '/yr' : '/mo'}`}
                )
              </strong>
            </p>
          </div>

          <Button
            type="button"
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs shadow-lg shadow-[#714b67]/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isActivating ? (
              <>
                <Spinner className="w-4 h-4" />
                <span>Activating {orgName}...</span>
              </>
            ) : (
              <>
                <span>
                  {selectedPlan === 'free_trial'
                    ? 'Start 30-Day Free Trial & Launch Inventory'
                    : `Pay ₦${activePrice.toLocaleString('en-NG')} & Launch Inventory`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ApplicationActivationPage;

