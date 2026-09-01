import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { useHost } from '@/host/useHost';
import { getCrossSubdomainUrl, type ApplicationKey } from '@/lib/domain';
import { Header } from '@/components/landing/Header';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import {
  Warehouse,
  Plus,
  ArrowRight,
  MapPin,
  Phone,
  CheckCircle2,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const APP_NAMES: Record<string, string> = {
  inventory: 'Inventory & POS',
  taskmanagement: 'Task & Workflow Management',
  crm: 'CRM & Client Pipeline',
  gym: 'Gym & Membership',
  booking: 'Appointments & Scheduling',
};

export const BranchesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const host = useHost();
  const env = host.environment;

  const appKey = (searchParams.get('app') || 'inventory').toLowerCase();
  const appDisplayName = APP_NAMES[appKey] || (appKey.charAt(0).toUpperCase() + appKey.slice(1));

  const { currentWorkspace, workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { branches, activeBranch, setActiveBranch, loadBranches, isLoading } = useBranchStore();

  const [hasCheckedAutoSelect, setHasCheckedAutoSelect] = useState(false);
  const [isAppDropdownOpen, setIsAppDropdownOpen] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  useEffect(() => {
    if (workspaces.length === 0) {
      fetchWorkspaces().catch(() => {});
    }
  }, [workspaces.length, fetchWorkspaces]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadBranches(currentWorkspace.id, appKey)
        .then(() => {
          setHasCheckedAutoSelect(true);
        })
        .catch(() => {
          setHasCheckedAutoSelect(true);
        });
    }
  }, [currentWorkspace?.id, appKey, loadBranches]);

  const handleSelectBranch = (branch: Branch) => {
    setActiveBranch(branch);
    const branchId = branch.id || branch._id || '';
    const targetUrl = getCrossSubdomainUrl(
      appKey as ApplicationKey,
      `/dashboard?branch=${encodeURIComponent(branchId)}`,
      true,
      env
    );
    window.location.href = targetUrl;
  };

  // Auto-selection rule: If organization has exactly 1 branch, auto-select it and navigate to application
  if (hasCheckedAutoSelect && branches.length === 1) {
    const singleBranch = branches[0];
    const branchId = singleBranch.id || singleBranch._id || '';
    const targetUrl = getCrossSubdomainUrl(
      appKey as ApplicationKey,
      `/dashboard?branch=${encodeURIComponent(branchId)}`,
      true,
      env
    );
    window.location.replace(targetUrl);
    return null;
  }

  // If no workspace is selected, redirect to root organization selector
  if (!currentWorkspace && !isLoading) {
    return <Navigate to="/" replace />;
  }

  if (isLoading && !hasCheckedAutoSelect) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" className="text-[#714b67]" />
          <p className="text-xs text-slate-400">Loading branch locations...</p>
        </div>
      </div>
    );
  }

  const enabledApps = currentWorkspace?.enabledModules || ['inventory'];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8 animate-in fade-in duration-300">
        {/* Header with Breadcrumb & Dual Switchers */}
        <div className="bg-[#120a11] border border-[#714b67]/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{currentWorkspace?.name}</span>
              <span>→</span>
              <span className="font-bold text-[#FDB02F]">{appDisplayName}</span>
              <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 ml-1">
                Step 3 of 3: Branch Selection
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Select Branch Location
            </h1>
            <p className="text-xs text-slate-400">
              Choose the physical store, warehouse, or outlet you are operating today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Application Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAppDropdownOpen(!isAppDropdownOpen)}
                className="h-8 px-3 rounded-xs bg-[#0e0a0d] hover:bg-white/5 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>{appDisplayName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isAppDropdownOpen && (
                <div className="absolute right-0 top-10 w-52 bg-[#120b10] border border-white/15 rounded-xl shadow-2xl p-1 z-30 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Switch Application
                  </div>
                  {enabledApps.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setIsAppDropdownOpen(false);
                        navigate(`/branches?app=${k}`);
                      }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-xs text-xs font-medium flex items-center justify-between cursor-pointer transition-colors',
                        k.toLowerCase() === appKey
                          ? 'bg-[#714b67] text-white font-semibold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span>{APP_NAMES[k.toLowerCase()] || k}</span>
                      {k.toLowerCase() === appKey && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Organization Switcher Dropdown */}
            <WorkspaceSwitcher />
          </div>
        </div>

        {/* Branches Grid */}
        {branches.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#120b10] border border-white/10 space-y-5 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#FDB02F]">
              <Warehouse className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">No Branches Configured</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-slate-200">{currentWorkspace?.name}</strong> does not have any physical branches registered yet. Add your main store or warehouse to begin operations.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setIsCreatingBranch(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Primary Branch</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((branch) => {
              const branchId = branch.id || branch._id || '';
              const isSelected = (activeBranch?.id || activeBranch?._id) === branchId;
              const locationStr = [branch.street, branch.city, branch.state].filter(Boolean).join(', ') || branch.address;

              return (
                <div
                  key={branchId}
                  onClick={() => handleSelectBranch(branch)}
                  className={cn(
                    'group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 overflow-hidden',
                    isSelected
                      ? 'bg-gradient-to-br from-[#241321] via-[#140b12] to-black border-[#714b67] shadow-xl shadow-[#714b67]/15 ring-1 ring-[#714b67]'
                      : 'bg-[#120b10] border-white/10 hover:border-[#714b67]/60 hover:shadow-xl hover:-translate-y-1'
                  )}
                >
                  <div className="space-y-4">
                    {/* Header: Branch Icon & Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F] font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
                        <Warehouse className="w-6 h-6" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {branch.code && (
                          <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-white/5 text-slate-300 border border-white/10">
                            {branch.code}
                          </span>
                        )}
                        {branch.isPrimary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Branch Title & Details */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-[#f3e1ed] transition-colors">
                        {branch.name}
                      </h3>
                      {locationStr && (
                        <p className="text-xs text-slate-400 mt-1 flex items-start gap-1.5 line-clamp-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span>{locationStr}</span>
                        </p>
                      )}
                    </div>

                    {/* Contact Info */}
                    {branch.phone && (
                      <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Enter Branch CTA */}
                  <div className="pt-4 border-t border-white/5">
                    <Button
                      type="button"
                      className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs text-xs font-semibold shadow-lg shadow-[#714b67]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <span>Enter {appDisplayName}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Add New Branch Card */}
            <div
              onClick={() => setIsCreatingBranch(true)}
              className="p-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[220px] group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Add New Branch</h3>
                <p className="text-xs text-slate-400">
                  Register another physical retail store or fulfillment outlet.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Branch Creation Modal */}
      {isCreatingBranch && currentWorkspace?.id && (
        <BranchCreationModal
          isOpen={isCreatingBranch}
          workspaceId={currentWorkspace.id}
          onClose={() => setIsCreatingBranch(false)}
          onSuccess={() => {
            setIsCreatingBranch(false);
            if (currentWorkspace?.id) {
              loadBranches(currentWorkspace.id, appKey);
            }
          }}
        />
      )}
    </div>
  );
};
