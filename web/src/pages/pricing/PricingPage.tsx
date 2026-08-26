import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

type Currency = 'NGN' | 'USD' | 'GBP';
type BillingCycle = 'monthly' | 'annual';

interface PlanPricing {
  monthly: number;
  annualMonthly: number;
}

const PRICING_DATA: Record<Currency, { symbol: string; standard: PlanPricing; premium: PlanPricing }> = {
  NGN: {
    symbol: '₦',
    standard: { monthly: 10000, annualMonthly: 8000 },
    premium: { monthly: 25000, annualMonthly: 20000 },
  },
  USD: {
    symbol: '$',
    standard: { monthly: 7.25, annualMonthly: 5.80 },
    premium: { monthly: 18.0, annualMonthly: 14.40 },
  },
  GBP: {
    symbol: '£',
    standard: { monthly: 5.75, annualMonthly: 4.60 },
    premium: { monthly: 14.5, annualMonthly: 11.60 },
  },
};

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const curData = PRICING_DATA[currency];

  const formatPrice = (amount: number) => {
    if (amount === 0) return 'Free';
    if (currency === 'NGN') {
      return `${curData.symbol}${amount.toLocaleString()}`;
    }
    return `${curData.symbol}${amount.toFixed(2)}`;
  };

  const FAQS = [
    {
      q: 'How does the 14-day free trial work?',
      a: 'You get full access to all features in your chosen starting app (like Inventory & POS) for 14 days. No credit card is required to begin. You can invite team members and set up your products immediately.',
    },
    {
      q: 'What is the Free Plan single-application rule?',
      a: 'On the Free plan, you can run one application in one owned workspace forever. To activate multiple applications (like Inventory + Task Management + Accounting) under the same unified workspace, you can upgrade to Standard or Premium.',
    },
    {
      q: 'Can I change my plan or currency at any time?',
      a: 'Yes. You can upgrade, downgrade, or switch billing intervals from your Workspace Billing dashboard whenever you need. Prorated adjustments are calculated automatically.',
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
            <span>Simple, Transparent Pricing • All Apps Included</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight font-serif">
            One platform for all your apps.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-4 max-w-2xl mx-auto leading-relaxed">
            Start with our 14-day free trial or permanent free tier. Scale to unlimited workspaces, branches, and apps when you're ready.
          </p>

          {/* Controls: Billing Cycle & Currency Switcher */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Monthly / Annual Toggle */}
            <div className="bg-[#120b10] p-1 rounded-xs border border-white/10 flex items-center">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  'px-4 py-1.5 rounded-xs text-xs font-semibold transition-all cursor-pointer',
                  billingCycle === 'monthly'
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={cn(
                  'px-4 py-1.5 rounded-xs text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  billingCycle === 'annual'
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <span>Annual</span>
                <span className="text-[10px] bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-xs">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center gap-1 bg-[#120b10] p-1 rounded-xs border border-white/10">
              {(['NGN', 'USD', 'GBP'] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'px-2.5 py-1 rounded-xs text-xs font-semibold transition-all cursor-pointer',
                    currency === c ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {/* 1. Free Plan */}
          <div className="p-6 sm:p-8 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col justify-between relative group hover:border-white/20 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Starter</span>
                <span className="text-[10px] font-semibold bg-white/5 text-slate-300 px-2 py-0.5 rounded-xs border border-white/10">
                  Always Free
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mt-2">Free</h3>
              <p className="text-xs text-slate-400 mt-1">
                Perfect for solopreneurs & small stores getting started.
              </p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-extrabold text-white">Free</span>
                <span className="text-xs text-slate-400 ml-1">/ forever</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>1 Workspace</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>1 Active Application</strong> (e.g. Inventory)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>1 Branch / Store Location</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 2 staff members</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 200 products in catalogue</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Basic reports & export</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => {
                if (isAuthenticated && user) {
                  navigate('/workspaces');
                } else {
                  navigate('/signup?plan=free');
                }
              }}
              variant="outline"
              className="w-full h-11 mt-8 bg-[#160f14] hover:bg-[#22151f] border-white/10 text-white rounded-xs font-semibold text-xs transition-all cursor-pointer"
            >
              {isAuthenticated && user ? 'Go to your workspace' : 'Get Started Free'}
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
                  14-Day Free Trial
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mt-2">Standard</h3>
              <p className="text-xs text-slate-400 mt-1">
                For expanding businesses with multiple branches and apps.
              </p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-extrabold text-white">
                  {formatPrice(billingCycle === 'annual' ? curData.standard.annualMonthly : curData.standard.monthly)}
                </span>
                <span className="text-xs text-slate-400 ml-1">/ month</span>
                {billingCycle === 'annual' && (
                  <div className="text-[11px] text-emerald-400 mt-1">Billed annually</div>
                )}
              </div>

              <ul className="space-y-3 text-xs text-slate-200 border-t border-white/10 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Multiple Workspaces</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Multiple Applications</strong> (Inventory, Tasks, etc.)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 5 Branches</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 15 team members</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited products catalogue</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Full analytics & automated stock alerts</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Email & WhatsApp support</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => {
                if (isAuthenticated && user) {
                  navigate('/app');
                } else {
                  navigate('/signup?plan=standard');
                }
              }}
              className="w-full h-11 mt-8 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isAuthenticated && user ? 'Manage in Workspace' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* 3. Premium Plan */}
          <div className="p-6 sm:p-8 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col justify-between relative group hover:border-white/20 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scale</span>
                <span className="text-[10px] font-semibold bg-white/5 text-slate-300 px-2 py-0.5 rounded-xs border border-white/10">
                  Full Power
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mt-2">Premium</h3>
              <p className="text-xs text-slate-400 mt-1">
                For high-volume operations requiring advanced API & scale.
              </p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-extrabold text-white">
                  {formatPrice(billingCycle === 'annual' ? curData.premium.annualMonthly : curData.premium.monthly)}
                </span>
                <span className="text-xs text-slate-400 ml-1">/ month</span>
                {billingCycle === 'annual' && (
                  <div className="text-[11px] text-emerald-400 mt-1">Billed annually</div>
                )}
              </div>

              <ul className="space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Unlimited Workspaces</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>All Applications Unlocked</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Unlimited Branches & Warehouses</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited team members & granular roles</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>API access & custom webhooks</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom receipts branding & sub-stores</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated priority account manager</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => {
                if (isAuthenticated && user) {
                  navigate('/app');
                } else {
                  navigate('/signup?plan=premium');
                }
              }}
              variant="outline"
              className="w-full h-11 mt-8 bg-[#160f14] hover:bg-[#22151f] border-white/10 text-white rounded-xs font-semibold text-xs transition-all cursor-pointer"
            >
              {isAuthenticated && user ? 'Upgrade in Workspace' : 'Get Premium'}
            </Button>
          </div>
        </div>

        {/* Feature Comparison Matrix */}
        <section className="mt-20 max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center tracking-tight mb-8">
            Compare Plan Features
          </h2>

          <div className="overflow-x-auto rounded-sm border border-white/10 bg-[#0d070b]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#160f14] text-white uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-4">Feature</th>
                  <th className="p-4 text-center">Free</th>
                  <th className="p-4 text-center text-[#c79dbd]">Standard</th>
                  <th className="p-4 text-center">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-4 font-semibold text-white">Workspaces</td>
                  <td className="p-4 text-center">1 Workspace</td>
                  <td className="p-4 text-center text-white font-medium">Multiple</td>
                  <td className="p-4 text-center text-white font-medium">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Enabled Applications</td>
                  <td className="p-4 text-center">1 Application</td>
                  <td className="p-4 text-center text-white font-medium">Multiple</td>
                  <td className="p-4 text-center text-white font-medium">All Applications</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Branches & Outlets</td>
                  <td className="p-4 text-center">1 Branch</td>
                  <td className="p-4 text-center text-white font-medium">Up to 5</td>
                  <td className="p-4 text-center text-white font-medium">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Staff Users</td>
                  <td className="p-4 text-center">2 Users</td>
                  <td className="p-4 text-center text-white font-medium">15 Users</td>
                  <td className="p-4 text-center text-white font-medium">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Product Catalogue</td>
                  <td className="p-4 text-center">200 Products</td>
                  <td className="p-4 text-center text-white font-medium">Unlimited</td>
                  <td className="p-4 text-center text-white font-medium">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Barcode & POS Shifts</td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Developer API & Webhooks</td>
                  <td className="p-4 text-center text-slate-500">—</td>
                  <td className="p-4 text-center text-slate-500">—</td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Support Channels</td>
                  <td className="p-4 text-center">Community & Docs</td>
                  <td className="p-4 text-center text-white font-medium">Email & WhatsApp</td>
                  <td className="p-4 text-center text-white font-medium">Dedicated Manager</td>
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
                  className="rounded-sm   border border-white/5 overflow-hidden transition-colors"
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
        © {new Date().getFullYear()} Orivo Inc. • All business applications on one platform.
      </footer>
    </div>
  );
};
