import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { useHost } from '@/host/useHost';
import {
  getApplicationUrl,
  getAccountsUrl,
  getLauncherUrl,
  type ApplicationKey,
} from '@orviohub/shared';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  ArrowRight,
  ExternalLink,
  Users,
  CheckCircle2,
  Layers,
  Store,
  Clock,
  Search,
  User as UserIcon,
  Check,
  Globe,
  Tag,
  Briefcase,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResumeSetupBanner } from '@/components/onboarding/ResumeSetupBanner';
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
    createdAt?: number;
  };
  role: string;
  isOwner?: boolean;
  enabledProducts?: Array<{ productKey: string; status: string; planId?: string }>;
}

interface AppDefinition {
  key: string;
  name: string;
  category: string;
  headline: string;
  description: string;
  isActive: boolean;
  isBeta?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
}

const APPS_REGISTRY: AppDefinition[] = [
  {
    key: 'inventory',
    name: 'Inventory Management System',
    category: 'Operations & Commerce',
    headline: 'Multi-branch warehouse stock, barcode POS checkout & store registers.',
    description: 'Track real-time stock across branches, manage receipts & purchase orders, run point-of-sale registers, and generate sales telemetry.',
    isActive: true,
    icon: Package,
    features: [
      'Multi-warehouse & store branch support',
      'Barcode scanner & POS terminal checkout',
      'Stock alerts, transfers & re-order automation',
      'Sales analytics & transaction telemetry',
    ],
  },
  {
    key: 'taskmanagement',
    name: 'Task Management & Workflows',
    category: 'Productivity',
    headline: 'Agile sprints, interactive kanban boards & team deliverables.',
    description: 'Collaborative task execution, backlog refinement, sprint checkpoints, and workload distribution.',
    isActive: false,
    isBeta: true,
    icon: Layers,
    features: [
      'Interactive Kanban Boards & Backlogs',
      'Sprint & Milestone Planning',
      'Cross-team Task Assignments & Timelines',
    ],
  },
  {
    key: 'crm',
    name: 'Customer CRM & Pipeline',
    category: 'Sales & Growth',
    headline: 'Client directory, communication histories & deal stages.',
    description: 'Keep track of customer interactions, leads, follow-ups, and sales opportunities.',
    isActive: false,
    isBeta: true,
    icon: Users,
    features: [
      'Customer Contact Directory',
      'Visual Lead & Deal Pipelines',
      'Interaction History & Touchpoint Logging',
    ],
  },
  {
    key: 'booking',
    name: 'Appointments & Scheduling',
    category: 'Operations',
    headline: 'Online calendar reservations, service scheduling & reminders.',
    description: 'Automate client bookings, calendar synchronization, and service appointments.',
    isActive: false,
    icon: Clock,
    features: [
      'Customer Self-Service Booking Page',
      'Automated SMS & Email Confirmations',
      'Service Duration & Staff Schedule Rules',
    ],
  },
];

export const Dashboard: React.FC = () => {
  const host = useHost();
  const env = host.environment;
  const { user, memberships, setActiveOrganizationId, setMemberships } = useAuthStore();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [launchingOrgId, setLaunchingOrgId] = useState<string | null>(null);

  // Resume Onboarding Banner State
  const [onboardingProgress, setOnboardingProgress] = useState<any>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Usage Quota & Upgrade Modal State
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Waitlist state
  const [joinedWaitlists, setJoinedWaitlists] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchWorkspacesAndProgress();
  }, []);

  const fetchWorkspacesAndProgress = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch workspaces
      const res = await api.get<{ data?: { workspaces: WorkspaceItem[] }; workspaces?: WorkspaceItem[] }>('/workspaces');
      const list = res.data?.workspaces || res.workspaces || [];
      setWorkspaces(list);

      if (list.length > 0 && memberships.length === 0) {
        setMemberships(
          list.map((w) => ({
            organization: {
              id: w.workspace.id,
              name: w.workspace.name,
              slug: w.workspace.slug,
            },
            role: w.role as any,
            status: 'ACTIVE',
          }))
        );
      }

      // 2. Fetch primary workspace usage summary
      if (list.length > 0) {
        const primaryId = list[0].workspace.id;
        try {
          const usageRes = await api.get<any>(`/workspaces/${primaryId}/usage`);
          if (usageRes?.data || usageRes?.summary) {
            const sum = usageRes.data || usageRes.summary;
            setUsageSummary(sum);
          }
        } catch {}
      }

      // 3. Fetch incomplete onboarding draft / progress
      let activeProgress: any = null;
      try {
        const rawDraft = localStorage.getItem('orvio_org_creation_draft');
        if (rawDraft) {
          const parsedDraft = JSON.parse(rawDraft);
          if (parsedDraft.orgName || parsedDraft.step) {
            activeProgress = {
              orgName: parsedDraft.orgName,
              product: parsedDraft.product || 'inventory',
              step: parsedDraft.step || 1,
              isDraft: true,
            };
          }
        }
      } catch {}

      try {
        const obRes = await api.get<any>('/onboarding/status');
        if (obRes?.data && obRes.data.status !== 'COMPLETED') {
          activeProgress = {
            ...activeProgress,
            ...obRes.data,
          };
        }
      } catch {}

      if (activeProgress) {
        setOnboardingProgress(activeProgress);
      }
    } catch (err: any) {
      console.warn('Could not fetch workspaces:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeSetup = () => {
    const targetProduct = onboardingProgress?.product || 'inventory';
    const launcherBase = getLauncherUrl(env);
    window.location.href = `${launcherBase}/workspaces/new?product=${encodeURIComponent(targetProduct)}`;
  };

  const handleLaunchApp = async (workspaceId: string, productKey: string = 'inventory') => {
    setLaunchingOrgId(workspaceId);
    try {
      await api.post(`/workspaces/${workspaceId}/select`, { productKey });
      setActiveOrganizationId(workspaceId);
      const appUrl = getApplicationUrl(productKey as ApplicationKey, env);
      window.location.href = `${appUrl}/dashboard`;
    } catch {
      setActiveOrganizationId(workspaceId);
      const appUrl = getApplicationUrl(productKey as ApplicationKey, env);
      window.location.href = `${appUrl}/dashboard`;
    } finally {
      setLaunchingOrgId(null);
    }
  };

  const handleCreateOrgForApp = (appKey: string) => {
    const launcherBase = getLauncherUrl(env);
    window.location.href = `${launcherBase}/workspaces/new?product=${encodeURIComponent(appKey)}`;
  };

  const handleJoinWaitlist = async (appKey: string, appName: string) => {
    try {
      await api.post(`/products/${appKey}/notify`, { email: user?.email });
      setJoinedWaitlists((prev) => ({ ...prev, [appKey]: true }));
      toast.success(`You're on the list! We will notify you as soon as ${appName} launches.`);
    } catch {
      setJoinedWaitlists((prev) => ({ ...prev, [appKey]: true }));
      toast.success(`You're on the waitlist for ${appName}!`);
    }
  };

  const inventoryWorkspaces = workspaces.filter((w) => {
    const hasInventory =
      !w.enabledProducts ||
      w.enabledProducts.length === 0 ||
      w.enabledProducts.some((p) => p.productKey === 'inventory');

    if (!searchQuery.trim()) return hasInventory;
    const q = searchQuery.toLowerCase();
    return hasInventory && (w.workspace.name.toLowerCase().includes(q) || w.workspace.slug.toLowerCase().includes(q));
  });

  const firstName = user?.firstName || user?.name?.split(' ')[0] || 'there';
  const totalOrgsCount = workspaces.length;

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-[#714b67] selection:text-white relative overflow-x-hidden">
      {/* Top Universal Navigation Header */}
      <Header />

      {/* Subtle Background Radial Glow matching AuthLayout & PricingPage */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-radial from-[#714b67]/15 to-transparent pointer-events-none -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 relative z-10">
        
        {/* Header Hero Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-[#714b67]/20 border border-[#714b67]/40 text-xs font-semibold text-[#f0d8e8]">
              <Sparkles className="w-3.5 h-3.5 text-[#c79dbd]" />
              <span>Workspaces & App Launcher</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              Manage and access your business organizations categorized by application. Select an organization to launch into its operational dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`${getAccountsUrl(env)}/profile/personal`}
              className="h-10 px-4 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium rounded-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#c79dbd]" />
              <span>Personal Account</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            <Button
              onClick={() => handleCreateOrgForApp('inventory')}
              className="h-10 px-4 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white text-xs font-semibold rounded-xs shadow-lg shadow-[#714b67]/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Organization</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Contextual Banners (Resume Setup & Plan Limits) */}
        <div className="space-y-4">
          {/* Resume Onboarding Banner */}
          {onboardingProgress && !isBannerDismissed && (
            <ResumeSetupBanner
              orgName={onboardingProgress.orgName}
              step={onboardingProgress.step}
              product={onboardingProgress.product}
              currentStepName={onboardingProgress.currentStep?.replace(/_/g, ' ')}
              onResume={handleResumeSetup}
              onDismiss={() => setIsBannerDismissed(true)}
            />
          )}

          {/* Plan Quota Limit Warnings */}
          {usageSummary?.warningMessage && (
            <UsageLimitBanner
              warningMessage={usageSummary.warningMessage}
              isReached={usageSummary.hasExceededLimits}
              planKey={usageSummary.planKey}
              onUpgradeClick={() => setIsUpgradeModalOpen(true)}
            />
          )}
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Briefcase className="w-4 h-4 text-[#c79dbd]" />
            <span>
              You have <strong className="text-white font-semibold">{totalOrgsCount}</strong> organization{totalOrgsCount === 1 ? '' : 's'} across <strong className="text-white font-semibold">1</strong> active application
            </span>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your organizations..."
              className="pl-9 h-10 bg-[#0c070a] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
            />
          </div>
        </div>

        {/* APPLICATION SECTIONS */}
        <div className="space-y-10">

          {/* APPLICATION 1: INVENTORY MANAGEMENT (ACTIVE) */}
          <div className="p-6 sm:p-8 rounded-sm bg-[#140c13] border-2 border-[#714b67] shadow-2xl shadow-[#714b67]/20 relative space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xs bg-[#714b67] flex items-center justify-center text-white shrink-0 shadow-md">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      Inventory Management System
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Multi-branch stock, POS checkout terminal, receipt billing, and sales telemetry.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => handleCreateOrgForApp('inventory')}
                variant="outline"
                className="self-start sm:self-auto h-9 px-3.5 border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-medium rounded-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#c79dbd]" />
                <span>Add Inventory Organization</span>
              </Button>
            </div>

            {/* Organizations Grid */}
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Spinner size="default" className="text-[#714b67]" />
                <p className="text-xs">Loading organizations...</p>
              </div>
            ) : inventoryWorkspaces.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventoryWorkspaces.map((item) => {
                  const isLaunching = launchingOrgId === item.workspace.id;
                  const roleLabel = item.role || 'MEMBER';
                  const isOwner = roleLabel === 'OWNER' || item.isOwner;

                  return (
                    <div
                      key={item.workspace.id}
                      className="p-5 rounded-sm bg-[#0c070a] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4 group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xs bg-[#190f17] border border-white/10 flex items-center justify-center text-[#f0d8e8] font-bold text-xs">
                              {item.workspace.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white group-hover:text-[#f0d8e8] transition-colors line-clamp-1">
                                {item.workspace.name}
                              </h3>
                              <span className="text-[11px] font-mono text-slate-500">
                                {item.workspace.slug}
                              </span>
                            </div>
                          </div>

                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-xs border',
                              isOwner
                                ? 'bg-[#714b67]/30 text-white border-[#714b67]/50'
                                : 'bg-white/5 text-slate-300 border-white/10'
                            )}
                          >
                            {roleLabel}
                          </span>
                        </div>

                        {/* Metadata Tags */}
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-xs border border-white/5">
                            <Globe className="w-3 h-3 text-slate-500" />
                            {item.workspace.country || 'Global'}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-xs border border-white/5">
                            <Tag className="w-3 h-3 text-slate-500" />
                            {item.workspace.currency || 'NGN'}
                          </span>
                        </div>
                      </div>

                      {/* Launch Button */}
                      <Button
                        onClick={() => handleLaunchApp(item.workspace.id, 'inventory')}
                        disabled={isLaunching}
                        className="w-full h-9 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs text-xs font-semibold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isLaunching ? (
                          <Spinner size="sm" className="text-white mr-1" />
                        ) : (
                          <>
                            <span>Open Inventory</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="p-8 rounded-sm bg-[#0c070a] border border-dashed border-white/15 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-10 h-10 rounded-xs bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#f0d8e8]">
                  <Store className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">No Inventory Organizations</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    You have not configured an organization for Inventory yet. Create an organization to start managing stock and sales registers.
                  </p>
                </div>
                <Button
                  onClick={() => handleCreateOrgForApp('inventory')}
                  className="h-9 px-4 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs shadow-md cursor-pointer flex items-center gap-1.5 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Organization</span>
                </Button>
              </div>
            )}
          </div>

          {/* UPCOMING APPLICATIONS (Styled matching PricingPage 3 Cards Grid) */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Upcoming Applications
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                New modules coming to the Orviohub platform. You will be able to provision organizations upon launch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {APPS_REGISTRY.filter((app) => !app.isActive).map((app) => {
                const Icon = app.icon;
                const isJoined = joinedWaitlists[app.key];

                return (
                  <div
                    key={app.key}
                    className="p-6 sm:p-7 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col justify-between gap-6 hover:border-white/20 transition-all group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xs bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
                          <Icon className="w-5 h-5" />
                        </div>
                        {app.isBeta ? (
                          <span className="text-[10px] font-semibold bg-blue-950 text-blue-300 px-2 py-0.5 rounded-xs border border-blue-800">
                            BETA PREVIEW
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-white/5 text-slate-400 px-2 py-0.5 rounded-xs border border-white/10">
                            COMING SOON
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          {app.category}
                        </span>
                        <h3 className="text-base font-bold text-white">{app.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {app.headline}
                        </p>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-300 border-t border-white/5 pt-4">
                        {app.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      onClick={() => handleJoinWaitlist(app.key, app.name)}
                      disabled={isJoined}
                      variant="outline"
                      className="w-full h-10 bg-[#160f14] hover:bg-[#22151f] border-white/10 text-white rounded-xs font-semibold text-xs transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {isJoined ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Joined Waitlist</span>
                        </>
                      ) : (
                        <>
                          <span>Notify on Launch</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decoupled Personal Account Banner */}
          <div className="p-6 rounded-sm bg-[#0c070a] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xs bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#f0d8e8] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Independent Personal Account</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your Orviohub account belongs to you. You can own multiple organizations or operate solely with your personal profile.
                </p>
              </div>
            </div>

            <a
              href={`${getAccountsUrl(env)}/profile/personal`}
              className="text-xs text-[#c79dbd] hover:text-white transition-colors underline shrink-0 flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Manage Security & Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>
      </main>

      {/* Minimal Footer matching AuthLayout & PricingPage */}
      <footer className="w-full border-t border-white/5 bg-black py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Orivo Inc. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#help" className="hover:text-slate-300 transition-colors">Help</a>
          </div>
        </div>
      </footer>

      {/* Upgrade Plan Tier Selection Modal */}
      {workspaces.length > 0 && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          workspaceId={workspaces[0].workspace.id}
          workspaceSlug={workspaces[0].workspace.slug}
          currentPlanKey={usageSummary?.planKey || 'free'}
          onClose={() => setIsUpgradeModalOpen(false)}
          onSuccess={() => {
            fetchWorkspacesAndProgress();
            toast.success('Subscription plan upgraded successfully!');
          }}
        />
      )}
    </div>
  );
};
