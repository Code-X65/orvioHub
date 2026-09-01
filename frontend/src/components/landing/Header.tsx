import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Menu, X, ArrowRight, User, LogOut, Globe } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import { getAccountsUrl } from '@orviohub/shared';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { OrivioLogo } from '../brand/OrivioLogo';

export const Header: React.FC = () => {
  const host = useHost();
  const env = host.environment;
  const isMarketing = host.application === 'marketing';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isInitialized, refreshSession, logout } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      refreshSession();
    }
  }, [isInitialized, refreshSession]);

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
    const returnUrl = isMarketing ? homeUrl : (typeof window !== 'undefined' ? window.location.origin : '');
    window.location.href = `${accountsUrl}/login?logged_out=true&returnTo=${encodeURIComponent(returnUrl)}`;
  };

  const marketingUrl = getCrossSubdomainUrl('marketing', '', false, env);
  const accountsUrl = getAccountsUrl(env);
  const homeUrl = getCrossSubdomainUrl('home', '', true, env);
  const launcherUrl = getCrossSubdomainUrl('launcher', '', true, env);

  const defaultReturnUrl = isMarketing ? homeUrl : (typeof window !== 'undefined' ? window.location.href : '');
  const loginUrl = `${accountsUrl}/login?returnTo=${encodeURIComponent(defaultReturnUrl)}`;
  const signupUrl = `${accountsUrl}/signup?returnTo=${encodeURIComponent(defaultReturnUrl)}`;
  const myAccountUrl = getCrossSubdomainUrl('accounts', '/profile/personal', true, env);
  const pricingUrl = isMarketing ? '/pricing' : `${marketingUrl}/pricing`;

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
                  <p className="font-semibold text-xs text-white">All Applications</p>
                  <p className="text-[11px] text-slate-400">Explore our modular SaaS suite</p>
                </a>
                <a href="/products" className="block p-2.5 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition">
                  <p className="font-semibold text-xs text-white">For SMEs & Retail</p>
                  <p className="text-[11px] text-slate-400">Inventory, POS, Accounting & Payments</p>
                </a>
                <a href="/products" className="block p-2.5 rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition">
                  <p className="font-semibold text-xs text-white">For Enterprises</p>
                  <p className="text-[11px] text-slate-400">Multi-branch and high-volume operations</p>
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
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-sm bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs text-white"
              >
                <div className="w-7 h-7 rounded-sm bg-gradient-to-tr from-[#714B67] to-[#FDB02F] flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="font-semibold max-w-[120px] truncate">{user.name?.split(' ')[0] || 'Account'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-sm bg-[#0e0e11] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="font-bold text-white text-xs truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <a href={homeUrl} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition">
                      Launch Workspace
                    </a>
                    <a href={myAccountUrl} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-sm transition">
                      <User className="w-3.5 h-3.5" /> Account Settings
                    </a>
                  </div>
                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-sm transition font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
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

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-black/95 border-b border-white/10 px-6 py-6 space-y-4">
          <a href={launcherUrl} className="block py-2 text-sm text-slate-300 hover:text-white">Solutions</a>
          <a href="#industries" className="block py-2 text-sm text-slate-300 hover:text-white">Industries</a>
          <a href="#resources" className="block py-2 text-sm text-slate-300 hover:text-white">Resources</a>
          <a href={pricingUrl} className="block py-2 text-sm text-slate-300 hover:text-white">Pricing</a>
          <a href="#about" className="block py-2 text-sm text-slate-300 hover:text-white">About</a>
          <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
            <a href={loginUrl} className="w-full text-center py-2.5 text-xs font-semibold text-slate-300 border border-white/10 rounded-sm">Sign in</a>
            <a href={signupUrl} className="w-full text-center py-2.5 text-xs font-semibold text-white bg-[#714B67] rounded-sm">Get started free</a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
