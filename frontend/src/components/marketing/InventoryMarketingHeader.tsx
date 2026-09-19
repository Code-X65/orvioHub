import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  Building2,
  Settings,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getCrossSubdomainUrl, getLoginUrl, getSignupUrl } from '@/lib/domain';
import { trackEvent } from '@/lib/analytics';

interface InventoryMarketingHeaderProps {
  currentSection?: string;
}

export const InventoryMarketingHeader: React.FC<InventoryMarketingHeaderProps> = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { workspaces, currentWorkspace, fetchWorkspaces } = useWorkspaceStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch workspaces if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
    }
  }, [isAuthenticated, fetchWorkspaces]);

  // Outside click listener for user dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine user inventory status
  const hasWorkspace = (workspaces && workspaces.length > 0) || !!currentWorkspace;
  const hasInventory = workspaces?.some((w) =>
    w.enabledProducts?.some((p) => p.productKey === 'inventory' && p.status === 'active')
  ) || false;

  const handleScrollTo = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSignOut = async () => {
    setIsUserDropdownOpen(false);
    await logout();
    navigate('/');
  };

  const inventoryDashboardUrl = getCrossSubdomainUrl('inventory', '/dashboard');
  const loginUrl = getLoginUrl(window.location.origin);
  const signupUrl = `${getSignupUrl(window.location.origin)}?plan=inventory_trial&ref=inventory_header`;

  // Get user initial
  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left Side: Back Arrow + Text */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors group px-2.5 py-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
            title="Return to Orviohub homepage"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-slate-400 group-hover:text-emerald-400" />
            <span className="hidden sm:inline">Back to Orviohub</span>
          </Link>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Center Brand */}
          <Link
            to="/inventory"
            className="flex items-center gap-2.5 group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition-transform">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  Inventory
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  by Orviohub
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Center / Right Anchor Navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-7">
          <button
            onClick={() => handleScrollTo('features')}
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => handleScrollTo('demo')}
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            Demo
          </button>
          <button
            onClick={() => handleScrollTo('how-it-works')}
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            How it Works
          </button>
          <button
            onClick={() => handleScrollTo('pricing')}
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            Pricing
          </button>
          <button
            onClick={() => handleScrollTo('faq')}
            className="text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            FAQs
          </button>
        </nav>

        {/* Right Side Actions */}
        <div className="hidden md:flex items-center gap-3">
          {!isAuthenticated ? (
            <>
              <a
                href={loginUrl}
                className="text-sm font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-slate-900 transition-colors"
                onClick={() => trackEvent('header_login_clicked', { source: 'inventory_header' })}
              >
                Sign In
              </a>
              <a
                href={signupUrl}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg shadow-md shadow-emerald-950/50 hover:shadow-emerald-900/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => {
                  trackEvent('signup_initiated', {
                    source: 'inventory_marketing_page',
                    position: 'header_cta',
                  });
                }}
              >
                Start Free Trial
                <ChevronRight className="w-4 h-4" />
              </a>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {/* Contextual primary action based on workspace/inventory membership */}
              {!hasWorkspace ? (
                <a
                  href="/workspaces/new"
                  className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-all"
                >
                  Create Workspace
                </a>
              ) : !hasInventory ? (
                <a
                  href="/apps/inventory/activate"
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-all"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  Activate Inventory
                </a>
              ) : (
                <a
                  href={inventoryDashboardUrl}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg shadow-md shadow-emerald-950/50 hover:shadow-emerald-900/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() =>
                    trackEvent('hero_cta_clicked', {
                      cta_type: 'go_to_dashboard',
                      authenticated: true,
                    })
                  }
                >
                  <span>Go to Inventory Dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {/* User Avatar & Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsUserDropdownOpen((prev) => !prev)}
                  className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 hover:border-emerald-500 text-emerald-400 font-bold flex items-center justify-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  aria-label="User menu"
                >
                  {userInitial}
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-left animate-in fade-in-50 zoom-in-95">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-sm font-semibold text-white truncate">
                        {user?.name || 'Orviohub User'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                      {currentWorkspace && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 truncate">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{currentWorkspace.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Navigation Items */}
                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        My Profile
                      </Link>
                      <Link
                        to="/profile/settings"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        Settings
                      </Link>
                      <Link
                        to="/workspaces"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-slate-400" />
                        Workspaces
                      </Link>
                    </div>

                    <div className="border-t border-slate-800 my-1" />

                    {/* Sign Out */}
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          {isAuthenticated && (
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold flex items-center justify-center text-xs">
              {userInitial}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => handleScrollTo('features')}
              className="text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              Features
            </button>
            <button
              onClick={() => handleScrollTo('demo')}
              className="text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              Interactive Demo
            </button>
            <button
              onClick={() => handleScrollTo('how-it-works')}
              className="text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              How it Works
            </button>
            <button
              onClick={() => handleScrollTo('pricing')}
              className="text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              Pricing Plans
            </button>
            <button
              onClick={() => handleScrollTo('faq')}
              className="text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              Frequently Asked Questions
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            {!isAuthenticated ? (
              <>
                <a
                  href={loginUrl}
                  className="w-full text-center py-2.5 text-sm font-semibold text-slate-200 bg-slate-900 border border-slate-800 rounded-lg"
                >
                  Sign In
                </a>
                <a
                  href={signupUrl}
                  className="w-full text-center py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md"
                >
                  Start Free Trial
                </a>
              </>
            ) : (
              <>
                {!hasWorkspace ? (
                  <a
                    href="/workspaces/new"
                    className="w-full text-center py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg"
                  >
                    Create Workspace
                  </a>
                ) : !hasInventory ? (
                  <a
                    href="/apps/inventory/activate"
                    className="w-full text-center py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg"
                  >
                    Activate Inventory
                  </a>
                ) : (
                  <a
                    href={inventoryDashboardUrl}
                    className="w-full text-center py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg flex items-center justify-center gap-2"
                  >
                    <span>Go to Inventory Dashboard</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{user?.email}</span>
                  <button onClick={handleSignOut} className="text-red-400 hover:underline">
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
