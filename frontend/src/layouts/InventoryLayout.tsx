import React, { useState } from 'react';
import { InventorySidebar } from '@/components/inventory/InventorySidebar';
import { BranchSwitcher } from '@/components/workspace/BranchSwitcher';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { useBranchStore } from '@/stores/useBranchStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useComfortLevel } from '@/hooks/useComfortLevel';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryLayoutProps {
  children: React.ReactNode;
}

export const InventoryLayout: React.FC<InventoryLayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { activeBranch } = useBranchStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { densityTier } = useComfortLevel();

  return (
    <div
      className={cn(
        'min-h-screen bg-[#090408] text-slate-100 flex flex-col md:flex-row antialiased',
        densityTier === 'spacious' && 'density-spacious',
        densityTier === 'compact' && 'density-compact'
      )}
      data-density={densityTier}
    >
      {/* 1. Primary Left Sidebar */}
      <InventorySidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* 2. Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Operational Action Bar */}
        <header className="h-16 bg-[#120a11]/90 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 md:hidden shrink-0 cursor-pointer"
              title="Open menu"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Branch Switcher in the top bar */}
            <div className="flex items-center gap-2 min-w-0 max-w-[200px] sm:max-w-xs">
              <BranchSwitcher applicationKey="inventory" className="w-full" />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Workspace Switcher */}
            <div className="hidden sm:block">
              <WorkspaceSwitcher className="w-40 md:w-44" />
            </div>
          </div>
        </header>

        {/* Dynamic Page Viewport */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

