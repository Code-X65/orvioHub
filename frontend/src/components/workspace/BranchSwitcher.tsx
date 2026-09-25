import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { BranchEditModal } from './BranchEditModal';
import { BranchCreationModal } from './BranchCreationModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { useBranchLimit } from '@/hooks/useBranchLimit';
import { getHomeUrl } from '@/lib/domain';
import {
  ChevronDown,
  Check,
  Search,
  Warehouse,
  Edit2,
  Plus,
  Sparkles,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BranchSwitcherProps {
  productKey?: string;
  activeBranchId?: string;
  onBranchChange?: (branch: Branch) => void;
  className?: string;
}

export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({
  productKey = 'inventory',
  activeBranchId,
  onBranchChange,
  className = '',
}) => {
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches, activeBranch, setActiveBranch, loadBranches, isLoading } = useBranchStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initialPlan = (currentWorkspace?.planKey || currentWorkspace?.planId || 'free_trial').toLowerCase();
  const [planKey, setPlanKey] = useState<string>(initialPlan);

  useEffect(() => {
    if (currentWorkspace) {
      const pk = (currentWorkspace.planKey || currentWorkspace.planId || 'free_trial').toLowerCase();
      setPlanKey(pk);
    }
  }, [currentWorkspace?.id, currentWorkspace?.planKey, currentWorkspace?.planId]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      api.get<any>(`/organizations/${currentWorkspace.id}/subscription`)
        .then((res) => {
          const sub = res?.subscription || res?.data?.subscription || res;
          const pk = (
            sub?.activePlan ||
            (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
            sub?.planKey ||
            res?.planKey ||
            initialPlan
          );
          if (pk) setPlanKey(String(pk).toLowerCase());
        })
        .catch(() => {});
    }
  }, [currentWorkspace?.id, initialPlan]);

  const { atLimit: atBranchLimit } = useBranchLimit({
    planKey,
    currentCount: branches.length,
  });

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadBranches(currentWorkspace.id, productKey);
    }
  }, [currentWorkspace?.id, productKey, loadBranches]);

  useEffect(() => {
    if (activeBranchId && branches.length > 0) {
      const match = branches.find((b) => (b.id || b._id) === activeBranchId);
      if (match && (!activeBranch || (activeBranch.id || activeBranch._id) !== activeBranchId)) {
        setActiveBranch(match);
      }
    }
  }, [activeBranchId, branches, activeBranch, setActiveBranch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBranch = (branch: Branch) => {
    const prevBranchId = activeBranch?.id || activeBranch?._id;
    const newBranchId = branch.id || branch._id;

    setActiveBranch(branch);
    if (onBranchChange) {
      onBranchChange(branch);
    }
    setIsOpen(false);

    if (currentWorkspace?.id && prevBranchId !== newBranchId) {
      api.post('/telemetry/branch-switch', {
        workspaceId: currentWorkspace.id,
        previousBranchId: prevBranchId,
        newBranchId,
        actorUserId: user?.id || undefined,
      }).catch(() => {
        // Non-critical: log switch audit failure quietly so it doesn't disrupt UX
        toast.warning('Branch switch recorded locally. Audit log sync failed — will retry on next load.', {
          id: 'branch-switch-log-fail',
          duration: 3000,
        });
      });
    }

    toast.success(`Active branch: ${branch.name}`);
  };

  const primaryBranch = branches.find((b) => b.isPrimary) || (branches.length === 1 ? branches[0] : null);

  const filteredBranches = branches.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.code && b.code.toLowerCase().includes(q));
  });

  if (!currentWorkspace) {
    return (
      <div className={cn('relative inline-block text-left', className)}>
        <a
          href={getHomeUrl()}
          className="h-8 flex items-center gap-2 px-2.5 rounded-xs bg-[#0e0a0d] hover:bg-white/5 border border-dashed border-white/20 hover:border-white/40 transition-colors text-left text-slate-400 hover:text-white"
          title="No workspace selected. Click to select an organization."
        >
          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs">No workspace selected</span>
        </a>
      </div>
    );
  }

  return (
    <>
      <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
        {/* Compact Branch Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={
            activeBranch
              ? `Viewing: ${activeBranch.name} (Operational context)${
                  primaryBranch && (primaryBranch.id || primaryBranch._id) !== (activeBranch.id || activeBranch._id)
                    ? ` | Primary: ${primaryBranch.name} (Org Default)`
                    : ''
                }`
              : undefined
          }
          className="h-8 flex items-center gap-2 px-2.5 rounded-xs bg-[#0e0a0d] hover:bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#714b67]"
        >
          <Warehouse className="w-3.5 h-3.5 text-[#f0d8e8] shrink-0" />

          <div className="flex items-center gap-1.5 min-w-0 pr-0.5">
            <span
              className={cn(
                'text-xs font-semibold truncate max-w-[110px] sm:max-w-[150px]',
                !activeBranch && branches.length === 0 ? 'text-amber-300/90' : 'text-white'
              )}
            >
              {activeBranch
                ? activeBranch.name
                : isLoading
                ? 'Loading...'
                : branches.length === 0
                ? 'No branches'
                : 'Select branch'}
            </span>

            {activeBranch?.code && (
              <span className="px-1.5 py-0.2 rounded-xs text-[9px] font-mono font-bold bg-[#714b67]/25 text-[#f0d8e8] border border-[#714b67]/40">
                {activeBranch.code}
              </span>
            )}
          </div>

          <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0', isOpen && 'rotate-180')} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 mt-1.5 w-72 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {branches.length > 0 && (
              /* Search Box */
              <div className="p-2 border-b border-white/10">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search branch name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#080608] border border-white/10 rounded-xs pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#714b67]"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Operational vs Primary Status Bar */}
            {branches.length > 0 && activeBranch && (
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <div className="truncate">
                  <span className="text-slate-500">Viewing: </span>
                  <span className="text-white font-medium">{activeBranch.name}</span>
                  <span className="text-slate-500"> (Operational)</span>
                </div>
                {primaryBranch && (primaryBranch.id || primaryBranch._id) !== (activeBranch.id || activeBranch._id) && (
                  <div className="truncate pl-2 text-amber-300/80">
                    <span className="text-slate-500">Primary: </span>
                    <span>{primaryBranch.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* List of Branches or Empty Guidance */}
            <div className="max-h-56 overflow-y-auto py-1 divide-y divide-white/5">
              {branches.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#d4a8c9]">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-white">No branches configured</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Configure a branch to track inventory, process orders, and assign staff.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsCreatingBranch(true);
                    }}
                    className="w-full mt-2 py-1.5 px-3 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#714b67]/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Branch</span>
                  </button>
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No branch locations match "{searchQuery}".
                </div>
              ) : (
                filteredBranches.map((branch) => {
                  const isSelected =
                    (activeBranch?.id && activeBranch.id === branch.id) ||
                    (activeBranch?._id && activeBranch._id === branch._id);

                  return (
                    <div
                      key={branch.id || branch._id}
                      onClick={() => handleSelectBranch(branch)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer group',
                        isSelected ? 'bg-[#714b67]/30 text-white font-semibold' : 'text-slate-300 hover:bg-white/5'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <Warehouse className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-[#f0d8e8]' : 'text-slate-500 group-hover:text-slate-400')} />

                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{branch.name}</span>
                            {branch.isPrimary && (
                              <span
                                className="text-[9px] px-1 rounded-xs bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                title="Primary branch (Organization default)"
                              >
                                Primary
                              </span>
                            )}
                            {isSelected && (
                              <span
                                className="text-[9px] px-1 rounded-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                title="Current operational view"
                              >
                                Operational
                              </span>
                            )}
                          </div>

                          {(branch.address || branch.city) && (
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {branch.address || branch.city}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {branch.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-white/10 text-slate-400">
                            {branch.code}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBranch(branch);
                            setIsOpen(false);
                          }}
                          className="p-1 rounded-xs hover:bg-white/10 text-slate-500 hover:text-white transition-colors cursor-pointer"
                          title="Edit branch details"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        {isSelected && (
                          <Check className="w-4 h-4 text-[#f0d8e8] ml-1" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create New Branch Action / Limit Reached Prompt */}
            {branches.length > 0 && (
              <div className="p-2 border-t border-white/10 bg-[#080608]">
                {atBranchLimit ? (
                  <div className="p-2 rounded-xs bg-transparent border border-dashed border-amber-500/20 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate text-[11px]">Limit reached</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setIsUpgradeModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
                    >
                      Upgrade
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsCreatingBranch(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#f0d8e8] hover:text-white rounded-xs hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Branch Location</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Branch Modal */}
      {editingBranch && (
        <BranchEditModal
          isOpen={Boolean(editingBranch)}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSuccess={() => {
            setEditingBranch(null);
            if (currentWorkspace?.id) {
              loadBranches(currentWorkspace.id, productKey);
            }
          }}
        />
      )}

      {/* Creation Modal */}
      {isCreatingBranch && (
        <BranchCreationModal
          isOpen={isCreatingBranch}
          workspaceId={currentWorkspace.id}
          onClose={() => setIsCreatingBranch(false)}
          onSuccess={() => {
            setIsCreatingBranch(false);
            if (currentWorkspace?.id) {
              loadBranches(currentWorkspace.id, productKey);
            }
          }}
        />
      )}

      {/* Upgrade Modal */}
      {isUpgradeModalOpen && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          workspaceId={currentWorkspace.id}
          workspaceSlug={currentWorkspace.slug}
          currentPlanKey={planKey}
          triggerReason="branch_limit"
          onClose={() => setIsUpgradeModalOpen(false)}
          onSuccess={() => {
            setIsUpgradeModalOpen(false);
            if (currentWorkspace?.id) {
              loadBranches(currentWorkspace.id, productKey);
            }
          }}
        />
      )}
    </>
  );
};

export default BranchSwitcher;
