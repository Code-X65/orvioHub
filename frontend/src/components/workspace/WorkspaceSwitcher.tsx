import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useHost } from '@/host/useHost';
import { getLauncherUrl } from '@orviohub/shared';
import {
  ChevronDown,
  Check,
  Plus,
  Search,
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
  const host = useHost();
  const env = host.environment;
  const launcherUrl = getLauncherUrl(env);

  const {
    currentWorkspace,
    currentRole,
    workspaces,
    fetchWorkspaces,
    selectWorkspace,
    isSwitching,
  } = useWorkspaceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkspaces(productKey).catch(() => {});
  }, [productKey, fetchWorkspaces]);

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

        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
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

          {/* List of Workspaces */}
          <div className="max-h-56 overflow-y-auto py-1 divide-y divide-white/5">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No organizations found
              </div>
            ) : (
              filteredWorkspaces.map((w) => {
                const isSelected = w.workspace.id === currentWorkspace?.id;
                return (
                  <button
                    key={w.workspace.id}
                    type="button"
                    onClick={() => handleSelect(w.workspace.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 cursor-pointer',
                      isSelected && 'bg-[#714b67]/20'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-xs bg-[#714b67] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {w.workspace.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={cn('font-semibold truncate text-xs', isSelected ? 'text-[#f0d8e8]' : 'text-white')}>
                          {w.workspace.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">
                          {w.role} • {w.workspace.type || 'Retail'}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#f0d8e8] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Create New Org Action */}
          <div className="p-2 border-t border-white/10 bg-[#080608]">
            <a
              href={`${launcherUrl}/workspaces/new?product=${productKey || 'inventory'}`}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#f0d8e8] hover:text-white rounded-xs hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Organization</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
