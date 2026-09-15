import React from 'react';
import { Store, ChevronDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
  isPrimary?: boolean;
  status?: string;
}

interface BranchSelectorProps {
  branches: BranchOption[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  onAddBranch?: () => void;
  className?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  selectedBranchId,
  onSelectBranch,
  onAddBranch,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-all text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">
                {selectedBranch?.name || 'All Branches'}
              </span>
              {selectedBranch?.isPrimary && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Primary
                </span>
              )}
            </div>
            {selectedBranch?.code && (
              <span className="text-[10px] text-slate-400 font-mono">{selectedBranch.code}</span>
            )}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-[#160c15] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
            Select Active Branch
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {branches.map((b) => {
              const isSelected = b.id === selectedBranchId;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectBranch(b.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left',
                    isSelected
                      ? 'bg-emerald-500/15 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{b.name}</span>
                    {b.isPrimary && (
                      <span className="text-[9px] font-semibold text-amber-400">(Primary)</span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {onAddBranch && (
            <div className="pt-1.5 mt-1.5 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  onAddBranch();
                }}
                className="w-full justify-center text-xs text-[#e6a8d6] hover:text-white hover:bg-[#714b67]/20 h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add New Branch
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
