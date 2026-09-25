import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Warehouse,
  FileBarChart2,
  Users,
  Store,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventorySidebarProps {
  className?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const InventorySidebar: React.FC<InventorySidebarProps> = ({
  className,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { activeBranch } = useBranchStore();
  const { user, logout } = useAuthStore();

  const navItems = [
    {
      label: 'Overview',
      to: '/inventory/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Products & Catalog',
      to: '/inventory/products',
      icon: Package,
      badge: 'Demo',
    },
    {
      label: 'Sales & POS',
      to: '/inventory/sales',
      icon: Receipt,
      badge: 'Demo',
    },
    {
      label: 'Stock & Transfers',
      to: '/inventory/stock',
      icon: Warehouse,
      badge: 'Demo',
    },
    {
      label: 'Reports & Analytics',
      to: '/inventory/reports',
      icon: FileBarChart2,
      badge: 'Demo',
    },
    {
      label: 'Branch Settings',
      to: '/inventory/settings/branch',
      icon: Store,
      badge: null,
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const content = (
    <div className="flex flex-col h-full bg-[#100910] text-slate-200 border-r border-white/10 select-none">
      {/* 1. Header & Brand */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className={cn('flex items-center gap-3 overflow-hidden transition-all duration-200', isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
          <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-[#8a4b77] to-[#512c47] flex items-center justify-center text-white shadow-md shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white tracking-tight text-sm">Orvio<span className="text-[#e296cb]">Hub</span></span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#714b67]/30 text-[#f3bce2] border border-[#714b67]/40 uppercase tracking-wider">
                Inventory
              </span>
            </div>
            <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
              {currentWorkspace?.name || 'Store Operations'}
            </span>
          </div>
        </div>

        {isCollapsed && (
          <div className="w-9 h-9 mx-auto rounded-sm bg-gradient-to-br from-[#8a4b77] to-[#512c47] flex items-center justify-center text-white shadow-md shrink-0">
            <Store className="w-5 h-5" />
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Active Branch Indicator Pill */}
      {!isCollapsed && activeBranch && (
        <div className="p-3 mx-3 my-2.5 rounded-sm bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 ring-4 ring-emerald-400/20 animate-pulse" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate max-w-[130px]">{activeBranch.name}</span>
                {activeBranch.isPrimary && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Primary
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                Code: {activeBranch.code || 'MAIN'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Navigation Links */}
      <div className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className={cn('px-2.5 pb-2 text-[10px] uppercase font-bold tracking-wider text-slate-500', isCollapsed && 'sr-only')}>
          Store Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.to ||
            (item.to === '/inventory/dashboard' && location.pathname === '/inventory') ||
            (item.to === '/inventory/team' && (location.pathname.startsWith('/inventory/team') || location.pathname.startsWith('/inventory/my-team')));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-medium transition-all duration-150 relative cursor-pointer',
                isActive
                  ? 'bg-gradient-to-r from-[#714b67]/40 to-[#714b67]/20 text-white font-semibold shadow-inner border border-[#714b67]/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-[#e6a8d6]' : 'text-slate-400 group-hover:text-white')} />
              
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-xs bg-[#e6a8d6]" />
              )}
            </NavLink>
          );
        })}

        {/* 4. Global Organization Settings Bridge */}
        <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
          <div className={cn('px-2.5 pb-2 text-[10px] uppercase font-bold tracking-wider text-slate-500', isCollapsed && 'sr-only')}>
            Organization Tenancy
          </div>

          <NavLink
            to="/settings/general"
            onClick={onCloseMobile}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition cursor-pointer"
            title={isCollapsed ? 'Workspace & Legal Settings' : undefined}
          >
            <Building2 className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-[#e6a8d6]" />
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Org Settings</span>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
              </div>
            )}
          </NavLink>

          <NavLink
            to="/settings/team"
            onClick={onCloseMobile}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition cursor-pointer"
            title={isCollapsed ? 'Workspace Team' : undefined}
          >
            <Users className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-[#e6a8d6]" />
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Global Team</span>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
              </div>
            )}
          </NavLink>
        </div>
      </div>

      {/* 5. User Footer */}
      <div className="p-3 border-t border-white/10 shrink-0 bg-[#0c060c]/60">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-sm bg-white/10 border border-white/10 flex items-center justify-center font-bold text-white text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex flex-col flex-1">
                <span className="text-xs font-bold text-white truncate max-w-[130px]" title={user?.name || 'Operator'}>
                  {user?.name || 'Operator'}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[130px]" title={user?.email}>
                  {user?.email}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-2 rounded-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            title={`Sign out (${user?.name || 'User'})`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 transition-all duration-200 z-20 h-screen sticky top-0',
          isCollapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Mobile Drawer Content */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-72 z-50 md:hidden transform transition-transform duration-200 ease-in-out shadow-2xl',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {content}
      </aside>
    </>
  );
};
