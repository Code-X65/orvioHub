import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useHost } from '@/host/useHost';
import { getLauncherUrl } from '@orviohub/shared';
import { Header } from '@/components/landing/Header';
import { Spinner } from '@/components/ui/spinner';
import {
  Building2,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { user } = useAuthStore();
  const { workspaces, currentWorkspace, fetchWorkspaces, selectWorkspace, isLoading } = useWorkspaceStore();

  const [hasCheckedAutoSelect, setHasCheckedAutoSelect] = useState(false);

  useEffect(() => {
    fetchWorkspaces().then(() => {
      setHasCheckedAutoSelect(true);
    }).catch(() => {
      setHasCheckedAutoSelect(true);
    });
  }, [fetchWorkspaces]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    try {
      await selectWorkspace(workspaceId);
      navigate('/applications');
    } catch {
      navigate('/applications');
    }
  };

  // Auto-selection rule: If user belongs to exactly 1 organization, auto-select and proceed
  if (hasCheckedAutoSelect && workspaces.length === 1) {
    const singleWs = workspaces[0].workspace;
    if (!currentWorkspace || currentWorkspace.id !== singleWs.id) {
      selectWorkspace(singleWs.id);
    }
    return <Navigate to="/applications" replace />;
  }

  if (isLoading && !hasCheckedAutoSelect) {
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

  const launcherNewOrgUrl = `${getLauncherUrl(env)}/workspaces/new`;

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-300">
        {/* User Welcome & Subtitle */}
        <div className="space-y-2 pb-6 border-b border-white/5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Tenant Enterprise Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Select an organization to access its connected applications and operational branches.
          </p>
        </div>

        {/* Organizations Grid */}
        {workspaces.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#120b10] border border-white/10 space-y-5 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#FDB02F]">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">No Organizations Found</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                You do not have any registered organizations yet. Create an organization to start managing inventory, tasks, and branch operations.
              </p>
            </div>
            <a
              href={launcherNewOrgUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Organization</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map(({ workspace, role, enabledProducts }) => {
              const plan = (workspace.type || 'free').toUpperCase();
              const isSelected = currentWorkspace?.id === workspace.id;

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
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#714b67]/20 text-[#f3e1ed] border border-[#714b67]/40">
                        {plan} PLAN
                      </span>
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
                        <span>{enabledProducts?.length || 0} Apps</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Multi-Branch</span>
                      </div>
                    </div>
                  </div>

                  {/* Enter Org CTA Button */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-[#f3e1ed] group-hover:text-white">
                    <span>View Applications</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
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
    </div>
  );
};
