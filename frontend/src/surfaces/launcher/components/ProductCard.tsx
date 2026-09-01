import React from 'react';
import { ArrowRight, Bell, Check, Sparkles } from 'lucide-react';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ProductCardData {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description: string;
  headline?: string;
  iconUrl?: string;
  status: 'active' | 'coming_soon' | 'draft' | 'ACTIVE' | 'BETA' | 'COMING_SOON' | string;
  isBeta?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
  subdomain?: string;
  features?: string[];
}

export interface ProductCardProps {
  product: ProductCardData;
  type?: 'active' | 'coming_soon' | 'available' | 'upgrade';
  isActivated?: boolean;
  isAllowedByPlan?: boolean;
  requiredPlan?: string;
  ctaText?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  isNotified?: boolean;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  type,
  isActivated = false,
  isAllowedByPlan = true,
  requiredPlan,
  ctaText,
  ctaHref,
  onCtaClick,
  isNotified = false,
  className,
}) => {
  const isComingSoon =
    type === 'coming_soon' ||
    (product.status || '').toLowerCase() === 'coming_soon' ||
    (product.status || '').toLowerCase() === 'beta';

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl transition-all duration-300 overflow-hidden border',
        isComingSoon
          ? 'opacity-85 bg-gradient-to-br from-[#1b120c]/80 via-[#120b10]/90 to-black/95 border-amber-500/20 hover:opacity-100 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5'
          : isActivated
          ? 'bg-gradient-to-br from-[#1f101d]/90 via-[#140b12]/95 to-black border-[#714b67]/40 hover:border-[#714b67] hover:shadow-2xl hover:shadow-[#714b67]/20 hover:-translate-y-1'
          : 'bg-gradient-to-br from-[#150d14]/80 via-[#10080e]/90 to-black/95 border-white/10 hover:border-white/20 hover:shadow-xl',
        className
      )}
    >
      {/* Background Decorative African Pattern Accent */}
      <div
        className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 pointer-events-none group-hover:opacity-25 transition-opacity duration-500"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23FDB02F' stroke-width='2'/%3E%3Cpath d='M10 10L30 30M10 30L30 10' stroke='%23714B67' stroke-width='2'/%3E%3C/svg%3E\")",
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 space-y-4">
        {/* Header: Icon + Badges */}
        <div className="flex items-start justify-between gap-3">
          {/* 48x48px Product Icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shrink-0 border transition-transform duration-300 group-hover:scale-105',
              isComingSoon
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                : isActivated
                ? 'bg-[#714b67]/25 border-[#714b67] text-[#FDB02F]'
                : 'bg-white/5 border-white/15 text-slate-300'
            )}
          >
            {product.iconUrl ? (
              <img
                src={product.iconUrl}
                alt={product.name}
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : product.key === 'inventory' || product.name.toLowerCase().includes('inventory') ? (
              <InventoryIcon className="w-7 h-7" />
            ) : (
              <span>{product.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          {/* Badges Container */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {isActivated && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Check className="w-2.5 h-2.5" />
                <span>Active</span>
              </span>
            )}

            {product.isFeatured && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Featured</span>
              </span>
            )}

            {product.isBeta && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                BETA
              </span>
            )}

            {isComingSoon && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Coming Soon
              </span>
            )}

            {!isActivated && !isComingSoon && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-white/10 text-slate-300 border border-white/15">
                Ready to Enable
              </span>
            )}
          </div>
        </div>

        {/* Product Title & Description */}
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#f3e1ed] transition-colors">
            {product.name}
          </h3>

          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {product.headline || product.description}
          </p>
        </div>

        {/* Product Features List (if available) */}
        {product.features && product.features.length > 0 && (
          <div className="pt-3 pb-1 border-t border-white/5 space-y-1.5">
            {product.features.slice(0, 3).map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{feat}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA Footer */}
      <div className="relative z-10 mt-6 pt-4 border-t border-white/5">
        {isComingSoon ? (
          <Button
            type="button"
            onClick={onCtaClick}
            className={cn(
              'w-full h-10 rounded-xs text-xs font-semibold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all duration-200',
              isNotified
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-black font-bold active:scale-[0.98]'
            )}
          >
            {isNotified ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            <span>{isNotified ? '✓ Notified' : (ctaText || 'Notify Me When Available')}</span>
          </Button>
        ) : !isAllowedByPlan ? (
          <a
            href="/pricing"
            className="w-full h-10 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xs text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
          >
            <span>{ctaText || `Upgrade to ${requiredPlan || 'Standard'}`}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        ) : ctaHref ? (
          <a
            href={ctaHref}
            target="_self"
            className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs text-xs font-semibold shadow-lg shadow-[#714b67]/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-center group/btn"
          >
            <span>{ctaText || (isActivated ? 'Open Application' : 'Explore Application')}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </a>
        ) : (
          <Button
            type="button"
            onClick={onCtaClick}
            className={cn(
              'w-full h-10 text-white rounded-xs text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md',
              isActivated
                ? 'bg-[#714b67] hover:bg-[#86597a]'
                : 'border border-[#714b67]/60 bg-[#714b67]/15 hover:bg-[#714b67]/30'
            )}
          >
            <span>{ctaText || (isActivated ? 'Open Application' : 'Activate Module')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
