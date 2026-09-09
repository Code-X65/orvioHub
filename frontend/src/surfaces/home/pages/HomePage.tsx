import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { Spinner } from '@/components/ui/spinner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { UserPlanBadge } from '@/components/profile/UserPlanBadge';
import { PendingInvitesBanner } from '@/components/notifications/PendingInvitesBanner';
import {
  Building2,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  Store,
  Zap,
  Users,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { api } from '@/lib/api';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspaces, currentWorkspace, fetchWorkspaces, selectWorkspace, isLoading, isSwitching } = useWorkspaceStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const [myOrgs, setMyOrgs] = useState<any[]>([]);
  const [upgradeModalWs, setUpgradeModalWs] = useState<{ id: string; name: string; planKey: string; slug?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchWorkspaces().catch(() => []),
      api.get<any[]>('/organizations/my-organizations').catch(() => []),
    ])
      .then(([_, orgs]) => {
        if (isMounted) {
          if (Array.isArray(orgs)) {
            setMyOrgs(orgs);
          }
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, [fetchWorkspaces]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    try {
      await selectWorkspace(workspaceId);
      navigate('/applications');
    } catch {
      navigate('/applications');
    }
  };

  const handleActivateInventory = (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    try {
      localStorage.setItem('orvio_active_workspace_id', workspaceId);
      selectWorkspace(workspaceId).catch(() => {});
    } catch {}
    window.location.href = getCrossSubdomainUrl('inventory', `/onboard/activate?org=${workspaceId}`);
  };

  const handleOpenInventory = (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    try {
      localStorage.setItem('orvio_active_workspace_id', workspaceId);
      selectWorkspace(workspaceId).catch(() => {});
    } catch {}
    window.location.href = getCrossSubdomainUrl('inventory', `/dashboard?org=${workspaceId}`);
  };

  if (!isLoaded || isLoading || isSwitching) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" className="text-[#714b67]" />
          <p className="text-xs text-slate-400">Loading your organizations...</p>
        </div>
      </div>
    );
  }

  const launcherNewOrgUrl = '/onboard/organization';

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-300">
        {/* User Welcome & Subtitle */}
        <div className="space-y-2 pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personal Dashboard</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <UserPlanBadge planKey={user?.planKey} size="sm" />
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            {workspaces.length === 0
              ? 'Your personal Orviohub account is active. You can create your own business or join an organization via invitation.'
              : 'Select an organization to access its connected applications and operational branches.'}
          </p>
        </div>

        {/* Real-time In-Dashboard Pending Invitations */}
        <PendingInvitesBanner />

        {/* Organizations Grid or Personal Zero-State */}
        {workspaces.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Card 1: Create Organization */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-[#1d101b] via-[#120b10] to-black border border-[#714b67]/40 shadow-xl shadow-[#714b67]/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#714b67]/25 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] shadow-md">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-white tracking-tight">Create your first business</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Set up your business name, currency, branches, and start managing inventory, POS checkouts, and staff with a 30-day Free Trial or Standard Plan.
                  </p>
                </div>
              </div>
              <a
                href={launcherNewOrgUrl}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30 transition-all hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Business & Continue</span>
              </a>
            </div>

            {/* Card 2: Join via Invitation */}
            <div className="p-8 rounded-2xl bg-[#120b10] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 shadow-md">
                  <Users className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-white tracking-tight">Joining an existing business?</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    If your employer, partner, or business associate invited you, click the invitation link in your email to accept and immediately access their workspace.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400 leading-relaxed">
                💡 <span className="text-slate-300 font-semibold">Note:</span> Your account is already verified. Any invitation sent to <span className="text-white font-medium">{user?.email || 'your email'}</span> can be accepted in one click.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map(({ workspace, role, enabledProducts }) => {
              const planKey = (workspace.planId || workspace.type || 'free').toLowerCase();
              const planDisplay = planKey.toUpperCase();
              const isSelected = currentWorkspace?.id === workspace.id;

              const orgDetail = myOrgs.find(
                (o) =>
                  o.organization?._id === workspace.id ||
                  o.organization?._id === (workspace as any).organizationId
              );

              const isInventoryActive = orgDetail
                ? orgDetail.inventoryActive
                : enabledProducts?.some(
                    (p) => p.productKey === 'inventory' && p.status === 'active'
                  ) ?? false;
              const hasActiveApps = orgDetail
                ? orgDetail.hasActiveApps
                : (enabledProducts && enabledProducts.length > 0);

              return (
                <div
                  key={workspace.id}
                  onClick={() => handleSelectWorkspace(workspace.id)}
                  className={cn(
                    'group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 overflow-hidden',
                    isSelected
                      ? 'bg-gradient-to-br from-[#241321] via-[#140b12] to-black border-[#714b67] shadow-xl shadow-[#714b67]/15 ring-1 ring-[#714b67]'
                      : 'bg-[#120b10] border-white/10 hover:border-[#714b67]/60 hover:shadow-xl hover:-translate-y-1'
                  )}
                >
                  <div className="space-y-4">
                    {/* Header: Icon & Plan Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
                        {workspace.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isInventoryActive ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                            Inventory Active
                          </span>
                        ) : !hasActiveApps ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider border bg-white/5 text-slate-400 border-white/10">
                            No applications activated
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border',
                              planKey === 'premium'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : planKey === 'standard'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : 'bg-white/10 text-slate-300 border-white/20'
                            )}
                          >
                            {planDisplay} PLAN
                          </span>
                        )}

                        {isInventoryActive && planKey !== 'premium' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUpgradeModalWs({
                                id: workspace.id,
                                name: workspace.name,
                                planKey,
                                slug: workspace.slug,
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#714b67] hover:bg-[#86597a] text-white transition-colors cursor-pointer shadow-sm"
                          >
                            <Zap className="w-3 h-3 text-amber-300" />
                            <span>Upgrade</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Org Name & Details */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-[#f3e1ed] transition-colors">
                        {workspace.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <span>Role: <strong className="text-slate-200 uppercase">{role}</strong></span>
                        {workspace.country && <span>• {workspace.country}</span>}
                      </p>
                    </div>

                    {/* Modules counter */}
                    <div className="pt-3 border-t border-white/5 flex items-center gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#FDB02F]" />
                        <span>{orgDetail ? orgDetail.activeAppsCount : (enabledProducts?.length || 0)} Apps</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{orgDetail ? `${orgDetail.branchCount} Branches` : 'Multi-Branch'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Enter Org & Action CTA Button */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    {isInventoryActive ? (
                      <button
                        type="button"
                        onClick={(e) => handleOpenInventory(e, workspace.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-md shadow-[#714b67]/20 transition-all hover:scale-[1.02] cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Open Inventory</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleActivateInventory(e, workspace.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#714b67] to-[#86597a] hover:from-[#86597a] hover:to-[#9c688e] text-white text-xs font-bold shadow-md shadow-[#714b67]/25 transition-all hover:scale-[1.02] cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
                        <span>Activate Inventory</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
                      <span>Applications</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Create New Organization Card */}
            <a
              href={launcherNewOrgUrl}
              className="p-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[220px] group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Create New Organization</h3>
                <p className="text-xs text-slate-400">
                  Register a new business workspace and choose a subscription plan.
                </p>
              </div>
            </a>
          </div>
        )}
      </main>

      {/* Upgrade Modal */}
      {upgradeModalWs && (
        <UpgradeModal
          isOpen={!!upgradeModalWs}
          workspaceId={upgradeModalWs.id}
          workspaceSlug={upgradeModalWs.slug}
          currentPlanKey={upgradeModalWs.planKey}
          onClose={() => setUpgradeModalWs(null)}
          onSuccess={() => {
            setUpgradeModalWs(null);
            fetchWorkspaces();
          }}
        />
      )}
    </div>
  );
};
