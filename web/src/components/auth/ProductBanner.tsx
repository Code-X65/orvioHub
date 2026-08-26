import React from 'react';
import { Layers, CreditCard, ShoppingBag, Users, ShieldCheck } from 'lucide-react';
import { ProductKey, ProductInfo } from '../../lib/types';

export const PRODUCT_CONFIGS: Record<ProductKey, ProductInfo> = {
  hub: {
    key: 'hub',
    name: 'orvioHub',
    tagline: 'Unified Business Operations',
    description: 'Centralized workspace for teams, operations, and cross-module workflows.',
    badge: 'Operations Hub',
    accentColor: '#4F46E5',
    gradient: 'from-indigo-600 to-blue-700',
    iconName: 'Layers',
  },
  finance: {
    key: 'finance',
    name: 'orvioFinance',
    tagline: 'Invoicing & Accounting',
    description: 'Smart multi-currency bookkeeping, automated invoicing, and tax tracking.',
    badge: 'Financial Suite',
    accentColor: '#059669',
    gradient: 'from-emerald-600 to-teal-700',
    iconName: 'CreditCard',
  },
  retail: {
    key: 'retail',
    name: 'orvioRetail',
    tagline: 'Point of Sale & Inventory',
    description: 'Omnichannel sales, barcode scanning, and real-time inventory management.',
    badge: 'POS & Inventory',
    accentColor: '#D97706',
    gradient: 'from-amber-600 to-orange-700',
    iconName: 'ShoppingBag',
  },
  people: {
    key: 'people',
    name: 'orvioPeople',
    tagline: 'Payroll & Team HR',
    description: 'Automated payroll disbursement, leave management, and staff performance.',
    badge: 'Human Resources',
    accentColor: '#7C3AED',
    gradient: 'from-purple-600 to-violet-700',
    iconName: 'Users',
  },
  accounts: {
    key: 'accounts',
    name: 'orvio Accounts',
    tagline: 'One Login. All Orvio Services.',
    description: 'Your central security passport and single sign-on hub for all Orvio apps.',
    badge: 'Identity Portal',
    accentColor: '#2563EB',
    gradient: 'from-blue-600 to-indigo-700',
    iconName: 'ShieldCheck',
  },
};

interface ProductBannerProps {
  productKey?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export const ProductBanner: React.FC<ProductBannerProps> = ({
  productKey,
  size = 'md',
  showBadge = true,
}) => {
  const normalizedKey: ProductKey = (
    productKey && productKey.toLowerCase() in PRODUCT_CONFIGS
      ? productKey.toLowerCase()
      : 'hub'
  ) as ProductKey;

  const product = PRODUCT_CONFIGS[normalizedKey];

  const renderIcon = () => {
    switch (product.iconName) {
      case 'CreditCard':
        return <CreditCard className="w-5 h-5 text-white" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-5 h-5 text-white" />;
      case 'Users':
        return <Users className="w-5 h-5 text-white" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-white" />;
      default:
        return <Layers className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${
          size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-sm'
        } bg-gradient-to-tr ${product.gradient} flex items-center justify-center shadow-md shadow-indigo-500/10 shrink-0 ring-1 ring-white/20`}
      >
        {renderIcon()}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-slate-900 dark:text-white text-lg">
            {product.name}
          </span>
          {showBadge && (
            <span
              className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
            >
              {product.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {product.tagline}
        </p>
      </div>
    </div>
  );
};
