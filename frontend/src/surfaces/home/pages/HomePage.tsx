import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { Spinner } from '@/components/ui/spinner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { PendingInvitesBanner } from '@/components/notifications/PendingInvitesBanner';
import {
  Building2,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspaces, currentWorkspace, fetchWorkspaces, selectWorkspace, isLoading, isSwitching } = useWorkspaceStore();

  const [isLoaded, setIsLoaded] = useState(workspaces.length > 0);
  const [upgradeModalWs, setUpgradeModalWs] = useState<{ id: string; name: string; planKey: string; slug?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchWorkspaces(undefined, undefined, true).catch(() => []),
      api.get<any>('/organizations/my-organizations').catch(() => []),
    ])
      .then(() => {
        if (isMounted) {
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

  const handleSelectWorkspace = async (workspaceId: string, targetPath = '/applications') => {
    try {
      localStorage.setItem('orvio_active_workspace_id', workspaceId);
      await selectWorkspace(workspaceId);
      navigate(targetPath);
    } catch {
      navigate(targetPath);
    }
  };

  if (!isLoaded && workspaces.length === 0 && (isLoading || isSwitching)) {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workspaces.map(({ workspace }) => {
              const sub = workspace.subscription;
              const rawPlan = (
                workspace.planName ||
                workspace.planKey ||
                workspace.planId ||
                sub?.activePlan ||
                sub?.selectedPlan ||
                (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
                sub?.planKey ||
                ''
              ).toLowerCase();
              const isTrial = !rawPlan || rawPlan === 'free' || rawPlan === 'free_trial' || rawPlan === 'trial' || rawPlan.includes('free');
              const tierText = isTrial
                ? 'Free 30-Day Plan'
                : rawPlan.includes('premium')
                ? 'Premium Plan'
                : 'Standard Plan';

              const rawStatus = workspace.status || 'Active';
              const statusText = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
              const isSelected = currentWorkspace?.id === workspace.id;

              return (
                <div
                  key={workspace.id}
                  onClick={() => handleSelectWorkspace(workspace.id)}
                  className={cn(
                    'group p-3.5 rounded-sm bg-transparent hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center justify-between gap-3',
                    isSelected && 'bg-white/[0.05]'
                  )}
                >
                  {/* i. Logo or First Alphabet & Name + Tier */}
                  <div className="flex items-center gap-3 min-w-0">
                    {workspace.logoUrl ? (
                      <img
                        src={workspace.logoUrl}
                        alt={workspace.name}
                        className="w-9 h-9 rounded-sm object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-sm bg-[#714b67] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {workspace.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      {/* i. Organization Name */}
                      <h3 className="text-sm font-semibold text-white group-hover:text-[#f3e1ed] transition-colors truncate">
                        {workspace.name}
                      </h3>
                      {/* iv. Tier */}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tierText}
                      </p>
                    </div>
                  </div>

                  {/* iii. Organization Status & Solid Open Button */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        rawStatus.toLowerCase() === 'active' ? 'text-emerald-400' : 'text-slate-400'
                      )}
                    >
                      {statusText}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWorkspace(workspace.id);
                      }}
                      className="px-3 py-1 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Create New Organization Card */}
            <a
              href={launcherNewOrgUrl}
              className="p-3.5 rounded-sm bg-transparent hover:bg-white/[0.04] transition-colors flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-sm bg-white/10 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Create New Organization</h3>
                <p className="text-xs text-slate-400">Add another business</p>
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
