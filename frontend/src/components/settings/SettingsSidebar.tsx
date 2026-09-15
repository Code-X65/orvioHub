import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeColor?: 'default' | 'rose' | 'amber' | 'emerald' | 'purple';
  danger?: boolean;
}

interface SettingsSidebarProps {
  items: SettingsNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  header?: React.ReactNode;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  items,
  activeId,
  onSelect,
  header,
}) => {
  return (
    <nav className="flex flex-col space-y-1">
      {header && <div className="px-3 py-2 border-b border-white/10 mb-2">{header}</div>}

      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group text-left',
              isActive
                ? item.danger
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold shadow-lg shadow-rose-950/40'
                  : 'bg-[#714b67]/25 text-white border border-[#714b67]/40 font-semibold shadow-lg shadow-[#714b67]/15'
                : item.danger
                ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}
          >
            <div className="flex items-center gap-3 truncate">
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive
                    ? item.danger
                      ? 'text-rose-400'
                      : 'text-[#e6a8d6]'
                    : item.danger
                    ? 'text-rose-400/70 group-hover:text-rose-400'
                    : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              <span className="truncate">{item.label}</span>
            </div>

            {item.badge !== undefined && (
              <span
                className={cn(
                  'ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full',
                  item.badgeColor === 'rose'
                    ? 'bg-rose-500/20 text-rose-300'
                    : item.badgeColor === 'amber'
                    ? 'bg-amber-500/20 text-amber-300'
                    : item.badgeColor === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : item.badgeColor === 'purple'
                    ? 'bg-[#714b67]/40 text-[#f5c6e8]'
                    : 'bg-white/10 text-slate-300'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
