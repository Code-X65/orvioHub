import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Menu, X, ArrowRight, User, LogOut, Globe, Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { OrivioLogo } from '../brand/OrivioLogo';
import { NotificationBell } from '../notifications/NotificationBell';
import {
  getMarketingUrl,
  getLoginUrl,
  getSignupUrl,
  getAccountsUrl,
  getHomeUrl,
  getInventoryUrl,
} from '@/lib/domain';

export const Header: React.FC = () => {

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isInitialized, refreshSession, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    if (!isInitialized) {
      refreshSession();
    }
  }, [isInitialized, refreshSession]);

  useEffect(() => {
    if (isAuthenticated && workspaces.length === 0) {
      fetchWorkspaces('inventory').catch(() => {});
    }
  }, [isAuthenticated, fetchWorkspaces, workspaces.length]);

  const hasOrganization = Boolean(workspaces && workspaces.length > 0);

  // Click outside listener for profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const handleSignOut = async () => {
    setProfileDropdownOpen(false);
    await logout();
    window.location.href = `${getLoginUrl()}?logged_out=true`;
  };

  const marketingUrl = getMarketingUrl();
  const loginUrl = getLoginUrl();
  const signupUrl = getSignupUrl();
  const myAccountUrl = `${getAccountsUrl()}/profile/personal`;
  const launcherUrl = getHomeUrl();
  const inventoryUrl = getInventoryUrl();
  const pricingUrl = `${getMarketingUrl()}/pricing`;

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-white/5 transition-all duration-200">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        
        {/* Left: Orivio Logo */}
        <a href={marketingUrl} className="flex items-center gap-3 group focus:outline-none">
          <OrivioLogo size={36} />
        </a>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-2 xl:gap-6 text-[14px] font-medium text-slate-300">
          {/* Solutions Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setActiveDropdown('solutions')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-sm hover:text-white transition-colors focus:outline-none">
              <span>Solutions</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'solutions' ? 'rotate-180 text-white' : ''}`} />
            </button>

            {activeDropdown === 'solutions' && (
              <div className="absolute top-full left-0 mt-1 w-64 p-3 rounded-sm bg-[#0e0e11] border border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                <a href={launcherUrl} className="block p-2.5 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition">
                  <p className="font-semibold text-xs text-white">Workspaces</p>
                  <p className="text-[11px] text-slate-400">View and manage all your organizations</p>
                </a>
                <a href={inventoryUrl} className="block p-2.5 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition">
                  <p className="font-semibold text-xs text-white">Inventory Management</p>
                  <p className="text-[11px] text-slate-400">Multi-branch stock, POS checkout & registers</p>
                </a>
                <a href="/products" className="block p-2.5 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition">
                  <p className="font-semibold text-xs text-white">All Business Modules</p>
                  <p className="text-[11px] text-slate-400">Explore our modular SaaS suite</p>
                </a>
              </div>
            )}
          </div>

          {/* Industries Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setActiveDropdown('industries')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-sm hover:text-white transition-colors focus:outline-none">
              <span>Industries</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'industries' ? 'rotate-180 text-white' : ''}`} />
            </button>

            {activeDropdown === 'industries' && (
              <div className="absolute top-full left-0 mt-1 w-60 p-3 rounded-sm bg-[#0e0e11] border border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                <a href="/products" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Retail & Commerce</a>
                <a href="/products" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Hospitality & Food</a>
                <a href="/products" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Logistics & Distribution</a>
                <a href="/products" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Services & Agency</a>
              </div>
            )}
          </div>

          {/* Resources Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setActiveDropdown('resources')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-sm hover:text-white transition-colors focus:outline-none">
              <span>Resources</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'resources' ? 'rotate-180 text-white' : ''}`} />
            </button>

            {activeDropdown === 'resources' && (
              <div className="absolute top-full left-0 mt-1 w-56 p-3 rounded-sm bg-[#0e0e11] border border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                <a href="#resources" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Documentation</a>
                <a href="#resources" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">API & Developers</a>
                <a href="#resources" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Blog & News</a>
                <a href="#resources" className="block p-2 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white text-xs">Help Center</a>
              </div>
            )}
          </div>

          <a
            href={pricingUrl}
            className="px-3 py-2 rounded-sm hover:text-white transition-colors"
          >
            Pricing
          </a>

          <a
            href="#about"
            className="px-3 py-2 rounded-sm hover:text-white transition-colors"
          >
            About
          </a>
        </nav>

        {/* Right: Language Pill, Auth Links & CTA */}
        <div className="hidden lg:flex items-center gap-5">
          {/* Language Selector */}
          <div className="flex items-center gap-1 text-xs text-slate-300 hover:text-white cursor-pointer px-2.5 py-1.5 rounded-sm border border-white/10 bg-white/5 transition">
            <Globe className="w-3.5 h-3.5 text-[#FDB02F]" />
            <span className="font-semibold">EN</span>
          </div>

          {/* User authenticated vs guest buttons */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-sm bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs text-white cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-sm bg-gradient-to-tr from-[#714B67] to-[#FDB02F] flex items-center justify-center font-bold text-white text-[11px] shadow-sm overflow-hidden shrink-0">
                    {user.avatarUrl || user.avatar ? (
                      <img
                        src={user.avatarUrl || user.avatar}
                        alt={user.name || 'User avatar'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide image on broken URL so fallback initial displays
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <span className="font-semibold max-w-[120px] truncate">{user.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-sm bg-[#0e0e11] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-sm bg-gradient-to-tr from-[#714B67] to-[#FDB02F] flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0 shadow-sm">
                        {user.avatarUrl || user.avatar ? (
                          <img
                            src={user.avatarUrl || user.avatar}
                            alt={user.name || 'User'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          user.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white text-xs truncate">{user.name || 'User'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="py-1">
                      <a href={launcherUrl} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition">
                        Workspaces
                      </a>
                      {hasOrganization ? (
                        <a href={inventoryUrl} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition">
                          Inventory App
                        </a>
                      ) : (
                        <a href={`${launcherUrl}/onboard/organization`} className="flex items-center gap-2 px-3 py-2 text-xs text-[#c79dbd] hover:text-white hover:bg-[#714b67]/20 rounded-sm transition font-medium">
                          <Plus className="w-3.5 h-3.5 text-[#c79dbd]" /> Set up Organization
                        </a>
                      )}
                      <a href={myAccountUrl} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition">
                        <User className="w-3.5 h-3.5" /> Account Settings
                      </a>
                    </div>
                    <div className="pt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-sm transition font-semibold cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <a
                href={loginUrl}
                className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </a>

              <a
                href={signupUrl}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[#714B67] hover:bg-[#86597A] text-white text-xs font-semibold shadow-lg shadow-[#714B67]/30 hover:shadow-[#714B67]/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Get started free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>

        {/* Mobile Menu Button & Notifications */}
        <div className="flex lg:hidden items-center gap-2">
          {isAuthenticated && user && <NotificationBell />}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-black/95 border-b border-white/10 px-6 py-6 space-y-4">
          {isAuthenticated && user ? (
            <div className="p-3 rounded-sm bg-white/5 border border-white/10 flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-sm bg-gradient-to-tr from-[#714B67] to-[#FDB02F] flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0 shadow-sm">
                {user.avatarUrl || user.avatar ? (
                  <img
                    src={user.avatarUrl || user.avatar}
                    alt={user.name || 'User'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-xs truncate">{user.name || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          ) : null}

          <a href={launcherUrl} className="block py-2 text-sm text-slate-300 hover:text-white">Solutions</a>
          <a href="#industries" className="block py-2 text-sm text-slate-300 hover:text-white">Industries</a>
          <a href="#resources" className="block py-2 text-sm text-slate-300 hover:text-white">Resources</a>
          <a href={pricingUrl} className="block py-2 text-sm text-slate-300 hover:text-white">Pricing</a>
          <a href="#about" className="block py-2 text-sm text-slate-300 hover:text-white">About</a>

          {isAuthenticated && user ? (
            <div className="pt-4 border-t border-white/10 space-y-2">
              <a href={launcherUrl} className="block py-2 text-xs text-slate-300 hover:text-white">Workspaces</a>
              {hasOrganization && (
                <a href={inventoryUrl} className="block py-2 text-xs text-slate-300 hover:text-white">Inventory App</a>
              )}
              <a href={myAccountUrl} className="block py-2 text-xs text-slate-300 hover:text-white">Account Settings</a>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-left py-2 text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <a href={loginUrl} className="w-full text-center py-2.5 text-xs font-semibold text-slate-300 border border-white/10 rounded-sm">Sign in</a>
              <a href={signupUrl} className="w-full text-center py-2.5 text-xs font-semibold text-white bg-[#714B67] rounded-sm">Get started free</a>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
