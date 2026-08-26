import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  ChevronDown,
  Check,
  Plus,
  Search,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceSwitcherProps {
  productKey?: string;
  className?: string;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  productKey,
  className = '',
}) => {
  const navigate = useNavigate();
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
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-sm bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all text-left group shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
          {currentWorkspace?.name ? currentWorkspace.name.charAt(0).toUpperCase() : 'O'}
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[180px]">
            {currentWorkspace?.name || 'Select Organization'}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="capitalize">{currentWorkspace?.type || 'Organization'}</span>
            <span>•</span>
            <span className="uppercase text-[9px] font-mono text-indigo-400 font-medium">
              {currentRole || 'Member'}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : 'group-hover:text-slate-200'
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl backdrop-blur-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-sm text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </div>

          {/* Organizations List */}
          <div className="max-h-64 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/40">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-6 text-center text-slate-500 space-y-1">
                <p className="text-xs">No organizations found</p>
                {searchQuery && (
                  <p className="text-[11px] text-slate-600">Try refining your search</p>
                )}
              </div>
            ) : (
              filteredWorkspaces.map((item) => {
                const isCurrent = item.workspace.id === currentWorkspace?.id;
                const isSuspended =
                  item.workspace.status === 'suspended' || item.workspace.status === 'SUSPENDED';

                return (
                  <button
                    key={item.workspace.id}
                    type="button"
                    onClick={() => handleSelect(item.workspace.id)}
                    disabled={isSuspended || isSwitching}
                    className={`w-full text-left p-2.5 rounded-sm flex items-center justify-between transition-all group ${
                      isCurrent
                        ? 'bg-indigo-950/40 border border-indigo-500/30 text-white'
                        : isSuspended
                        ? 'opacity-50 cursor-not-allowed bg-transparent'
                        : 'hover:bg-slate-800/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 group-hover:text-white'
                        }`}
                      >
                        {item.workspace.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-white truncate">
                            {item.workspace.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                              Active
                            </span>
                          )}
                          {isSuspended && (
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30 flex items-center gap-0.5">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              Suspended
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="capitalize">{item.workspace.type || 'Business'}</span>
                          <span>•</span>
                          <span className="uppercase text-[9px] font-mono text-slate-400">
                            {item.role}
                          </span>
                          {item.enabledProducts?.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 truncate">
                                {item.enabledProducts.map((p) => p.productKey).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isCurrent && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Footer Quick Actions */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/workspaces/new');
              }}
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create organization</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/workspaces');
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span>View all</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
