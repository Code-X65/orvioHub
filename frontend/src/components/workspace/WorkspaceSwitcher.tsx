import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useOrganizationEligibility } from '@/hooks/useOrganizationEligibility';
import { OrganizationQuotaIndicator } from '@/components/organization/OrganizationQuotaIndicator';

import {
  ChevronDown,
  Check,
  Plus,
  Search,
  Building2,
  Users,
  Archive,
  Mail,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WorkspaceSwitcherProps {
  productKey?: string;
  className?: string;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  productKey,
  className = '',
}) => {
  const {
    currentWorkspace,
    currentRole,
    workspaces,
    fetchWorkspaces,
    selectWorkspace,
    isSwitching,
  } = useWorkspaceStore();

  const { eligibility, isLimitReached, refreshEligibility } = useOrganizationEligibility();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workspaces.length === 0) {
      fetchWorkspaces(productKey).catch(() => {});
    }
  }, [productKey, fetchWorkspaces, workspaces.length]);

  useEffect(() => {
    if (isOpen) {
      refreshEligibility();
    }
  }, [isOpen, refreshEligibility]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredWorkspaces = workspaces.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.workspace.name.toLowerCase().includes(q) ||
      w.workspace.slug.toLowerCase().includes(q) ||
      w.role.toLowerCase().includes(q)
    );
  });

  const ownedWorkspaces = filteredWorkspaces.filter(
    (w) =>
      (w.role?.toLowerCase() === 'owner' || (w as any).isOwner) &&
      w.workspace.status?.toLowerCase() !== 'archived'
  );

  const joinedWorkspaces = filteredWorkspaces.filter(
    (w) =>
      w.role?.toLowerCase() !== 'owner' &&
      !(w as any).isOwner &&
      w.workspace.status?.toLowerCase() !== 'archived'
  );

  const archivedWorkspaces = filteredWorkspaces.filter(
    (w) => w.workspace.status?.toLowerCase() === 'archived'
  );

  const handleSelect = async (workspaceId: string) => {
    if (workspaceId === currentWorkspace?.id) {
      setIsOpen(false);
      return;
    }
    try {
      await selectWorkspace(workspaceId, productKey);
      setIsOpen(false);
      toast.success('Organization switched successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch organization');
    }
  };

  const renderWorkspaceItem = (w: typeof workspaces[0], isArchived = false) => {
    const isSelected = w.workspace.id === currentWorkspace?.id;
    return (
      <button
        key={w.workspace.id}
        type="button"
        onClick={() => handleSelect(w.workspace.id)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 cursor-pointer rounded-xs',
          isSelected && 'bg-[#714b67]/20',
          isArchived && 'opacity-70'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'w-6 h-6 rounded-xs text-white font-bold text-[10px] flex items-center justify-center shrink-0',
              isArchived ? 'bg-slate-700' : 'bg-[#714b67]'
            )}
          >
            {w.workspace.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className={cn(
                  'font-semibold truncate text-xs',
                  isSelected ? 'text-[#f0d8e8]' : 'text-white'
                )}
              >
                {w.workspace.name}
              </p>
              {isArchived && (
                <span className="px-1 py-0.2 rounded bg-white/10 text-slate-400 text-[9px] font-mono">
                  Archived
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {w.role} • {w.workspace.type || 'Retail'}
            </p>
          </div>
        </div>

        {isSelected && <Check className="w-4 h-4 text-[#f0d8e8] shrink-0" />}
      </button>
    );
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      {/* Switcher Trigger Button - Compact Header Style */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="h-8 flex items-center gap-2 px-2.5 rounded-xs bg-[#0e0a0d] hover:bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#714b67]"
      >
        <div className="w-5 h-5 rounded-xs bg-[#714b67] text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm">
          {currentWorkspace?.name ? currentWorkspace.name.charAt(0).toUpperCase() : 'O'}
        </div>

        <div className="flex items-center gap-1.5 min-w-0 pr-0.5">
          <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[160px]">
            {currentWorkspace?.name || 'Organization'}
          </span>
          <span className="text-[10px] font-mono text-slate-400 uppercase hidden md:inline">
            • {currentRole || 'OWNER'}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {/* Header Quota Indicator */}
          <div className="p-2.5 border-b border-white/10 bg-[#080608]">
            <OrganizationQuotaIndicator eligibility={eligibility} variant="compact" />
          </div>

          {/* Search Box */}
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#080608] border border-white/10 rounded-xs pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#714b67]"
                autoFocus
              />
            </div>
          </div>

          {/* Categorized List of Workspaces */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-3 divide-y divide-white/5">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No organizations found
              </div>
            ) : (
              <>
                {/* Owned by you */}
                {ownedWorkspaces.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 pt-1 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-[#f0d8e8]" />
                        Owned by you ({ownedWorkspaces.length})
                      </span>
                    </div>
                    {ownedWorkspaces.map((w) => renderWorkspaceItem(w, false))}
                  </div>
                )}

                {/* Organizations you joined */}
                {joinedWorkspaces.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <div className="px-2 pt-1 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-sky-400" />
                        Joined Organizations ({joinedWorkspaces.length})
                      </span>
                    </div>
                    {joinedWorkspaces.map((w) => renderWorkspaceItem(w, false))}
                  </div>
                )}

                {/* Archived Organizations */}
                {archivedWorkspaces.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <div className="px-2 pt-1 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-500 uppercase font-mono">
                      <span className="flex items-center gap-1.5">
                        <Archive className="w-3 h-3" />
                        Archived ({archivedWorkspaces.length})
                      </span>
                    </div>
                    {archivedWorkspaces.map((w) => renderWorkspaceItem(w, true))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Limit Reached Warning / Actions */}
          <div className="p-2.5 border-t border-white/10 bg-[#080608] space-y-2">
            {isLimitReached ? (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-tight space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <Lock className="w-3 h-3" />
                  <span>Ownership limit reached ({eligibility.currentOwned}/{eligibility.maximumOwned})</span>
                </div>
                <p className="text-[10px] text-slate-300">
                  You can still join other organizations by accepting invitations.
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              {isLimitReached ? (
                <button
                  type="button"
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 px-2.5 py-1.5 text-xs text-slate-500 bg-white/5 rounded-xs border border-white/5 cursor-not-allowed"
                  title="You have reached the maximum limit of 3 owned organizations."
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Create Limit Reached</span>
                </button>
              ) : (
                <a
                  href={`/workspaces/new?product=${productKey || 'inventory'}`}
                  className="flex-1 flex items-center justify-center gap-2 px-2.5 py-1.5 text-xs text-white bg-[#714b67] hover:bg-[#85597a] rounded-xs transition-colors cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Organization</span>
                </a>
              )}

              <a
                href="/invitations"
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xs border border-white/10 transition-colors"
                title="View invitations & joined teams"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Invitations</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
