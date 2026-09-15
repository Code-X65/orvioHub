import React from 'react';
import { Store, MapPin, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
  city?: string;
  state?: string;
  isPrimary?: boolean;
}

interface BranchSelectorModalProps {
  isOpen: boolean;
  appName: string;
  branches: BranchOption[];
  onSelectBranch: (branch: BranchOption) => void;
  onClose: () => void;
}

export const BranchSelectorModal: React.FC<BranchSelectorModalProps> = ({
  isOpen,
  appName,
  branches,
  onSelectBranch,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0e0a0d] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Select Operating Branch</h2>
              <p className="text-[11px] text-slate-400">Choose a location to enter {appName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => onSelectBranch(branch)}
              className="w-full text-left p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/40 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white group-hover:text-emerald-400 transition-colors">
                    {branch.name}
                  </span>
                  {branch.isPrimary && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Primary
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>
                    {branch.city ? `${branch.city}, ` : ''}
                    {branch.state || 'Nigeria'}
                  </span>
                  {branch.code && (
                    <span className="text-[10px] font-mono text-slate-500">
                      #{branch.code}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-white/5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-white/10 text-slate-400 hover:text-white text-xs rounded-lg cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
