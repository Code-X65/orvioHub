import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import {
  getApplicationUrl,
  getAccountsUrl,
  getHomeUrl,
  ApplicationKey,
} from '@orviohub/shared';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Plus,
  ArrowRight,
  Search,
  Sparkles,
  Check,
  Building2,
  X,
  Globe,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UsageLimitBanner } from '@/components/billing/UsageLimitBanner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';

interface WorkspaceItem {
  workspace: {
    id: string;
    name: string;
    slug: string;
    type?: string;
    currency?: string;
    country?: string;
    logoUrl?: string;
    status?: string;
  };
  role: string;
  isOwner?: boolean;
  enabledProducts: Array<{ productKey: string; status: string; planId?: string }>;
}

export interface CatalogProduct {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  headline?: string;
  description: string;
  category?: 'operations' | 'productivity' | 'core' | 'finance' | 'sales';
  status: 'active' | 'coming_soon' | 'draft' | 'ACTIVE' | 'BETA' | 'COMING_SOON';
  isBeta?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
  iconUrl?: string;
  subdomain?: string;
  features?: string[];
}

const FALLBACK_CATALOG: CatalogProduct[] = [
  {
    key: 'inventory',
    name: 'Inventory Management System',
    headline: 'Multi-branch stock, POS checkout, sales telemetry & warehouse management.',
    description: 'Multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.',
    category: 'operations',
    status: 'active',
    isFeatured: true,
    features: [
      'Real-time stock tracking',
      'Barcode & POS checkout',
      'Multi-branch support',
      'Customer & supplier directory',
    ],
  },
  {
    key: 'taskmanagement',
    name: 'Task Management & Workflows',
    headline: 'Agile sprints, kanban boards, team workflows & project tracking.',
    description: 'Collaborative task execution, backlog refinement, automated assignments and timelines.',
    category: 'productivity',
    status: 'active',
    isFeatured: true,
    features: [
      'Interactive Kanban Boards',
      'Sprint & Milestone Planning',
      'Cross-team Task Assignments',
      'Real-time Status Updates',
    ],
  },
  {
    key: 'crm',
    name: 'Customer CRM & Pipeline',
    headline: 'Client contact directories, communication history, pipelines & deal tracking.',
    description: 'Keep track of customer interactions, leads, follow-ups, and sales opportunities.',
    category: 'sales',
    status: 'coming_soon',
    isBeta: true,
    features: [
      'Customer Contact Directory',
      'Lead & Deal Pipelines',
      'Interaction History',
      'Custom Tags & Segmentation',
    ],
  },
  {
    key: 'booking',
    name: 'Appointments & Scheduling',
    headline: 'Online calendar reservations, service scheduling, reminders & booking.',
    description: 'Automate client bookings, calendar synchronization, and service appointments.',
    category: 'operations',
    status: 'coming_soon',
    features: [
      'Online Booking Page',
      'Automated Reminders',
      'Calendar Sync',
      'Service Duration Rules',
    ],
  },
  {
    key: 'gym',
    name: 'Gym & Fitness Membership',
    headline: 'Member passes, attendance tracking, trainer schedules & subscriptions.',
    description: 'Complete member pass management, attendance barcode scanning, and trainer plans.',
    category: 'operations',
    status: 'coming_soon',
    features: [
      'Member Pass Management',
      'Attendance Tracking',
      'Class & Trainer Scheduling',
      'Membership Subscriptions',
    ],
  },
];

export const AppLauncher: React.FC = () => {
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { isAuthenticated, user } = useAuthStore();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>(FALLBACK_CATALOG);
  const [isLoading, setIsLoading] = useState(true);

  // Selection Modal State
  const [selectedProductForOrgPick, setSelectedProductForOrgPick] = useState<CatalogProduct | null>(null);
  const [isActivatingProduct, setIsActivatingProduct] = useState<string | null>(null);

  // Waitlist Modal State
  const [waitlistProduct, setWaitlistProduct] = useState<CatalogProduct | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [joinedWaitlists, setJoinedWaitlists] = useState<Record<string, boolean>>({});

  // Usage & Plan Limits Warning State
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Resume Onboarding Banner State
  const [onboardingProgress, setOnboardingProgress] = useState<any>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const fetchCatalogAndAccessData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch live visible products from backend API
      try {
        const prodRes = await api.get<{ products: CatalogProduct[] }>('/products');
        if (prodRes.products && prodRes.products.length > 0) {
          setCatalogProducts(prodRes.products);
        }
      } catch {
        // Fallback to FALLBACK_CATALOG
      }

      // 2. Fetch authenticated user organization access & onboarding state
      if (isAuthenticated) {
        try {
          const obRes = await api.get<any>('/onboarding/status');
          if (obRes.data && obRes.data.status !== 'COMPLETED') {
            setOnboardingProgress(obRes.data);
          }
        } catch {
          // Optional onboarding fallback
        }

        const res = await api.get<{
          ownedOrganizations: any[];
          joinedOrganizations: any[];
          pendingInvitations: any[];
        }>('/users/me/application-access');

        const owned = (res.ownedOrganizations || []).map((o) => ({
          workspace: {
            id: o.id || o.workspaceId,
            name: o.name,
            slug: o.slug,
            type: o.type,
            currency: o.currency,
            country: o.country,
            logoUrl: o.logoUrl,
            status: o.status,
          },
          role: o.role || 'OWNER',
          isOwner: true,
          enabledProducts: o.enabledProducts || [{ productKey: 'inventory', status: 'active' }],
        }));

        const joined = (res.joinedOrganizations || []).map((o) => ({
          workspace: {
            id: o.id || o.workspaceId,
            name: o.name,
            slug: o.slug,
            type: o.type,
            currency: o.currency,
            country: o.country,
            logoUrl: o.logoUrl,
            status: o.status,
          },
          role: o.role || 'MEMBER',
          isOwner: false,
          enabledProducts: o.enabledProducts || [{ productKey: 'inventory', status: 'active' }],
        }));

        const allWs = [...owned, ...joined];
        setWorkspaces(allWs);

        // Fetch Usage Summary for primary workspace
        if (allWs.length > 0) {
          const primaryId = allWs[0].workspace.id;
          try {
            const usageRes = await api.get<any>(`/workspaces/${primaryId}/usage/summary`);
            setUsageSummary(usageRes);
          } catch {
            // Optional usage summary fallback
          }
        }
      }
    } catch {
      // Silent error fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogAndAccessData();
  }, [isAuthenticated]);

  // Application selection workflow
  const handleSelectApplication = async (app: CatalogProduct) => {
    if (!isAuthenticated) {
      window.location.href = `${getAccountsUrl(env)}/signup?product=${app.key}`;
      return;
    }

    if (app.key === 'home') {
      window.location.href = getHomeUrl(env);
      return;
    }

    // 1. If user has no organizations at all -> create organization for that product
    if (workspaces.length === 0) {
      navigate(`/app/organizations/new?product=${app.key}`);
      return;
    }

    // 2. Filter accessible organizations where product is enabled
    const matchingOrgs = workspaces.filter((w) =>
      w.enabledProducts?.some((p) => p.productKey === app.key && (p.status === 'active' || p.status === 'trial'))
    );

    if (matchingOrgs.length === 1) {
      const target = matchingOrgs[0];
      try {
        await api.post(`/workspaces/${target.workspace.id}/select`, { productKey: app.key });
      } catch {
        // Continue
      }
      window.location.href = getApplicationUrl(app.key as ApplicationKey, env);
      return;
    }

    if (matchingOrgs.length > 1 || workspaces.length > 0) {
      // Show organization selector modal to pick which org or activate
      setSelectedProductForOrgPick(app);
      return;
    }

    navigate(`/app/organizations/new?product=${app.key}`);
  };

  const handleActivateAndOpen = async (workspaceId: string, appKey: string) => {
    setIsActivatingProduct(appKey);
    try {
      await api.post(`/workspaces/${workspaceId}/products/${appKey}/activate`, {});
      await api.post(`/workspaces/${workspaceId}/select`, { productKey: appKey });
      toast.success(`Application activated successfully!`);
      setSelectedProductForOrgPick(null);
      await fetchCatalogAndAccessData();
      window.location.href = getApplicationUrl(appKey as ApplicationKey, env);
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate application.');
    } finally {
      setIsActivatingProduct(null);
    }
  };

  // Waitlist handlers
  const handleOpenWaitlist = (product: CatalogProduct) => {
    setWaitlistProduct(product);
    setWaitlistEmail(user?.email || '');
  };

  const handleSubmitWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistProduct || !waitlistEmail.trim()) return;

    setIsSubmittingWaitlist(true);
    try {
      const res = await api.post<{ alreadySubscribed?: boolean; message?: string }>(
        `/products/${waitlistProduct.key}/notify`,
        { email: waitlistEmail.trim() }
      );

      setJoinedWaitlists((prev) => ({ ...prev, [waitlistProduct.key]: true }));
      toast.success(
        res.alreadySubscribed
          ? `You're already on the waitlist for ${waitlistProduct.name}!`
          : `You're on the list! We'll notify you as soon as ${waitlistProduct.name} launches.`
      );
      setWaitlistProduct(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join waitlist.');
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  // Filter out draft products for user launcher
  const visibleProducts = catalogProducts.filter((app) => {
    const s = (app.status || 'active').toLowerCase();
    return s !== 'draft';
  });

  const filteredApps = visibleProducts.filter((app) => {
    const q = searchQuery.toLowerCase();
    return (
      app.name.toLowerCase().includes(q) ||
      (app.headline || '').toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Top Universal Landing Header */}
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Unified Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Orviohub Modular Platform</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            One Unified Platform.<br />Every App Your Business Needs.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {isAuthenticated
              ? 'Select any application below to start working, or create a new organization.'
              : 'Explore our connected suite of business applications. Select any app to get started with an organization or try free for 14 days.'}
          </p>
        </div>

        {/* Resume Onboarding Banner */}
        {isAuthenticated && onboardingProgress && !isBannerDismissed && (
          <div className="rounded-2xl bg-gradient-to-r from-[#1e111a] via-[#160f14] to-[#0c080b] border border-[#714b67]/40 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 text-[#e2b9d8] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Continue Your Organization Setup</h3>
                <p className="text-xs text-slate-400">
                  You have an incomplete setup ({onboardingProgress.currentStep?.replace(/_/g, ' ') || 'organization setup'}). Resume now to finish setting up your workspace and apps.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="ghost"
                onClick={() => setIsBannerDismissed(true)}
                className="h-9 px-3 text-xs text-slate-400 hover:text-white"
              >
                Dismiss
              </Button>
              <Button
                onClick={() => navigate('/onboarding/organization')}
                className="h-9 px-4 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Resume Setup</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Main Applications Section */}
        <div className="space-y-6">
          {/* Plan Quota Limit Warnings */}
          {usageSummary?.warningMessage && (
            <UsageLimitBanner
              warningMessage={usageSummary.warningMessage}
              isReached={usageSummary.hasExceededLimits}
              planKey={usageSummary.planKey}
              onUpgradeClick={() => setIsUpgradeModalOpen(true)}
            />
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {isAuthenticated ? 'What would you like to use?' : 'Available Applications'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isAuthenticated
                  ? 'Select an application to launch or create an organization for.'
                  : 'High-performance cloud applications built for scale and real-time operations.'}
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applications..."
                className="pl-9 h-10 bg-[#120b10] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs"
              />
            </div>
          </div>

          {/* Applications Grid */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Spinner size="default" className="text-[#714b67]" />
              <p className="text-xs">Loading available applications...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApps.map((app) => {
                const s = (app.status || 'active').toLowerCase();
                const isComingSoon = s === 'coming_soon' || s === 'beta';
                const isJoined = joinedWaitlists[app.key];

                return (
                  <div
                    key={app.key}
                    className={cn(
                      'p-6 rounded-xs border transition-all flex flex-col justify-between relative group shadow-xl',
                      isComingSoon
                        ? 'border-amber-500/20 bg-[#120e0a]'
                        : 'border-white/10 bg-[#120b10] hover:border-[#714b67]/50'
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-xs border flex items-center justify-center font-bold text-base shadow-inner',
                            isComingSoon
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-[#080407] text-[#c79dbd] border-white/10'
                          )}
                        >
                          {app.name.charAt(0)}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {app.isBeta && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-blue-950/80 text-blue-400 border border-blue-500/30">
                              BETA
                            </span>
                          )}

                          {isComingSoon ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-amber-950/80 text-amber-400 border border-amber-500/30">
                              COMING SOON
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                              AVAILABLE
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-[#c79dbd] transition-colors">
                        {app.name}
                      </h3>
                      {app.headline && (
                        <p className="text-xs font-semibold text-slate-300 mt-1">
                          {app.headline}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                        {app.description}
                      </p>

                      {app.features && app.features.length > 0 && (
                        <div className="space-y-1.5 pt-4 mt-4 border-t border-white/5">
                          {app.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5">
                      {isComingSoon ? (
                        <Button
                          onClick={() => handleOpenWaitlist(app)}
                          className={cn(
                            'w-full h-10 rounded-xs text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors',
                            isJoined
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-amber-500 hover:bg-amber-400 text-black font-bold'
                          )}
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{isJoined ? 'On Waitlist (Notified)' : 'Notify me when available'}</span>
                        </Button>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <Button
                            onClick={() => handleSelectApplication(app)}
                            className="flex-1 h-10 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>{isAuthenticated ? 'Select application' : 'Get started'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>

                          <a
                            href={getApplicationUrl(app.key as ApplicationKey, env)}
                            className="flex-1 h-10 border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white rounded-xs text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
                          >
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span>Explore application</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-black py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orviohub Inc. • Multi-Tenant Application Operating Platform
      </footer>

      {/* Organization Selection Modal (when an active app is clicked) */}
      {selectedProductForOrgPick && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#140b12] border border-white/15 rounded-xs shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#c79dbd]" />
                <div>
                  <h3 className="font-bold text-sm text-white">Select an Organization</h3>
                  <p className="text-[11px] text-slate-400">
                    Choose which organization to open with {selectedProductForOrgPick.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductForOrgPick(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Organizations List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {workspaces.map((w) => {
                const hasAppEnabled = w.enabledProducts?.some(
                  (p) => p.productKey === selectedProductForOrgPick.key && (p.status === 'active' || p.status === 'trial')
                );

                return (
                  <div
                    key={w.workspace.id}
                    className="p-3 rounded-xs border border-white/10 bg-[#0c070a] hover:border-white/20 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">{w.workspace.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {w.role} • {w.isOwner ? 'Owned' : 'Joined'}
                      </div>
                    </div>

                    <div>
                      {hasAppEnabled ? (
                        <Button
                          size="sm"
                          onClick={async () => {
                            await api.post(`/workspaces/${w.workspace.id}/select`, {
                              productKey: selectedProductForOrgPick.key,
                            });
                            setSelectedProductForOrgPick(null);
                            window.location.href = getApplicationUrl(selectedProductForOrgPick.key as ApplicationKey, env);
                          }}
                          className="h-8 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer"
                        >
                          Open
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isActivatingProduct === selectedProductForOrgPick.key}
                          onClick={() => handleActivateAndOpen(w.workspace.id, selectedProductForOrgPick.key)}
                          className="h-8 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xs border border-white/10 cursor-pointer"
                        >
                          {isActivatingProduct === selectedProductForOrgPick.key ? (
                            <Spinner size="sm" className="mr-1" />
                          ) : (
                            <Plus className="w-3 h-3 mr-1" />
                          )}
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => {
                  const targetKey = selectedProductForOrgPick.key;
                  setSelectedProductForOrgPick(null);
                  navigate(`/app/organizations/new?product=${targetKey}`);
                }}
                className="w-full h-9 bg-transparent border-dashed border-white/20 hover:border-white/40 text-slate-300 text-xs rounded-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Organization for {selectedProductForOrgPick.name}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Waitlist Modal (for Coming Soon products) */}
      {waitlistProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-[#140b12] border border-amber-500/30 rounded-xs shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Join {waitlistProduct.name} Waitlist</h3>
                  <p className="text-[11px] text-slate-400">Get early beta access and launch updates</p>
                </div>
              </div>
              <button
                onClick={() => setWaitlistProduct(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              We’re currently finishing development on <strong>{waitlistProduct.name}</strong>. Enter your email below to be the first to know when it goes live.
            </p>

            <form onSubmit={handleSubmitWaitlist} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">Your Email Address</label>
                <Input
                  type="email"
                  required
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="bg-black/60 border-white/15 text-white placeholder:text-slate-600 rounded-xs text-xs h-10"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setWaitlistProduct(null)}
                  className="text-slate-400 hover:text-white text-xs h-9 rounded-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmittingWaitlist}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs h-9 rounded-xs flex items-center gap-1.5"
                >
                  {isSubmittingWaitlist && <Spinner size="sm" />}
                  <span>Notify Me at Launch</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgrade & Offline Payment Modal */}
      {workspaces.length > 0 && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          workspaceId={workspaces[0].workspace.id}
          workspaceSlug={workspaces[0].workspace.slug}
          currentPlanKey={usageSummary?.planKey || 'free'}
          onClose={() => setIsUpgradeModalOpen(false)}
          onSuccess={() => {
            toast.success('Upgrade request submitted successfully!');
            fetchCatalogAndAccessData();
          }}
        />
      )}
    </div>
  );
};

export default AppLauncher;
