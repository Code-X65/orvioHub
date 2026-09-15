import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Boxes,
  ShoppingCart,
  Calendar,
  Dumbbell,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  Crown,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHomeUrl, getCrossSubdomainUrl } from '@/lib/domain';

interface OrgApp {
  applicationId: string;
  key: string;
  name: string;
  isActivated: boolean;
  status: string; // 'inactive' | 'trial' | 'active' | 'suspended'
  planId?: string;
  trialEndsAt?: number;
  activatedAt?: number;
}

interface OrgInfo {
  id: string;
  name: string;
  planKey: string;
}

// Application catalogue — maps key → display metadata
const APP_META: Record<string, { icon: React.ReactNode; description: string; badge?: string }> = {
  inventory: {
    icon: <Boxes className="w-7 h-7 text-indigo-400" />,
    description: 'Full inventory management: stock tracking, purchases, sales POS, and reports.',
    badge: 'Flagship',
  },
  pos: {
    icon: <ShoppingCart className="w-7 h-7 text-emerald-400" />,
    description: 'Point-of-sale terminal with receipts, cash management, and shift reports.',
  },
  booking: {
    icon: <Calendar className="w-7 h-7 text-sky-400" />,
    description: 'Appointment and reservation management with automated reminders.',
    badge: 'Coming Soon',
  },
  gym: {
    icon: <Dumbbell className="w-7 h-7 text-orange-400" />,
    description: 'Membership management, class scheduling, and trainer assignment.',
    badge: 'Coming Soon',
  },
};

function getAppMeta(key: string) {
  return (
    APP_META[key] || {
      icon: <Zap className="w-7 h-7 text-purple-400" />,
      description: `${key.charAt(0).toUpperCase() + key.slice(1)} management module.`,
    }
  );
}

function statusBadge(app: OrgApp) {
  if (!app.isActivated || app.status === 'inactive') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
        Not Activated
      </span>
    );
  }
  if (app.status === 'trial' || app.status === 'trialing') {
    const daysLeft = app.trialEndsAt
      ? Math.max(0, Math.ceil((app.trialEndsAt - Date.now()) / 86_400_000))
      : null;
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Trial{daysLeft !== null ? ` · ${daysLeft}d left` : ''}
      </span>
    );
  }
  if (app.status === 'active') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    );
  }
  if (app.status === 'suspended') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
        Suspended
      </span>
    );
  }
  return null;
}

export const AppActivationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspaceStore();

  const orgId = searchParams.get('orgId') || currentWorkspace?.organizationId || currentWorkspace?.id;

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [apps, setApps] = useState<OrgApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Load org info + subscription
      const [orgRes, appsRes] = await Promise.all([
        api.get<any>(`/organizations/${orgId}`).catch(() => null),
        api.get<any>(`/organizations/${orgId}/applications`).catch(() => ({ data: [] })),
      ]);

      const orgData = orgRes?.organization || orgRes;
      const subRes = await api.get<any>(`/organizations/${orgId}/subscription`).catch(() => null);
      const planKey = subRes?.subscription?.planKey || subRes?.planKey || 'free_trial';

      setOrg({
        id: orgId,
        name: orgData?.name || 'Your Organization',
        planKey,
      });

      const rawApps: OrgApp[] = Array.isArray(appsRes)
        ? appsRes
        : Array.isArray(appsRes?.data)
        ? appsRes.data
        : [];

      setApps(rawApps);
    } catch (err) {
      toast.error('Failed to load application data.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isFreeTrialPlan = org?.planKey === 'free_trial' || org?.planKey === 'free';
  const activatedCount = apps.filter(
    (a) => a.isActivated && a.status !== 'inactive'
  ).length;
  const maxApps = isFreeTrialPlan ? 1 : Infinity;
  const atLimit = isFreeTrialPlan && activatedCount >= maxApps;

  const handleActivate = async (app: OrgApp) => {
    if (!org) return;
    if (app.isActivated && app.status !== 'inactive') {
      // Already active — go to branch setup
      navigate(`/orgs/${org.id}/apps/${app.key}/branches`);
      return;
    }

    // Coming soon apps
    if (APP_META[app.key]?.badge === 'Coming Soon') {
      toast.info(`${app.name} is coming soon! Stay tuned.`);
      return;
    }

    if (atLimit) {
      toast.error(
        'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more.'
      );
      return;
    }

    if (isFreeTrialPlan && app.key !== 'inventory') {
      toast.error('This application is not available on Free Trial. Upgrade to Standard.');
      return;
    }

    setActivating(app.key);
    try {
      const planKey = org.planKey === 'standard' ? 'standard' : 'free_trial';
      await api.post(`/organizations/${org.id}/applications/${app.key}/activate`, {
        planKey,
      });

      toast.success(`${app.name} activated successfully!`);
      await loadData();

      // Navigate to app onboarding (e.g. inventory) or branch setup
      setTimeout(() => {
        if (app.key === 'inventory') {
          window.location.href = getCrossSubdomainUrl('inventory', `/onboard/app?org=${org.id}`);
        } else {
          navigate(`/orgs/${org.id}/apps/${app.key}/branches`);
        }
      }, 500);
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Failed to activate application.';
      if (
        msg.includes('Free Trial organizations can only activate 1 application') ||
        err?.code === 'APP_LIMIT_REACHED'
      ) {
        toast.error(
          'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more.'
        );
      } else if (
        msg.includes('not available on Free Trial') ||
        err?.code === 'APP_NOT_ALLOWED_ON_PLAN'
      ) {
        toast.error('This application is not available on Free Trial. Upgrade to Standard.');
      } else {
        toast.error(msg);
      }
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-400">
        <p>Organization not found. Please go back and select an organization.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 selection:bg-indigo-600/40">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-300">{org?.name}</span>
          </div>
          <button
            onClick={() => (window.location.href = getHomeUrl())}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold">
            <Zap className="w-3 h-3" />
            Application Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Activate Applications
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Choose and activate the modules your organization needs. Each application manages a
            separate set of data and branches.
          </p>
        </div>

        {/* Plan notice */}
        {isFreeTrialPlan && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-amber-300">Free Trial Plan:</span>{' '}
              <span className="text-slate-400">
                You can activate{' '}
                <span className="text-amber-300 font-medium">1 application</span> and{' '}
                <span className="text-amber-300 font-medium">1 branch</span> per app.{' '}
                <a
                  href="/settings/billing"
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  Upgrade to Standard
                </a>{' '}
                to unlock everything.
              </span>
            </div>
          </div>
        )}

        {/* Apps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {apps.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-500">
              <Boxes className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No applications are available yet.</p>
            </div>
          ) : (
            apps.map((app) => {
              const meta = getAppMeta(app.key);
              const isComingSoon = meta.badge === 'Coming Soon';
              const isAlreadyActive = app.isActivated && app.status !== 'inactive';
              const isLockedByPlan = atLimit && !isAlreadyActive && !isComingSoon;
              const isActivatingThis = activating === app.key;

              return (
                <div
                  key={app.key}
                  className={cn(
                    'relative p-5 rounded-2xl border transition-all duration-200',
                    isAlreadyActive
                      ? 'border-indigo-500/30 bg-indigo-500/5 shadow-[0_0_24px_rgba(99,102,241,0.07)]'
                      : isComingSoon
                      ? 'border-white/5 bg-white/[0.02] opacity-60'
                      : isLockedByPlan
                      ? 'border-white/5 bg-white/[0.02] opacity-70'
                      : 'border-white/10 bg-white/[0.03] hover:border-indigo-500/30 hover:bg-indigo-500/5 cursor-pointer'
                  )}
                >
                  {/* App header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5">{meta.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">
                            {app.name}
                          </h3>
                          {meta.badge && meta.badge !== 'Coming Soon' && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {meta.badge}
                            </span>
                          )}
                          {isComingSoon && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <div className="mt-1">{statusBadge(app)}</div>
                      </div>
                    </div>
                    {isLockedByPlan && (
                      <Lock className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" />
                    )}
                    {isAlreadyActive && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    {meta.description}
                  </p>

                  {/* Action button */}
                  {!isComingSoon && (
                    <Button
                      size="sm"
                      variant={isAlreadyActive ? 'outline' : 'default'}
                      onClick={() => handleActivate(app)}
                      disabled={isActivatingThis || isLockedByPlan || isComingSoon}
                      className={cn(
                        'w-full text-xs h-8 gap-1.5 transition-all',
                        isAlreadyActive
                          ? 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10'
                          : isLockedByPlan
                          ? 'opacity-40 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white border-0'
                      )}
                    >
                      {isActivatingThis ? (
                        <>
                          <Spinner size="sm" /> Activating…
                        </>
                      ) : isAlreadyActive ? (
                        <>
                          Manage Branches <ArrowRight className="w-3 h-3" />
                        </>
                      ) : isLockedByPlan ? (
                        <>
                          <Crown className="w-3 h-3" /> Upgrade Required
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" /> Activate
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => (window.location.href = getHomeUrl())}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Skip for now →
          </button>
        </div>
      </main>
    </div>
  );
};

export default AppActivationPage;
