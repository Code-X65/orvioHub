import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { BranchEditModal } from './BranchEditModal';
import { BranchCreationModal } from './BranchCreationModal';
import {
  ChevronDown,
  Check,
  Search,
  Warehouse,
  AlertTriangle,
  Edit2,
  Building2,
  PlusCircle,
} from 'lucide-react';
import { toast } from 'sonner';

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
  const { currentWorkspace } = useWorkspaceStore();
  const { branches, activeBranch, setActiveBranch, loadBranches, isLoading } = useBranchStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSelect = (branch: Branch) => {
    setActiveBranch(branch);
    setIsOpen(false);
    if (onBranchChange) onBranchChange(branch);
    toast.success(`Active branch: ${branch.name}`);
  };

  const filteredBranches = branches.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.code && b.code.toLowerCase().includes(q));
  });

  if (!currentWorkspace) return null;

  return (
    <>
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <div className="w-6 h-6 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs shrink-0">
            <Warehouse className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[150px]">
                {activeBranch ? activeBranch.name : isLoading ? 'Loading...' : 'No Branch Assigned'}
              </span>
              {activeBranch?.isPrimary && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Primary
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-400 font-mono">
              {activeBranch?.code ? `Code: ${activeBranch.code}` : 'Branch Context'}
            </span>
          </div>

          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-2 w-76 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl backdrop-blur-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-2.5 border-b border-slate-800 bg-slate-950/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search branches..."
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-800 rounded-sm text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
              {branches.length === 0 ? (
                <div className="p-4 text-center space-y-1 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="font-semibold">No branch assigned</p>
                  <p className="text-[10px] text-slate-400">
                    Ask an organization administrator to assign you to a branch.
                  </p>
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-xs">No matching branches</div>
              ) : (
                filteredBranches.map((branch) => {
                  const isSelected =
                    (branch.id || branch._id) === (activeBranch?.id || activeBranch?._id);
                  return (
                    <div
                      key={branch.id || branch._id}
                      className={`w-full group rounded-sm flex items-center justify-between text-xs transition-colors ${
                        isSelected
                          ? 'bg-emerald-950/60 text-white border border-emerald-500/30'
                          : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(branch)}
                        className="flex-1 text-left p-2 min-w-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold truncate">{branch.name}</span>
                          {branch.isPrimary && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          {branch.code && <span className="font-mono text-slate-400">[{branch.code}]</span>}
                          {branch.address && <span className="truncate">{branch.address}</span>}
                        </div>
                      </button>

                      <div className="flex items-center pr-2 gap-1">
                        <button
                          type="button"
                          title="Edit branch details"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBranch(branch);
                            setIsOpen(false);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Add Location */}
            <div className="p-2 border-t border-slate-800 bg-slate-950/80">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsCreatingBranch(true);
                }}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Branch Location</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {editingBranch && (
        <BranchEditModal
          isOpen={!!editingBranch}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
        />
      )}

      {isCreatingBranch && currentWorkspace?.id && (
        <BranchCreationModal
          isOpen={isCreatingBranch}
          workspaceId={currentWorkspace.id}
          onClose={() => setIsCreatingBranch(false)}
        />
      )}
    </>
  );
};

export const BranchSelector = BranchSwitcher;
