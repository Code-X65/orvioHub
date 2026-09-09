import React, { useEffect, useState, useMemo } from 'react';
import { Search, Sparkles, AlertCircle, Layers, Users, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { useHost } from '@/host/useHost';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { ProductCard, ProductCardData } from '../components/ProductCard';
import { JoinWaitlistModal } from '../components/JoinWaitlistModal';
import { ProductActivationModal } from '../components/ProductActivationModal';
import { BranchSelectorModal, BranchOption } from '../components/BranchSelectorModal';
import { ApplicationKey } from '@orviohub/shared';
import { toast } from 'sonner';

const FALLBACK_VISIBLE_PRODUCTS: ProductCardData[] = [
  {
    key: 'inventory',
    name: 'Inventory Management & POS',
    headline: 'Multi-branch stock, barcode POS checkout, sales telemetry & warehouse operations.',
    description: 'Real-time multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.',
    status: 'active',
    isFeatured: true,
    isBeta: false,
    displayOrder: 1,
    features: [
      'Real-time stock & transfer sync',
      'Barcode scanner & instant POS terminal',
      'Multi-branch and staff access',
      'Supplier POs & automated reorders',
    ],
  },
  {
    key: 'taskmanagement',
    name: 'Task & Workflow Management',
    headline: 'Agile sprints, interactive kanban boards, team workflows & project tracking.',
    description: 'Collaborative task execution, backlog refinement, automated assignments and timelines.',
    status: 'active',
    isFeatured: true,
    isBeta: false,
    displayOrder: 2,
    features: [
      'Interactive Kanban & sprint boards',
      'Milestones & cross-team assignments',
      'Automated workflow rules',
      'Real-time status updates',
    ],
  },
  {
    key: 'crm',
    name: 'Customer CRM & Pipeline',
    headline: 'Client contact directories, communication history, pipelines & deal tracking.',
    description: 'Keep track of customer interactions, leads, follow-ups, and sales opportunities.',
    status: 'coming_soon',
    isFeatured: false,
    isBeta: true,
    displayOrder: 3,
    features: [
      'Customer Contact Directory',
      'Lead & Deal Pipelines',
      'Interaction History & Notes',
      'Custom Segmentation',
    ],
  },
  {
    key: 'booking',
    name: 'Appointments & Scheduling',
    headline: 'Online calendar reservations, service scheduling, reminders & booking.',
    description: 'Automate client bookings, calendar synchronization, and service appointments.',
    status: 'coming_soon',
    isFeatured: false,
    isBeta: false,
    displayOrder: 4,
    features: [
      'Online Booking Portal',
      'Automated WhatsApp/SMS Reminders',
      'Calendar Synchronization',
      'Service Duration Management',
    ],
  },
  {
    key: 'gym',
    name: 'Gym & Fitness Membership',
    headline: 'Member passes, attendance tracking, trainer schedules & subscriptions.',
    description: 'Complete member pass management, attendance barcode scanning, and trainer plans.',
    status: 'coming_soon',
    isFeatured: false,
    isBeta: false,
    displayOrder: 5,
    features: [
      'Member Pass Management',
      'Attendance Barcode Scanner',
      'Trainer & Class Timetables',
      'Membership Subscriptions',
    ],
  },
];

import { UpgradeModal } from '@/components/billing/UpgradeModal';

const PLAN_LIMITS: Record<string, { maxApps: number | string; maxMembers: number; maxBranches: number; maxWorkspaces: number; label: string; allowedApps: string[] }> = {
  free: { maxApps: 1, maxMembers: 2, maxBranches: 1, maxWorkspaces: 1, label: 'Free', allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos'] },
  free_trial: { maxApps: 1, maxMembers: 2, maxBranches: 1, maxWorkspaces: 1, label: 'Free Trial', allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos'] },
  standard: { maxApps: 3, maxMembers: 10, maxBranches: 3, maxWorkspaces: 3, label: 'Standard', allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos', 'booking', 'gym'] },
  premium: { maxApps: 'Unlimited', maxMembers: 50, maxBranches: 10, maxWorkspaces: 10, label: 'Premium', allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos', 'booking', 'gym', 'crm', 'analytics', 'invoicing', 'hr'] },
};

export const ProductCatalog: React.FC = () => {
  const host = useHost();
  const env = host.environment;
  const { user: _user, isAuthenticated } = useAuthStore();
  const { currentWorkspace, products: activatedProducts, workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [products, setProducts] = useState<ProductCardData[]>(FALLBACK_VISIBLE_PRODUCTS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedWaitlistProduct, setSelectedWaitlistProduct] = useState<ProductCardData | null>(null);
  const [selectedActivationProduct, setSelectedActivationProduct] = useState<ProductCardData | null>(null);
  const [joinedWaitlists, setJoinedWaitlists] = useState<Record<string, boolean>>({});
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ products: ProductCardData[] }>('/products');
      if (res?.products && res.products.length > 0) {
        setProducts(res.products);
      }
    } catch {
      // Keep fallback catalog on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    if (isAuthenticated && workspaces.length === 0) {
      fetchWorkspaces().catch(() => {});
    }
  }, [isAuthenticated, fetchWorkspaces, workspaces.length]);

  // Determine current active plan key & limits
  const activePlanKey = (currentWorkspace?.type || 'free').toLowerCase();
  const planInfo = PLAN_LIMITS[activePlanKey] || PLAN_LIMITS.free;

  // Set of active product keys in workspace
  const activeProductKeys = useMemo(() => {
    const keys = new Set<string>();
    if (currentWorkspace?.enabledModules && Array.isArray(currentWorkspace.enabledModules)) {
      currentWorkspace.enabledModules.forEach((k: string) => keys.add(k.toLowerCase()));
    }
    if (activatedProducts) {
      activatedProducts
        .filter((p) => (p.status || '').toLowerCase() === 'active' || (p.status || '').toLowerCase() === 'trial')
        .forEach((p) => keys.add(p.key.toLowerCase()));
    }
    return keys;
  }, [currentWorkspace, activatedProducts]);

  // Filter out draft products and sort by displayOrder
  const visibleProducts = useMemo(() => {
    return products
      .filter((p) => {
        const s = (p.status || 'active').toLowerCase();
        return s === 'active' || s === 'coming_soon' || s === 'beta';
      })
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  }, [products]);

  // Apply search query filter
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return visibleProducts;
    const q = searchQuery.toLowerCase().trim();
    return visibleProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.headline || '').toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
  }, [visibleProducts, searchQuery]);

  const activeCatalogProducts = useMemo(
    () => filteredProducts.filter((p) => (p.status || '').toLowerCase() === 'active'),
    [filteredProducts]
  );

  const comingSoonProducts = useMemo(
    () =>
      filteredProducts.filter((p) => {
        const s = (p.status || '').toLowerCase();
        return s === 'coming_soon' || s === 'beta';
      }),
    [filteredProducts]
  );

  const handleOpenWaitlist = (product: ProductCardData) => {
    setSelectedWaitlistProduct(product);
  };

  const handleWaitlistSuccess = (productKey: string) => {
    setJoinedWaitlists((prev) => ({ ...prev, [productKey]: true }));
  };

  const handleOpenActivation = (product: ProductCardData) => {
    const maxApps = typeof planInfo.maxApps === 'number' ? planInfo.maxApps : 999;
    const isAlreadyActive = activeProductKeys.has(product.key.toLowerCase());
    const appKey = product.key.toLowerCase();
    const isAllowedOnPlan = planInfo.allowedApps.includes(appKey);

    if (!isAllowedOnPlan) {
      setUpgradeReason('app_limit');
      setUpgradeModalOpen(true);
      return;
    }

    if (!isAlreadyActive && activeProductKeys.size >= maxApps) {
      setUpgradeReason('app_limit');
      setUpgradeModalOpen(true);
      return;
    }

    setSelectedActivationProduct(product);
  };

  const [branchModalProduct, setBranchModalProduct] = useState<ProductCardData | null>(null);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);

  const handleLaunchApp = async (product: ProductCardData) => {
    const ctaHref = getCrossSubdomainUrl(
      product.key as ApplicationKey,
      '/dashboard',
      true,
      env
    );

    const supportsBranches = product.key === 'inventory' || product.key === 'pos';
    if (!supportsBranches) {
      window.location.href = ctaHref;
      return;
    }

    try {
      const res = await api.get<{ branches: BranchOption[] }>(
        `/workspaces/${currentWorkspace?.id}/branches?productKey=${product.key}`
      );
      const branches = res.branches || [];

      if (branches.length === 0) {
        toast.error(
          `No active branch assigned for ${product.name}. Please contact your organization administrator.`
        );
        return;
      }

      if (branches.length === 1) {
        window.location.href = `${ctaHref}?branchId=${branches[0].id}`;
        return;
      }

      setBranchOptions(branches);
      setBranchModalProduct(product);
    } catch {
      window.location.href = ctaHref;
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Authenticated Workspace & Plan Context Header */}
      {isAuthenticated && currentWorkspace && (
        <div className="bg-[#120a11] border border-[#714b67]/30 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#714b67] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              {currentWorkspace.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {currentWorkspace.name}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#714b67]/30 text-[#f3e1ed] border border-[#714b67]/50">
                  {planInfo.label} Plan
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage organization applications and operational modules
              </p>
            </div>
          </div>

          {/* Usage & Limits Quick Counters */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-300 bg-black/40 border border-white/5 px-4 py-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#FDB02F]" />
              <span>
                Apps:{' '}
                <strong className="text-white">
                  {activeProductKeys.size} / {planInfo.maxApps}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Members Limit:{' '}
                <strong className="text-white">
                  {planInfo.maxMembers}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Branches Limit:{' '}
                <strong className="text-white">
                  {planInfo.maxBranches}
                </strong>
              </span>
            </div>

            <div className="pl-2 border-l border-white/10">
              <WorkspaceSwitcher />
            </div>
          </div>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3" />
            <span>Modular Enterprise Ecosystem</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Explore Platform Applications
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Discover connected business modules or request early access to upcoming tools.
          </p>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or feature..."
            className="pl-9 h-10 bg-[#120b10] border-white/10 text-white placeholder:text-slate-500 rounded-lg text-xs focus:ring-1 focus:ring-[#714b67]"
          />
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between space-y-6 animate-pulse"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="w-12 h-12 rounded-xl bg-white/10" />
                  <Skeleton className="w-20 h-5 rounded-full bg-white/10" />
                </div>
                <Skeleton className="w-3/4 h-6 rounded bg-white/10" />
                <Skeleton className="w-full h-4 rounded bg-white/5" />
                <Skeleton className="w-5/6 h-4 rounded bg-white/5" />
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <Skeleton className="w-full h-3.5 rounded bg-white/5" />
                  <Skeleton className="w-4/5 h-3.5 rounded bg-white/5" />
                </div>
              </div>
              <div className="pt-4 border-t border-white/5">
                <Skeleton className="w-full h-10 rounded bg-[#714b67]/20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center rounded-2xl bg-[#120b10] border border-white/5 space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No applications found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No products match "{searchQuery}". Try searching with different keywords or clear the filter.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSearchQuery('')}
            className="text-xs h-9 border-white/10 text-slate-300 hover:text-white"
          >
            Clear Search
          </Button>
        </div>
      ) : (
        /* 3-Column Responsive Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Active Catalog Products */}
          {activeCatalogProducts.map((product) => {
            const isActivatedInWorkspace = activeProductKeys.has(product.key.toLowerCase());
            const ctaHref = getCrossSubdomainUrl(
              product.key as ApplicationKey,
              isActivatedInWorkspace ? '/dashboard' : '',
              true,
              env
            );
            const appKey = product.key.toLowerCase();
            const isAllowedOnPlan = planInfo.allowedApps.includes(appKey);
            const maxApps = typeof planInfo.maxApps === 'number' ? planInfo.maxApps : 999;
            const isAtAppLimit = !isActivatedInWorkspace && activeProductKeys.size >= maxApps;
            const needsUpgrade = !isAllowedOnPlan || isAtAppLimit;

            // If user is authenticated with active workspace:
            if (isAuthenticated && currentWorkspace) {
              return (
                <ProductCard
                  key={product.key}
                  product={product}
                  type={isActivatedInWorkspace ? 'active' : 'available'}
                  isActivated={isActivatedInWorkspace}
                  ctaText={
                    isActivatedInWorkspace
                      ? 'Open Application'
                      : needsUpgrade
                      ? '⬆ Upgrade Plan to Activate'
                      : `+ Activate for ${currentWorkspace.name}`
                  }
                  ctaHref={isActivatedInWorkspace ? ctaHref : undefined}
                  onCtaClick={
                    isActivatedInWorkspace
                      ? () => handleLaunchApp(product)
                      : () => handleOpenActivation(product)
                  }
                />
              );
            }

            // Unauthenticated exploration view
            return (
              <ProductCard
                key={product.key}
                product={product}
                type="active"
                ctaText="Explore Application"
                ctaHref={ctaHref}
              />
            );
          })}

          {/* Coming Soon Products */}
          {comingSoonProducts.map((product) => {
            const isNotified = Boolean(joinedWaitlists[product.key]);

            return (
              <ProductCard
                key={product.key}
                product={product}
                type="coming_soon"
                ctaText={isNotified ? '✓ Notified' : 'Notify Me When Available'}
                onCtaClick={() => handleOpenWaitlist(product)}
                isNotified={isNotified}
              />
            );
          })}
        </div>
      )}

      {/* Branch Selector Modal */}
      {branchModalProduct && (
        <BranchSelectorModal
          isOpen={Boolean(branchModalProduct)}
          appName={branchModalProduct.name}
          branches={branchOptions}
          onSelectBranch={(branch) => {
            const ctaHref = getCrossSubdomainUrl(
              branchModalProduct.key as ApplicationKey,
              '/dashboard',
              true,
              env
            );
            window.location.href = `${ctaHref}?branchId=${branch.id}`;
          }}
          onClose={() => setBranchModalProduct(null)}
        />
      )}

      {/* Product Activation Modal */}
      {selectedActivationProduct && (
        <ProductActivationModal
          product={selectedActivationProduct}
          isOpen={Boolean(selectedActivationProduct)}
          onClose={() => setSelectedActivationProduct(null)}
          onActivated={() => {
            fetchWorkspaces();
          }}
        />
      )}

      {/* Waitlist Modal */}
      {selectedWaitlistProduct && (
        <JoinWaitlistModal
          productKey={selectedWaitlistProduct.key}
          productName={selectedWaitlistProduct.name}
          isOpen={Boolean(selectedWaitlistProduct)}
          onClose={() => setSelectedWaitlistProduct(null)}
          onSuccess={handleWaitlistSuccess}
        />
      )}

      {/* Upgrade Entitlement Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={currentWorkspace?.id || ''}
        workspaceSlug={currentWorkspace?.slug || 'store'}
        currentPlanKey={activePlanKey}
        triggerReason={upgradeReason}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </div>
  );
};
export default ProductCatalog;
