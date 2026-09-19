import React, { useState, useEffect } from 'react';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, ArrowRight, ChevronDown, CreditCard, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import { getApiUrl } from '@orviohub/shared';

type BillingCycle = 'monthly' | 'annual';

interface LivePlan {
  _id?: string;
  key: string;
  name: string;
  monthlyPrice: number; // in kobo
  annualPrice: number; // in kobo
  currency: string;
  isActive: boolean;
}

const DEFAULT_DB_PLANS: LivePlan[] = [
  {
    key: 'free_trial',
    name: 'Free Trial',
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'NGN',
    isActive: true,
  },
  {
    key: 'standard',
    name: 'Standard',
    monthlyPrice: 750000, // ₦7,500
    annualPrice: 7500000, // ₦75,000
    currency: 'NGN',
    isActive: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    monthlyPrice: 2500000, // ₦25,000
    annualPrice: 25000000, // ₦250,000
    currency: 'NGN',
    isActive: true,
  },
];

export const PricingPage: React.FC = () => {
  const host = useHost();
  const env = host.environment;
  const { user, isAuthenticated, isInitialized, refreshSession } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [dbPlans, setDbPlans] = useState<LivePlan[]>(DEFAULT_DB_PLANS);

  // Ensure auth state is populated when landing directly on pricing page
  useEffect(() => {
    if (!isInitialized) {
      refreshSession();
    }
  }, [isInitialized, refreshSession]);

  // Fetch live plans from database via backend API
  useEffect(() => {
    let isMounted = true;
    const fetchPlans = async () => {
      try {
        const apiUrl = getApiUrl(env).replace(/\/$/, '');
        const res = await fetch(`${apiUrl}/api/v1/plans`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0 && isMounted) {
            setDbPlans(json.data);
          }
        }
      } catch {
        // Fallback gracefully to DEFAULT_DB_PLANS
      }
    };
    fetchPlans();
    return () => {
      isMounted = false;
    };
  }, [env]);

  const standardPlan = dbPlans.find((p) => p.key === 'standard') || DEFAULT_DB_PLANS[1];
  const premiumPlan = dbPlans.find((p) => p.key === 'premium') || DEFAULT_DB_PLANS[2];

  // Prices in Nigerian Naira (divide kobo by 100)
  const stdMonthlyNGN = Math.round(standardPlan.monthlyPrice / 100);
  const stdAnnualNGN = Math.round(standardPlan.annualPrice / 100);
  const stdAnnualMonthlyNGN = Math.round(stdAnnualNGN / 12);

  const premMonthlyNGN = Math.round(premiumPlan.monthlyPrice / 100);
  const premAnnualNGN = Math.round(premiumPlan.annualPrice / 100);
  const premAnnualMonthlyNGN = Math.round(premAnnualNGN / 12);

  const formatNaira = (amount: number) => {
    if (amount === 0) return 'Free';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const handlePlanClick = (plan: string) => {
    const targetPlan = plan === 'free' ? 'free_trial' : plan;
    if (isAuthenticated && user) {
      if (plan === 'free' || plan === 'free_trial') {
        window.location.href = '/inventory/dashboard';
      } else {
        window.location.href = `/settings/billing?upgrade=${plan}&cycle=${billingCycle}`;
      }
    } else {
      window.location.href = `/signup?plan=${targetPlan}&cycle=${billingCycle}`;
    }
  };

  const FAQS = [
    {
      q: 'Which payment methods are supported in Nigeria?',
      a: 'We support all major payment methods via Paystack and Flutterwave including debit/credit cards (Mastercard, Visa, Verve), instant Bank Transfer, USSD, and Apple Pay. Offline bank transfers to GTBank and Providus Bank are also supported.',
    },
    {
      q: 'How does automated subscription activation work?',
      a: 'When you pay with Paystack or Flutterwave, your workspace organization is automatically and instantly upgraded to the chosen plan. Your receipt and updated billing cycle are immediately active.',
    },
    {
      q: 'What is included in the 30-Day Free Trial?',
      a: 'The Free Trial gives you 30 days to explore the platform with 1 workspace, 1 active application (Inventory), up to 2 team members, 500 catalogue products, and 300 monthly transactions. After the trial, upgrade to Standard or Premium to continue with full access.',
    },
    {
      q: 'Can I change my plan or billing cycle at any time?',
      a: 'Yes. You can upgrade or switch between monthly and annual intervals from your Workspace Billing dashboard whenever you need. Annual plans give you 2 months free!',
    },
    {
      q: 'Do team members have to pay separately?',
      a: 'No! The subscription plan belongs to the workspace organization, not each employee. You can invite cashiers, managers, and accountants into your paid workspace at no extra personal cost.',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Top Header */}
      <Header />

      {/* Main Pricing Hero */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Title & Headline */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simple, Transparent Pricing in Nigerian Naira (₦ NGN)</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight font-serif">
            One platform for all your business apps.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-4 max-w-2xl mx-auto leading-relaxed">
            Start with a 30-day free trial to explore the platform, then unlock multi-app workspaces, higher product catalogues, and high-volume transactions with Standard &amp; Premium.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="mt-8 flex items-center justify-center">
            <div className="bg-[#120b10] p-1 rounded-xs border border-white/10 flex items-center shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  'px-5 py-2 rounded-xs text-xs font-semibold transition-all cursor-pointer',
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
                  'px-5 py-2 rounded-xs text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
                  billingCycle === 'annual'
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-xs font-bold">
                  2 Months Free
                </span>
              </button>
            </div>
          </div>

          {/* Payment Gateway Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Paystack Verified
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xs">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Flutterwave Instant
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xs">
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              Verve, Visa, Mastercard & USSD
            </span>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {/* 1. Free Trial Card */}
          <div className="p-6 sm:p-8 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col justify-between relative group hover:border-white/20 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Free Trial</span>
                <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-xs border border-amber-500/20">
                  30 Days
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mt-2">Free Trial</h3>
              <p className="text-xs text-slate-400 mt-1">
                Explore the platform free for 30 days. No payment required to start.
              </p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-extrabold text-white">₦0</span>
                <span className="text-xs text-slate-400 ml-1">/ 30 days</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Full Inventory App Access</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>1 Branch / Warehouse</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 2 Team Members</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>500 Catalog Products</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>300 Monthly Transactions</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>30-Day Temporary Duration</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => handlePlanClick('free_trial')}
              variant="outline"
              className="w-full h-11 mt-8 bg-[#160f14] hover:bg-[#22151f] border-white/10 text-white rounded-xs font-semibold text-xs transition-all cursor-pointer"
            >
              {isAuthenticated && user ? 'Open Workspace' : 'Start 30-Day Free Trial'}
            </Button>
          </div>

          {/* 2. Standard Plan (Highlighted / Most Popular) */}
          <div className="p-6 sm:p-8 rounded-sm bg-[#140c13] border-2 border-[#714b67] shadow-2xl shadow-[#714b67]/20 flex flex-col justify-between relative group scale-100 md:-translate-y-2">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#714b67] text-white text-[10px] font-bold px-3 py-1 rounded-xs uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#c79dbd]">Growth</span>
                <span className="text-[10px] font-semibold bg-[#714b67]/30 text-white px-2 py-0.5 rounded-xs border border-[#714b67]/50">
                  Paystack Verified
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mt-2">Standard</h3>
              <p className="text-xs text-slate-400 mt-1">
                Essential inventory management for established stores and growing businesses.
              </p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-extrabold text-white">
                  {formatNaira(billingCycle === 'annual' ? stdAnnualMonthlyNGN : stdMonthlyNGN)}
                </span>
                <span className="text-xs text-slate-400 ml-1">/ month</span>
                {billingCycle === 'annual' && (
                  <div className="text-[11px] text-emerald-400 mt-1 font-medium">
                    Billed annually at {formatNaira(stdAnnualNGN)} / year
                  </div>
                )}
              </div>

              <ul className="space-y-3 text-xs text-slate-200 border-t border-white/10 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Full Inventory App Access</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 3 Branches / Warehouses</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 10 Team Members</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>5,000 Catalog Products</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>5,000 Monthly Transactions</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Standard Email Support</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => handlePlanClick('standard')}
              className="w-full h-11 mt-8 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isAuthenticated && user ? 'Upgrade to Standard' : 'Get Standard'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* 3. Premium Plan */}
          <div className="p-6 sm:p-8 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col justify-between relative group hover:border-white/20 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Enterprise</span>
                <span className="text-[10px] font-semibold bg-white/5 text-slate-300 px-2 py-0.5 rounded-xs border border-white/10">
                  Full Power
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mt-2">Premium</h3>
              <p className="text-xs text-slate-400 mt-1">
                High-capacity operations with multi-branch expansion and priority support.
              </p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-extrabold text-white">
                  {formatNaira(billingCycle === 'annual' ? premAnnualMonthlyNGN : premMonthlyNGN)}
                </span>
                <span className="text-xs text-slate-400 ml-1">/ month</span>
                {billingCycle === 'annual' && (
                  <div className="text-[11px] text-emerald-400 mt-1 font-medium">
                    Billed annually at {formatNaira(premAnnualNGN)} / year
                  </div>
                )}
              </div>

              <ul className="space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Full Inventory App Access</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 10 Branches / Warehouses</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 50 Team Members</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>25,000 Catalog Products</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>25,000 Monthly Transactions</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Priority 24/7 Support</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => handlePlanClick('premium')}
              variant="outline"
              className="w-full h-11 mt-8 bg-[#160f14] hover:bg-[#22151f] border-white/10 text-white rounded-xs font-semibold text-xs transition-all cursor-pointer"
            >
              {isAuthenticated && user ? 'Upgrade to Premium' : 'Get Premium'}
            </Button>
          </div>
        </div>

        {/* Feature Comparison Matrix */}
        <section className="mt-20 max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center tracking-tight mb-8">
            Compare Plan Features & Limits
          </h2>

          <div className="overflow-x-auto rounded-sm border border-white/10 bg-[#0d070b]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#160f14] text-white uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-4">Feature / Resource</th>
                  <th className="p-4 text-center">Free Trial (30 Days)</th>
                  <th className="p-4 text-center text-[#c79dbd]">
                    Standard ({formatNaira(stdMonthlyNGN)}/mo)
                  </th>
                  <th className="p-4 text-center">
                    Premium ({formatNaira(premMonthlyNGN)}/mo)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-4 font-semibold text-white">Active Application</td>
                  <td className="p-4 text-center">Inventory</td>
                  <td className="p-4 text-center text-white font-medium">Inventory</td>
                  <td className="p-4 text-center text-white font-medium">Inventory</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Branches / Warehouses</td>
                  <td className="p-4 text-center">1 Branch</td>
                  <td className="p-4 text-center text-white font-medium">3 Branches</td>
                  <td className="p-4 text-center text-white font-medium">10 Branches</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Team Members</td>
                  <td className="p-4 text-center">2 Members</td>
                  <td className="p-4 text-center text-white font-medium">10 Members</td>
                  <td className="p-4 text-center text-white font-medium">50 Members</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Product Catalogue</td>
                  <td className="p-4 text-center">500 Products</td>
                  <td className="p-4 text-center text-white font-medium">5,000 Products</td>
                  <td className="p-4 text-center text-white font-medium">25,000 Products</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Monthly Transactions</td>
                  <td className="p-4 text-center">300 / month</td>
                  <td className="p-4 text-center text-white font-medium">5,000 / month</td>
                  <td className="p-4 text-center text-white font-medium">25,000 / month</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Support SLA</td>
                  <td className="p-4 text-center">Standard Support</td>
                  <td className="p-4 text-center text-white font-medium">Standard Email Support</td>
                  <td className="p-4 text-center text-white font-medium">Priority 24/7 Support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQs */}
        <section className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center tracking-tight mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaqIndex === i;
              return (
                <div
                  key={i}
                  className="rounded-sm border border-white/5 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-white">{faq.q}</span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0',
                        isOpen ? 'rotate-180 text-white' : ''
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3 animate-in fade-in duration-150">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orvio Inc. • All business applications on one platform.
      </footer>
    </div>
  );
};
