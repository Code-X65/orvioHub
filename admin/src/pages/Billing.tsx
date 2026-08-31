import React from "react";
import { CreditCard, DollarSign, TrendingUp, ShieldAlert } from "lucide-react";

export const BillingPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-400" />
          Platform Billing & Subscriptions
        </h1>
        <p className="text-xs text-slate-400">
          Global subscription tiers, billing adjustments, and revenue analytics across products.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total MRR</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">$0.00</p>
          <p className="text-[11px] text-slate-500">Free Tier & Trial phase</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Active Subscriptions</span>
            <TrendingUp className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white">0</p>
          <p className="text-[11px] text-slate-500">Tier: Super Admin Plan</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Billing Guard</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">Enabled</p>
          <p className="text-[11px] text-emerald-400">Super admin override permitted</p>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
