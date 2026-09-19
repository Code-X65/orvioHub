import React, { useState } from 'react';
import { InventorySidebar } from '@/components/inventory/InventorySidebar';
import { BranchSwitcher } from '@/components/workspace/BranchSwitcher';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { useBranchStore } from '@/stores/useBranchStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Menu, Bell, Sparkles } from 'lucide-react';

interface InventoryLayoutProps {
  children: React.ReactNode;
}

export const InventoryLayout: React.FC<InventoryLayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { activeBranch } = useBranchStore();
  const { currentWorkspace } = useWorkspaceStore();

  return (
    <div className="min-h-screen bg-[#090408] text-slate-100 flex flex-col md:flex-row antialiased">
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
        <header className="h-16 bg-[#120a11]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 md:hidden"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Branch Switcher in the top bar */}
            <div className="flex items-center gap-2">
              <BranchSwitcher applicationKey="inventory" className="w-48 sm:w-64" />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Workspace Switcher */}
            <div className="hidden sm:block">
              <WorkspaceSwitcher className="w-44" />
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
