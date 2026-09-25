import React, { useState } from 'react';
import { Warehouse, Check, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BranchSummary {
  id?: string;
  _id?: string;
  name: string;
  code?: string;
  isPrimary?: boolean;
}

export interface BranchAccessSelectorProps {
  branches: BranchSummary[];
  selectedBranchIds?: string[];
  allBranches?: boolean;
  onChange: (selectedIds: string[], allBranches: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const BranchAccessSelector: React.FC<BranchAccessSelectorProps> = ({
  branches = [],
  selectedBranchIds = [],
  allBranches = true,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAll = () => {
    if (disabled) return;
    const nextAll = !allBranches;
    if (nextAll) {
      // All branches enabled
      const allIds = branches.map((b) => b.id || b._id).filter(Boolean) as string[];
      onChange(allIds, true);
    } else {
      // Start with primary branch or first branch if available
      const primary = branches.find((b) => b.isPrimary) || branches[0];
      const initialId = primary?.id || primary?._id;
      onChange(initialId ? [initialId] : [], false);
    }
  };

  const toggleBranch = (branchId: string) => {
    if (disabled) return;
    if (allBranches) {
      // Switching from all branches to specific: select all EXCEPT this one if unchecking,
      // or this one if it's the first specific pick
      onChange([branchId], false);
      return;
    }

    const exists = selectedBranchIds.includes(branchId);
    let nextIds: string[];
    if (exists) {
      nextIds = selectedBranchIds.filter((id) => id !== branchId);
    } else {
      nextIds = [...selectedBranchIds, branchId];
    }

    // If user checked every single branch, treat as allBranches
    const totalBranchCount = branches.length;
    if (totalBranchCount > 0 && nextIds.length === totalBranchCount) {
      onChange(nextIds, true);
    } else {
      onChange(nextIds, false);
    }
  };

  // Label text for compact display
  const getSummaryLabel = () => {
    if (branches.length === 0) {
      return 'All branches (Default)';
    }
    if (allBranches || (selectedBranchIds.length > 0 && selectedBranchIds.length === branches.length)) {
      return 'All branches';
    }
    if (selectedBranchIds.length === 0) {
      return 'No branches selected';
    }
    if (selectedBranchIds.length === 1) {
      const match = branches.find((b) => (b.id || b._id) === selectedBranchIds[0]);
      return match ? match.name : '1 branch';
    }
    return `${selectedBranchIds.length} branches`;
  };

  return (
    <div className={cn('relative text-xs', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3 h-10 rounded-xl bg-[#160f14] border border-white/10 text-xs transition-all text-left cursor-pointer focus:outline-none focus:border-[#714b67]',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20',
          allBranches ? 'text-white' : 'text-[#f0d8e8]'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1 truncate">
          {allBranches ? (
            <Globe className="w-3.5 h-3.5 text-[#d4a8c9] shrink-0" />
          ) : (
            <Warehouse className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          )}
          <span className="truncate">{getSummaryLabel()}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="mt-1.5 p-3 rounded-xl bg-[#120b10] border border-white/15 shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-100 z-30">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-[11px] font-semibold text-slate-300">Branch Access Scope</span>
            <span className="text-[10px] text-slate-500">
              {branches.length} configured
            </span>
          </div>

          {/* All branches toggle */}
          <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer select-none p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={allBranches}
              onChange={toggleAll}
              disabled={disabled}
              className="w-4 h-4 rounded border-white/20 bg-black text-[#714b67] focus:ring-0"
            />
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3.5 h-3.5 text-[#d4a8c9]" />
              <span>All Branches</span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Access to current & future branches)
              </span>
            </div>
          </label>

          {/* Specific branches list */}
          {branches.length > 0 ? (
            <div className="space-y-1 pt-1 max-h-40 overflow-y-auto pl-2 border-l border-white/10">
              {branches.map((b) => {
                const bId = String(b.id || b._id || '');
                const isChecked = allBranches || selectedBranchIds.includes(bId);

                return (
                  <label
                    key={bId}
                    className={cn(
                      'flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors',
                      isChecked ? 'text-white hover:bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBranch(bId)}
                        disabled={disabled}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-black text-[#714b67] focus:ring-0"
                      />
                      <span className="truncate">{b.name}</span>
                      {b.code && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-slate-300">
                          {b.code}
                        </span>
                      )}
                    </div>

                    {b.isPrimary && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0">
                        Primary
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 p-1 italic">
              No individual branches configured yet. Member will automatically receive access once branches are established.
            </p>
          )}

          <div className="pt-2 border-t border-white/5 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-[#d4a8c9] hover:text-white font-medium cursor-pointer px-2 py-0.5"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchAccessSelector;
