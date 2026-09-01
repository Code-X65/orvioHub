import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useHost } from '@/host/useHost';
import { getLauncherUrl } from '@/lib/domain';
import { Header } from '@/components/landing/Header';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import {
  Sparkles,
  ArrowRight,
  Layers,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface AppMeta {
  key: string;
  name: string;
  category: string;
  headline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
}

const APPS_META: Record<string, AppMeta> = {
  inventory: {
    key: 'inventory',
    name: 'Inventory Management & POS',
    category: 'Operations & Commerce',
    headline: 'Multi-branch warehouse stock, barcode POS checkout & store registers.',
    description: 'Track real-time stock across branches, manage receipts & purchase orders, run point-of-sale registers, and generate sales telemetry.',
    icon: InventoryIcon,
    features: [
      'Multi-warehouse & store branch support',
      'Barcode scanner & POS terminal checkout',
      'Stock transfers & re-order automation',
    ],
  },
  taskmanagement: {
    key: 'taskmanagement',
    name: 'Task & Sprint Management',
    category: 'Productivity & Engineering',
    headline: 'Agile sprints, interactive kanban boards & team workflows.',
    description: 'Collaborative task execution, backlog refinement, sprint checkpoints, and team workload distribution.',
    icon: Layers,
    features: [
      'Interactive Kanban Boards & Backlogs',
      'Sprint & Milestone Planning',
      'Cross-team Task Assignments & Timelines',
    ],
  },
};

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { currentWorkspace, workspaces, products, fetchWorkspaces, isLoading } = useWorkspaceStore();

  const [hasCheckedAutoSelect, setHasCheckedAutoSelect] = useState(false);

  useEffect(() => {
    if (workspaces.length === 0) {
      fetchWorkspaces().then(() => {
        setHasCheckedAutoSelect(true);
      }).catch(() => {
        setHasCheckedAutoSelect(true);
      });
    } else {
      setHasCheckedAutoSelect(true);
    }
  }, [workspaces.length, fetchWorkspaces]);

  // Compute activated applications for the current workspace
  const activatedApps = useMemo(() => {
    if (!currentWorkspace) return [];

    const activeKeys = new Set<string>();

    // 1. From enabledModules
    if (currentWorkspace.enabledModules && Array.isArray(currentWorkspace.enabledModules)) {
      currentWorkspace.enabledModules.forEach((k: string) => activeKeys.add(k.toLowerCase()));
    }

    // 2. From workspace products list
    if (products) {
      products
        .filter((p) => (p.status || '').toLowerCase() === 'active' || (p.status || '').toLowerCase() === 'trial')
        .forEach((p) => activeKeys.add(p.key.toLowerCase()));
    }

    // 3. Fallback: if user workspace entry has enabledProducts
    const userWsEntry = workspaces.find((w) => w.workspace.id === currentWorkspace.id);
    if (userWsEntry?.enabledProducts) {
      userWsEntry.enabledProducts.forEach((p) => {
        if (p.status === 'active' || p.status === 'trial') {
          activeKeys.add(p.productKey.toLowerCase());
        }
      });
    }

    // Map active keys to AppMeta objects
    return Array.from(activeKeys).map((key) => {
      return (
        APPS_META[key] || {
          key,
          name: key.charAt(0).toUpperCase() + key.slice(1),
          category: 'Platform Application',
          headline: `Manage ${key} operations and workflows.`,
          description: `Connected ${key} management tools for ${currentWorkspace.name}.`,
          icon: Layers,
          features: ['Real-time sync', 'Multi-user access'],
        }
      );
    });
  }, [currentWorkspace, products, workspaces]);

  // Auto-selection rule: If organization has exactly 1 activated application, auto-select it and proceed to branch selection
  if (hasCheckedAutoSelect && activatedApps.length === 1) {
    return <Navigate to={`/branches?app=${activatedApps[0].key}`} replace />;
  }

  // If user has no workspace selected, send back to home
  if (!isLoading && hasCheckedAutoSelect && !currentWorkspace) {
    return <Navigate to="/" replace />;
  }

  if (isLoading && !hasCheckedAutoSelect) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" className="text-[#714b67]" />
          <p className="text-xs text-slate-400">Loading organization applications...</p>
        </div>
      </div>
    );
  }

  const launcherUrl = getLauncherUrl(env);

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8 animate-in fade-in duration-300">
        {/* Header with Organization Switcher */}
        <div className="bg-[#120a11] border border-[#714b67]/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#714b67] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              {currentWorkspace?.name ? currentWorkspace.name.charAt(0).toUpperCase() : 'O'}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#FDB02F] uppercase tracking-wider bg-[#FDB02F]/10 px-2 py-0.5 rounded-full border border-[#FDB02F]/20">
                  Step 2 of 3: Application Selection
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {currentWorkspace?.name || 'Organization'}
              </h2>
              <p className="text-xs text-slate-400">
                Select an activated application to choose your operational branch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WorkspaceSwitcher />
          </div>
        </div>

        {/* Applications Grid */}
        {activatedApps.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#120b10] border border-white/10 space-y-5 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#FDB02F]">
              <Layers className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">No Applications Activated</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-slate-200">{currentWorkspace?.name}</strong> does not have any active application modules yet. Visit the App Launcher to activate Inventory, Task Management, and more.
              </p>
            </div>
            <a
              href={launcherUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Open App Launcher</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activatedApps.map((app) => {
              const IconComp = app.icon;
              return (
                <div
                  key={app.key}
                  onClick={() => navigate(`/branches?app=${app.key}`)}
                  className="group relative p-6 sm:p-7 rounded-2xl border border-white/10 bg-[#120b10] hover:border-[#714b67]/60 hover:shadow-2xl hover:shadow-[#714b67]/15 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 overflow-hidden"
                >
                  {/* Decorative Background Accent */}
                  <div
                    className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 pointer-events-none group-hover:opacity-25 transition-opacity duration-500"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23FDB02F' stroke-width='2'/%3E%3Cpath d='M10 10L30 30M10 30L30 10' stroke='%23714B67' stroke-width='2'/%3E%3C/svg%3E\")",
                      backgroundSize: '40px 40px',
                    }}
                  />

                  <div className="relative z-10 space-y-4">
                    {/* Header: Icon & Category */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F] font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
                        <IconComp className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Active Module
                      </span>
                    </div>

                    {/* App Title & Description */}
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {app.category}
                      </span>
                      <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#f3e1ed] transition-colors">
                        {app.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {app.headline || app.description}
                      </p>
                    </div>

                    {/* Features list */}
                    {app.features && app.features.length > 0 && (
                      <div className="pt-3 border-t border-white/5 space-y-1.5">
                        {app.features.slice(0, 3).map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Proceed to Branch Selection CTA */}
                  <div className="relative z-10 pt-4 border-t border-white/5">
                    <Button
                      type="button"
                      className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs text-xs font-semibold shadow-lg shadow-[#714b67]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <span>Select Branch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Activate More Apps Card */}
            <a
              href={launcherUrl}
              className="p-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[260px] group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Activate More Modules</h3>
                <p className="text-xs text-slate-400">
                  Enable CRM, Gym & Membership, or Bookings in the App Launcher.
                </p>
              </div>
            </a>
          </div>
        )}
      </main>
    </div>
  );
};
