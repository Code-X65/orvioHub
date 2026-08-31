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
  Edit2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
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
      <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
        {/* Compact Branch Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 flex items-center gap-2 px-2.5 rounded-xs bg-[#0e0a0d] hover:bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#714b67]"
        >
          <Warehouse className="w-3.5 h-3.5 text-[#f0d8e8] shrink-0" />

          <div className="flex items-center gap-1.5 min-w-0 pr-0.5">
            <span className="text-xs font-semibold text-white truncate max-w-[110px] sm:max-w-[150px]">
              {activeBranch ? activeBranch.name : isLoading ? 'Loading...' : 'Main Store'}
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
            {/* Search Box */}
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

            {/* List of Branches */}
            <div className="max-h-56 overflow-y-auto py-1 divide-y divide-white/5">
              {filteredBranches.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No branch locations found
                </div>
              ) : (
                filteredBranches.map((branch) => {
                  const isSelected = (activeBranch?.id || activeBranch?._id) === (branch.id || branch._id);
                  return (
                    <div
                      key={branch.id || branch._id}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-white/5 group',
                        isSelected && 'bg-[#714b67]/20'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(branch)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <Warehouse className={cn('w-4 h-4 shrink-0', isSelected ? 'text-[#f0d8e8]' : 'text-slate-500')} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('font-semibold truncate text-xs', isSelected ? 'text-[#f0d8e8]' : 'text-white')}>
                              {branch.name}
                            </span>
                            {branch.isPrimary && (
                              <span className="px-1.5 py-0.2 rounded-xs text-[8px] font-bold bg-[#714b67]/30 text-[#f0d8e8] border border-[#714b67]/40">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            Code: {branch.code || 'MAIN'} {branch.address ? `• ${branch.address}` : ''}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
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

            {/* Create New Branch Action */}
            <div className="p-2 border-t border-white/10 bg-[#080608]">
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
            </div>
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
    </>
  );
};
