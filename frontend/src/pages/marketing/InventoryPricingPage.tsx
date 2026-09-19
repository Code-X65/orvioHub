import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
} from 'lucide-react';
import { SeoMeta } from '@/components/seo/SeoMeta';
import { InventoryMarketingHeader } from '@/components/marketing/InventoryMarketingHeader';
import { getSignupUrl } from '@/lib/domain';
import { trackEvent, captureAttribution } from '@/lib/analytics';

export const InventoryPricingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    captureAttribution();
    trackEvent(
      'marketing_inventory_pricing_viewed',
      { section: 'pricing_details' },
      { oncePerSession: true }
    );
  }, []);

  const standardPrice = billingCycle === 'annual' ? '₦6,000' : '₦7,500';
  const premiumPrice = billingCycle === 'annual' ? '₦12,000' : '₦15,000';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white flex flex-col justify-between">
      <SeoMeta
        title="Inventory Plans & Transparent Pricing | Orviohub"
        description="Choose the right inventory tier for your Nigerian business. Starting at ₦0 for 30 days. No hidden setup fees."
        canonicalPath="/inventory/pricing"
      />

      <InventoryMarketingHeader />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full text-center">
        {/* Top Header */}
        <div className="max-w-3xl mx-auto mb-12">
          <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            TRANSPARENT PLANS
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-4">
            Simple, predictable pricing for growing businesses
          </h1>
          <p className="mt-4 text-base text-slate-400">
            Every plan includes our 100% offline-resilient cashier engine, barcode generation, and daily automatic backups.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left mb-20">
          {/* Tier 1: Free Trial */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-xl">
            <div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                STARTER
              </span>
              <h3 className="text-2xl font-bold text-white mt-3">Free 30-Day Trial</h3>
              <p className="text-xs text-slate-400 mt-1">
                Full access to test all features in your shop.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">₦0</span>
                <span className="text-xs text-slate-400">/ 30 days</span>
              </div>

              <div className="mt-8 space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>1 Physical Store Branch</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>2 Staff Logins</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>500 Product Items</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Standard Offline Mode</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <a
                href={`${getSignupUrl(window.location.origin)}?plan=free_trial`}
                className="w-full block text-center py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
              >
                Start Free 30-Day Trial →
              </a>
            </div>
          </div>

          {/* Tier 2: Standard */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-emerald-950/70 via-slate-900 to-slate-900 border-2 border-emerald-500 flex flex-col justify-between shadow-2xl relative scale-[1.02]">
            <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] tracking-wider uppercase">
              RECOMMENDED
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                RETAILERS & WHOLESALERS
              </span>
              <h3 className="text-2xl font-bold text-white mt-3">Standard Plan</h3>
              <p className="text-xs text-emerald-200 mt-1">
                For busy stores with staff and multiple registers.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-emerald-400">{standardPrice}</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <div className="mt-8 space-y-3 text-sm text-slate-200">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Up to 3 Store Branches</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>10 Staff Accounts with Role Isolation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Up to 5,000 Products</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp E-Receipts & Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Thermal Receipt & ESC/POS Printing</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <a
                href={`${getSignupUrl(window.location.origin)}?plan=standard`}
                className="w-full block text-center py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60"
              >
                Choose Standard Plan →
              </a>
            </div>
          </div>

          {/* Tier 3: Premium */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-xl">
            <div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                ENTERPRISE SCALE
              </span>
              <h3 className="text-2xl font-bold text-white mt-3">Premium Plan</h3>
              <p className="text-xs text-slate-400 mt-1">
                Multi-state distribution networks and supermarket chains.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">{premiumPrice}</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <div className="mt-8 space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Up to 10 Store Branches</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>50 Staff Seats</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>25,000+ Products</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Dedicated Support Account Manager</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>REST API & Automated Stock Feeds</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <a
                href={`${getSignupUrl(window.location.origin)}?plan=premium`}
                className="w-full block text-center py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
              >
                Choose Premium Plan →
              </a>
            </div>
          </div>
        </div>

        {/* Feature Comparison Matrix Table */}
        <div className="text-left mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 text-center">
            Detailed Feature Comparison
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-4 px-6 text-left">Capability</th>
                  <th className="py-4 px-4 text-center">Free Trial</th>
                  <th className="py-4 px-4 text-center text-emerald-400">Standard</th>
                  <th className="py-4 px-4 text-center">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Physical Store Locations</td>
                  <td className="py-3.5 px-4 text-center">1 Branch</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-400">3 Branches</td>
                  <td className="py-3.5 px-4 text-center">10 Branches</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Cashier & Manager Accounts</td>
                  <td className="py-3.5 px-4 text-center">2 Users</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-400">10 Users</td>
                  <td className="py-3.5 px-4 text-center">50 Users</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Catalog Product Items</td>
                  <td className="py-3.5 px-4 text-center">500</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-400">5,000</td>
                  <td className="py-3.5 px-4 text-center">25,000+</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">100% Offline Checkout & Sync</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">WhatsApp Customer E-Receipts</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Thermal Receipt Printer Support</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Custom Barcode Label Generator</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Stock Audit Trail & Damage Logs</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">Dedicated Account Manager</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-white">REST API & Webhooks Access</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InventoryPricingPage;
