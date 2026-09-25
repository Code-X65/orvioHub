import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  Crown,
  AlertCircle,
  Clock,
  Bell,
  Zap,
  HelpCircle,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHomeUrl, getCrossSubdomainUrl } from '@/lib/domain';
import { getAppMeta } from '@/lib/appRegistry';
import { getAppRedirectConfig } from '@/lib/appRedirectRegistry';
import {
  getRecommendationsForCategory,
  getContextualTipForApp,
} from '@/lib/appRecommendations';

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
  category?: string;
  industry?: string;
  businessType?: string;
  planKey: string;
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

  const [platformApps, setPlatformApps] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Load org info + subscription + platform applications registry
      const [orgRes, platformAppsRes, appsRes] = await Promise.all([
        api.get<any>(`/organizations/${orgId}`).catch(() => null),
        api.get<any>('/platform/applications').catch(() => null),
        api.get<any>(`/organizations/${orgId}/applications`).catch(() => ({ data: [] })),
      ]);

      const orgData = orgRes?.organization || orgRes;
      const subRes = await api.get<any>(`/organizations/${orgId}/subscription`).catch(() => null);
      const planKey = subRes?.subscription?.planKey || subRes?.planKey || 'free_trial';

      setOrg({
        id: orgId,
        name: orgData?.name || 'Your Organization',
        category: orgData?.category || orgData?.industry || orgData?.businessType || 'Provision Store',
        industry: orgData?.industry,
        businessType: orgData?.businessType,
        planKey,
      });

      const registryApps: any[] =
        platformAppsRes?.data?.applications ||
        platformAppsRes?.applications ||
        platformAppsRes?.data ||
        [
          { key: 'inventory', name: 'Inventory', status: 'active', isCore: true, planRequirements: ['free_trial', 'standard', 'premium', 'enterprise'], badge: 'Flagship' },
          { key: 'pos', name: 'POS Terminal', status: 'coming_soon', isCore: false, planRequirements: ['standard', 'premium', 'enterprise'] },
          { key: 'booking', name: 'Booking & Appointments', status: 'coming_soon', isCore: false, planRequirements: ['standard', 'premium', 'enterprise'], badge: 'Coming Soon' },
          { key: 'gym', name: 'Gym Management', status: 'coming_soon', isCore: false, planRequirements: ['standard', 'premium', 'enterprise'], badge: 'Coming Soon' },
          { key: 'taskmanagement', name: 'Task Management', status: 'coming_soon', isCore: false, planRequirements: ['standard', 'premium', 'enterprise'], badge: 'Coming Soon' },
        ];

      setPlatformApps(registryApps);

      const rawActivatedApps: any[] = Array.isArray(appsRes)
        ? appsRes
        : Array.isArray(appsRes?.data)
        ? appsRes.data
        : [];

      const activatedMap = new Map<string, any>();
      rawActivatedApps.forEach((a) => {
        const k = (a.key || a.applicationKey || a.productKey || '').toLowerCase();
        if (k) activatedMap.set(k, a);
      });

      const mergedApps: OrgApp[] = registryApps.map((reg) => {
        const found = activatedMap.get(reg.key.toLowerCase());
        const isActivated = Boolean(
          found?.isActivated ||
          found?.enabled ||
          found?.status === 'active' ||
          found?.status === 'trial' ||
          found?.status === 'trialing'
        );

        return {
          applicationId: found?.applicationId || found?._id || reg.key,
          key: reg.key,
          name: reg.name,
          isActivated,
          status: found?.status || (isActivated ? 'active' : (reg.status === 'coming_soon' ? 'inactive' : 'inactive')),
          planId: found?.planId,
          trialEndsAt: found?.trialEndsAt,
          activatedAt: found?.activatedAt,
        };
      });

      setApps(mergedApps);
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

    const regApp = platformApps.find((p) => p.key.toLowerCase() === app.key.toLowerCase());
    const meta = getAppMeta(app.key);

    // Coming soon apps
    if (meta.availability === 'coming_soon' || regApp?.status === 'coming_soon') {
      toast.info(`${app.name} is coming soon! Stay tuned.`);
      return;
    }

    if (atLimit) {
      toast.error(
        'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more.'
      );
      return;
    }

    const allowedPlans = (regApp?.planRequirements || meta.planRequirements || []).map((p: string) => p.toLowerCase());
    const currentPlan = (org.planKey || 'free_trial').toLowerCase();
    const normalizedPlan = currentPlan === 'free' ? 'free_trial' : currentPlan;

    if (
      allowedPlans.length > 0 &&
      !allowedPlans.includes(currentPlan) &&
      !allowedPlans.includes(normalizedPlan)
    ) {
      const planNames = regApp?.planRequirements || meta.planRequirements || ['Standard'];
      toast.error(
        `Requires ${planNames.join(' or ')} plan. Upgrade to activate.`
      );
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

      // Navigate to app onboarding or branch setup using registry-driven redirect
      setTimeout(() => {
        const config = getAppRedirectConfig(app.key);
        if (config.type === 'external') {
          window.location.href = config.getTarget(org.id);
        } else {
          navigate(config.getTarget(org.id));
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

        {/* Recommended for You Section */}
        {(() => {
          const recommendationProfile = getRecommendationsForCategory(
            org?.category || org?.industry || org?.businessType
          );
          if (!recommendationProfile) return null;

          return (
            <div className="p-5 sm:p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/30 via-[#714b67]/10 to-transparent space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                    <Sparkles className="w-4 h-4 text-[#FDB02F]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-white tracking-tight">
                        Recommended for You
                      </h2>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                        {recommendationProfile.categoryName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {recommendationProfile.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendationProfile.recommendations.map((rec) => {
                  const targetApp = apps.find((a) => a.key.toLowerCase() === rec.appKey.toLowerCase());
                  const meta = getAppMeta(rec.appKey);
                  const isActive = targetApp?.isActivated && targetApp.status !== 'inactive';

                  return (
                    <div
                      key={rec.appKey}
                      className={cn(
                        "p-3.5 rounded-xl border transition-all flex flex-col justify-between relative group",
                        isActive
                          ? "border-indigo-500/30 bg-indigo-500/10"
                          : "border-white/10 bg-black/40 hover:border-indigo-500/30 hover:bg-white/[0.04]"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-white/5 text-indigo-300">
                              {meta.icon}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white">
                                {targetApp?.name || rec.appKey}
                              </span>
                              {rec.tag && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[8px] font-semibold rounded bg-white/5 text-slate-300 border border-white/10">
                                  {rec.tag}
                                </span>
                              )}
                            </div>
                          </div>

                          {isActive ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <div className="relative group/tooltip">
                              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 cursor-help">
                                <HelpCircle className="w-3 h-3" />
                                <span className="hidden sm:inline">Why this?</span>
                              </span>
                              <div className="absolute right-0 top-full mt-1.5 w-64 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-300 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-30">
                                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3 text-[#FDB02F]" />
                                  Why we recommend this:
                                </div>
                                <p className="leading-relaxed text-slate-300">
                                  {rec.reason}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                          {rec.reason}
                        </p>
                      </div>

                      {!isActive && targetApp && (
                        <button
                          type="button"
                          onClick={() => handleActivate(targetApp)}
                          className="w-full py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30 hover:border-transparent transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Activate</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
              const regApp = platformApps.find((p) => p.key.toLowerCase() === app.key.toLowerCase());
              const isComingSoon = meta.availability === 'coming_soon' || regApp?.status === 'coming_soon';
              const isAlreadyActive = app.isActivated && app.status !== 'inactive';

              const allowedPlans = (regApp?.planRequirements || meta.planRequirements || []).map((p: string) => p.toLowerCase());
              const currentPlan = (org?.planKey || 'free_trial').toLowerCase();
              const normalizedPlan = currentPlan === 'free' ? 'free_trial' : currentPlan;
              const meetsPlanRequirements = allowedPlans.length === 0 || allowedPlans.includes(normalizedPlan);
              const isAtFreeTrialAppLimit = atLimit && !isAlreadyActive;
              const isLockedByPlan = !isAlreadyActive && !isComingSoon && (!meetsPlanRequirements || isAtFreeTrialAppLimit);
              const isAvailableOnPlan = !isAlreadyActive && !isComingSoon && !isLockedByPlan;
              const isActivatingThis = activating === app.key;

              const recommendationProfile = getRecommendationsForCategory(
                org?.category || org?.industry || org?.businessType
              );
              const recForThisApp = recommendationProfile?.recommendations.find(
                (r) => r.appKey.toLowerCase() === app.key.toLowerCase()
              );
              const activeAppKeys = apps
                .filter((a) => a.isActivated && a.status !== 'inactive')
                .map((a) => a.key.toLowerCase());
              const contextualTip = getContextualTipForApp(app.key, activeAppKeys);

              return (
                <div
                  key={app.key}
                  className={cn(
                    'relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between',
                    isAlreadyActive
                      ? 'border-indigo-500/30 bg-indigo-500/5 shadow-[0_0_24px_rgba(99,102,241,0.07)]'
                      : isComingSoon
                      ? 'border-white/5 bg-white/[0.02] opacity-75'
                      : isLockedByPlan
                      ? 'border-amber-500/20 bg-amber-500/[0.02]'
                      : 'border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50 hover:bg-emerald-500/[0.06]'
                  )}
                >
                  <div>
                    {/* App header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white/5">{meta.icon}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white">
                              {app.name}
                            </h3>
                            {meta.badge && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {meta.badge}
                              </span>
                            )}
                            {isComingSoon && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> Coming Soon
                              </span>
                            )}
                            {isAvailableOnPlan && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Available on your plan
                              </span>
                            )}
                          </div>
                          <div className="mt-1">{statusBadge(app)}</div>
                        </div>
                      </div>
                      {isLockedByPlan && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold shrink-0">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Requires Standard+</span>
                        </div>
                      )}
                      {isAlreadyActive && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      {meta.description}
                    </p>

                    {/* Contextual Recommendation Rationale or Pairing Tip */}
                    {recForThisApp && !isAlreadyActive && (
                      <div className="mb-3 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#FDB02F] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-semibold text-white">Why recommended: </span>
                          <span className="text-slate-300">{recForThisApp.reason}</span>
                        </div>
                      </div>
                    )}
                    {!recForThisApp && contextualTip && !isAlreadyActive && (
                      <div className="mb-3 p-2 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-slate-300 flex items-start gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-semibold text-white">Smart suggestion: </span>
                          <span className="text-slate-300">{contextualTip}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action button with distinct state styling */}
                  <div className="pt-2">
                    {isComingSoon ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toast.success(
                            `You're on the waitlist for ${app.name}! We'll notify you as soon as it launches.`
                          )
                        }
                        className="w-full text-xs h-8 gap-1.5 border-white/10 text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                      >
                        <Bell className="w-3 h-3 text-slate-400" /> Notify Me / Join Waitlist
                      </Button>
                    ) : isAlreadyActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivate(app)}
                        className="w-full text-xs h-8 gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 cursor-pointer"
                      >
                        Manage Branches <ArrowRight className="w-3 h-3" />
                      </Button>
                    ) : isLockedByPlan ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          toast.info('Redirecting to subscription upgrade...');
                          navigate('/billing');
                        }}
                        className="w-full text-xs h-8 gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                      >
                        <Lock className="w-3 h-3 text-amber-400" /> Upgrade Required
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleActivate(app)}
                        disabled={isActivatingThis}
                        className="w-full text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium border-0 cursor-pointer transition-all shadow-sm"
                      >
                        {isActivatingThis ? (
                          <>
                            <Spinner size="sm" /> Activating…
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3" /> Activate Application
                          </>
                        )}
                      </Button>
                    )}
                  </div>
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
