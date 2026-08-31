import React from 'react';
import { LucideIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModuleInfo {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  category: string;
  isComingSoon?: boolean;
  requiredBy?: string[];
  requires?: string[];
  recommendedFor?: string[];
}

interface ModuleCardProps {
  module: ModuleInfo;
  isSelected: boolean;
  onToggle: (id: string) => void;
  disabled?: boolean;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  isSelected,
  onToggle,
  disabled,
}) => {
  const Icon = module.icon;
  const isComingSoon = module.isComingSoon;

  return (
    <button
      type="button"
      onClick={() => !isComingSoon && onToggle(module.id)}
      disabled={disabled || isComingSoon}
      className={cn(
        'relative group flex flex-col p-4 text-left border rounded-xs transition-all duration-200 overflow-hidden',
        isComingSoon
          ? 'border-white/5 bg-[#080407]/60 opacity-60 cursor-not-allowed'
          : isSelected
          ? 'border-[#714b67] bg-[#714b67]/15 ring-1 ring-[#714b67] cursor-pointer'
          : 'border-white/10 bg-[#0e0a0d] hover:border-white/20 cursor-pointer'
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between w-full mb-2 relative z-10">
        <div
          className={cn(
            'w-8 h-8 rounded-xs flex items-center justify-center transition-all duration-200',
            isSelected
              ? 'bg-[#714b67] text-white shadow-sm'
              : 'bg-[#180e16] text-slate-400'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Status / Checkbox Badge */}
        {isComingSoon ? (
          <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-xs border border-amber-500/20">
            Coming Soon
          </span>
        ) : (
          <div
            className={cn(
              'w-5 h-5 rounded-xs flex items-center justify-center transition-all duration-200 border',
              isSelected
                ? 'bg-[#714b67] border-[#86597a] text-white shadow-sm'
                : 'border-white/10 bg-[#120a10] text-transparent'
            )}
          >
            <Check className="w-3 h-3 stroke-[2.5]" />
          </div>
        )}
      </div>

      {/* Title & Description */}
      <div className="relative z-10 space-y-0.5">
        <h3 className={cn('text-xs font-bold transition-colors', isSelected ? 'text-white' : 'text-slate-300')}>
          {module.name}
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
          {module.desc}
        </p>
      </div>

      {/* Category tag */}
      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
        <span className="capitalize">{module.category}</span>
        {isSelected && !isComingSoon && (
          <span className="text-[#c79dbd] font-semibold flex items-center gap-1">
            Active
          </span>
        )}
      </div>
    </button>
  );
};
