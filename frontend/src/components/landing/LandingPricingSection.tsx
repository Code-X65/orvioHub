import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, ArrowRight, ShieldCheck, Zap, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

type BillingCycle = 'monthly' | 'annual';

export const LandingPricingSection: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const handlePlanClick = (plan: 'free_trial' | 'standard' | 'premium') => {
    if (isAuthenticated && user) {
      if (plan === 'free_trial') {
        window.location.href = '/inventory/dashboard';
      } else {
        window.location.href = `/settings/billing?upgrade=${plan}&cycle=${billingCycle}`;
      }
    } else {
      window.location.href = `/signup?plan=${plan}&cycle=${billingCycle}`;
    }
  };

  return (
    <section id="pricing" className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20 relative">
      {/* Title & Subtitle */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[#714B67]/20 border border-[#714B67]/30 text-[#c79dbd] text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
          <span>Simple, Transparent Pricing in Nigerian Naira (₦ NGN)</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Choose the plan that fits your business.
        </h2>
        <p className="text-sm sm:text-base text-slate-300 mt-3 max-w-xl mx-auto leading-relaxed">
          Start with a 30-day full-featured free trial or scale with Standard & Premium plans tailored for African commerce.
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
                  ? 'bg-[#714B67] text-white shadow-sm'
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
                  ? 'bg-[#714B67] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-xs font-bold">
                Save 17% (2 Months Free)
              </span>
            </button>
          </div>
        </div>

        {/* Payment Gateway Trust Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Paystack Verified
          </span>
          <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xs">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Instant Activation
          </span>
          <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xs">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            Cards, Bank Transfer & USSD
          </span>
        </div>
      </div>

      {/* 3 Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
        {/* 1. Free Trial Plan */}
        <div className="p-6 sm:p-8 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col justify-between relative group hover:border-white/20 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Starter</span>
              <span className="text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded-xs border border-emerald-500/30">
                14 Days Free
              </span>
            </div>

            <h3 className="text-2xl font-bold text-white mt-2">Free Trial</h3>
            <p className="text-xs text-slate-400 mt-1">
              Test all core features before choosing your paid subscription.
            </p>

            <div className="mt-6 mb-6">
              <span className="text-4xl font-extrabold text-white">₦0</span>
              <span className="text-xs text-slate-400 ml-1">/ 14 days</span>
            </div>

            <ul className="space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>1 Organization</strong> (Workspace)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>1 Core Application</strong> (Inventory or Tasks)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>1 Primary Branch</strong></span>
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
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No credit card required to start</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => handlePlanClick('free_trial')}
            variant="outline"
            className="w-full h-11 mt-8 bg-[#160f14] hover:bg-[#22151f] border-white/10 hover:border-[#714B67] text-white rounded-xs font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isAuthenticated && user ? 'Open Workspace' : 'Start Free Trial'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 2. Standard Plan (Highlighted / Most Popular) */}
        <div className="p-6 sm:p-8 rounded-sm bg-[#140c13] border-2 border-[#714B67] shadow-2xl shadow-[#714B67]/20 flex flex-col justify-between relative group scale-100 md:-translate-y-2">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#714B67] text-white text-[10px] font-bold px-3 py-1 rounded-xs uppercase tracking-wider shadow-md">
            Most Popular
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#c79dbd]">Growth</span>
              <span className="text-[10px] font-semibold bg-[#714B67]/30 text-white px-2 py-0.5 rounded-xs border border-[#714B67]/50">
                Paystack Verified
              </span>
            </div>

            <h3 className="text-2xl font-bold text-white mt-2">Standard</h3>
            <p className="text-xs text-slate-400 mt-1">
              For expanding businesses running multiple stores, branches, and apps.
            </p>

            <div className="mt-6 mb-6">
              <span className="text-4xl font-extrabold text-white">
                {billingCycle === 'annual' ? '₦6,250' : '₦7,500'}
              </span>
              <span className="text-xs text-slate-400 ml-1">/ month</span>
              {billingCycle === 'annual' && (
                <div className="text-[11px] text-emerald-400 mt-1 font-medium">
                  Billed annually at ₦75,000 / year (Save ₦15,000)
                </div>
              )}
            </div>

            <ul className="space-y-3 text-xs text-slate-200 border-t border-white/10 pt-6">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>3 Organizations</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>3 Active Applications</strong> (Inventory, Tasks, etc.)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>3 Branches</strong> per app</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>10 Team Members</strong> (cashiers, managers)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>5,000 Catalog Products</strong> & Stock Tracking</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>5,000 Monthly Transactions</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Priority Email & WhatsApp Support</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => handlePlanClick('standard')}
            className="w-full h-11 mt-8 bg-[#714B67] hover:bg-[#86597A] active:bg-[#603F57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714B67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isAuthenticated && user ? 'Upgrade to Standard' : 'Get Started with Standard'}</span>
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
              For high-volume retail chains requiring unlimited apps and multi-branch scale.
            </p>

            <div className="mt-6 mb-6">
              <span className="text-4xl font-extrabold text-white">
                {billingCycle === 'annual' ? '₦16,667' : '₦20,000'}
              </span>
              <span className="text-xs text-slate-400 ml-1">/ month</span>
              {billingCycle === 'annual' && (
                <div className="text-[11px] text-emerald-400 mt-1 font-medium">
                  Billed annually at ₦200,000 / year (Save ₦40,000)
                </div>
              )}
            </div>

            <ul className="space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>10 Organizations</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Unlimited Applications</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>10 Branches</strong> per app</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>50 Team Members</strong></span>
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
                <span>Dedicated Account Manager & API Access</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => handlePlanClick('premium')}
            variant="outline"
            className="w-full h-11 mt-8 bg-[#160f14] hover:bg-[#22151f] border-white/10 hover:border-[#714B67] text-white rounded-xs font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isAuthenticated && user ? 'Upgrade to Premium' : 'Get Started with Premium'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Comparison Link */}
      <div className="mt-12 text-center">
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#c79dbd] hover:text-white transition-colors"
        >
          <span>Compare full feature matrix & view FAQs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </section>
  );
};
