import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SettingsLayoutProps {
  title: string;
  subtitle?: string;
  contextTag?: string;
  badge?: string;
  backUrl?: string;
  headerRight?: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  className?: string;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  title,
  subtitle,
  contextTag,
  badge,
  backUrl = '/dashboard',
  headerRight,
  sidebar,
  children,
  searchQuery,
  onSearchChange,
  className,
}) => {
  const navigate = useNavigate();

  return (
    <div className={cn('min-h-screen bg-[#0a0509] text-slate-100 flex flex-col', className)}>
      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 bg-[#120a11]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backUrl)}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {title}
              </h1>
              {contextTag && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#714b67]/30 text-[#e6a8d6] border border-[#714b67]/40">
                  {contextTag}
                </span>
              )}
              {badge && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {onSearchChange !== undefined && (
            <div className="relative w-48 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search settings..."
                className="pl-9 h-9 bg-black/40 border-white/10 text-xs rounded-xl focus:border-[#714b67]"
              />
            </div>
          )}
          {headerRight}
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 lg:w-72 shrink-0 bg-[#120a11]/60 border border-white/10 rounded-2xl p-3 shadow-xl backdrop-blur-sm sticky top-20">
          {sidebar}
        </aside>

        {/* Content Pane */}
        <main className="flex-1 w-full bg-[#120a11]/40 border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl backdrop-blur-sm min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
