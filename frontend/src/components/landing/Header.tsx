import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, X, ArrowRight, User, Search, Globe, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import {
  getAccountsUrl,
  getHomeUrl,
  getLauncherUrl,
  getApplicationUrl,
} from '@orviohub/shared';

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

  const marketingUrl = getApplicationUrl('marketing', env);
  const accountsUrl = getAccountsUrl(env);
  const homeUrl = getHomeUrl(env);
  const launcherUrl = getLauncherUrl(env);

  const defaultReturnUrl = isMarketing ? homeUrl : (typeof window !== 'undefined' ? window.location.href : '');
  const loginUrl = `${accountsUrl}/login?returnTo=${encodeURIComponent(defaultReturnUrl)}`;
  const signupUrl = `${accountsUrl}/signup?returnTo=${encodeURIComponent(defaultReturnUrl)}`;
  const myAccountUrl = `${accountsUrl}/profile/personal`;
  const pricingUrl = isMarketing ? '/pricing' : `${marketingUrl}/pricing`;

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-white/5 transition-all duration-200">
      <div className="max-w-[1520px] mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        
        {/* Left: Orivo Logo */}
        <a href={marketingUrl} className="flex items-center gap-2.5 group focus:outline-none">
          <div className="flex items-center">
            {/* SVG Logo with white circle and plum pointer */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-8 h-8">
                {/* White outer circle */}
                <circle cx="50" cy="50" r="38" stroke="white" strokeWidth="16" fill="none" />
                {/* Plum needle pointing top-right */}
                <polygon points="50,50 88,12 55,28" fill="#714b67" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight ml-1 font-sans">
              rivo
            </span>
          </div>
        </a>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-2 xl:gap-4 text-[15px] font-medium text-slate-300">
          <a
            href={launcherUrl}
            className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
          >
            Apps
          </a>

          {/* Industries Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setActiveDropdown('industries')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors focus:outline-none">
              <span>Industries</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'industries' ? 'rotate-180 text-white' : ''}`} />
            </button>

            {activeDropdown === 'industries' && (
              <div className="absolute top-full left-0 w-64 p-2 bg-[#120b10] border border-[#2d1827] rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <a href={`${marketingUrl}/#apps`} className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Retail & Stores</a>
                <a href={`${marketingUrl}/#apps`} className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Wholesale & Distribution</a>
                <a href={`${marketingUrl}/#apps`} className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Services & Agencies</a>
                <a href={`${marketingUrl}/#apps`} className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Manufacturing</a>
              </div>
            )}
          </div>

          <a href={`${marketingUrl}/#community`} className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
            Community
          </a>

          {isMarketing ? (
            <Link to="/pricing" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
              Pricing
            </Link>
          ) : (
            <a href={pricingUrl} className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
              Pricing
            </a>
          )}

          <a href={`${marketingUrl}/#help`} className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
            Help
          </a>
        </nav>

        {/* Right: Search, Language & Auth State */}
        <div className="hidden sm:flex items-center gap-4 lg:gap-5">
          {/* Search Icon */}
          <button
            type="button"
            className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-2 py-1 rounded-sm hover:bg-white/5 transition-colors cursor-pointer">
            <Globe className="w-4 h-4" />
            <span>English</span>
          </div>

          {isAuthenticated && user ? (
            <div className="relative" ref={profileMenuRef}>
              {/* Profile Avatar Button */}
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/20 hover:border-white/60 focus:outline-none focus:ring-2 focus:ring-[#714b67] transition-all cursor-pointer flex items-center justify-center bg-[#181116]"
                title="Account menu"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#714b67] text-white text-xs font-bold flex items-center justify-center">
                    {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                )}
              </button>

              {/* Profile Popover */}
              {profileDropdownOpen && (
                <div className="absolute top-full right-0 mt-3 w-72 bg-white text-slate-900 rounded-xs shadow-2xl border border-slate-200/90 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Top Arrow Indicator */}
                  <div className="absolute -top-2 right-3.5 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[8px] border-b-white drop-shadow-sm pointer-events-none" />

                  {/* Profile Info Header */}
                  <div className="flex items-start gap-3.5">
                    {/* Square Avatar Box */}
                    <div className="w-14 h-14 rounded-xs overflow-hidden bg-slate-950 text-white flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name || 'User'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#714b67] text-white text-lg font-bold flex items-center justify-center">
                          {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                        </div>
                      )}
                    </div>

                    {/* Name & Home Navigation Link */}
                    <div className="space-y-1 min-w-0 flex-1 pt-0.5">
                      <div className="text-sm font-semibold text-slate-900 truncate leading-tight">
                        {user.name || user.email?.split('@')[0]}
                      </div>
                      <a
                        href={homeUrl}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="text-xs font-semibold text-[#0066cc] hover:underline block truncate"
                      >
                        Access Orvio Home
                      </a>
                    </div>
                  </div>

                  {/* Divider Line */}
                  <div className="border-t border-slate-200 my-3.5" />

                  {/* Bottom Action Links */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <a
                      href={myAccountUrl}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="text-[#0066cc] hover:underline"
                    >
                      My Account
                    </a>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-[#e02424] hover:underline cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <a 
                href={loginUrl} 
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-2 py-1"
              >
                Sign in
              </a>
              
              <a 
                href={signupUrl} 
                className="group relative inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] rounded-xs transition-all duration-200 shadow-md shadow-[#714b67]/25 hover:scale-[1.02]"
              >
                <span>Try it free</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-6 pt-2 pb-6 bg-[#0c070a] border-b border-white/10 shadow-2xl space-y-3">
          <div className="flex flex-col space-y-2 text-slate-300 font-medium">
            <a href={launcherUrl} className="py-2 hover:text-white">Apps</a>
            <a href={`${marketingUrl}/#industries`} className="py-2 hover:text-white">Industries</a>
            <a href={`${marketingUrl}/#community`} className="py-2 hover:text-white">Community</a>
            <a href={pricingUrl} className="py-2 hover:text-white">Pricing</a>
            <a href={`${marketingUrl}/#help`} className="py-2 hover:text-white">Help</a>
          </div>
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            {isAuthenticated && user ? (
              <div className="flex flex-col gap-2">
                <a
                  href={myAccountUrl}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 font-semibold text-white bg-[#714b67] rounded-xs shadow-md flex items-center justify-center gap-2"
                >
                  <span>My Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={async () => {
                    await handleSignOut();
                  }}
                  className="w-full text-center py-2 text-xs font-medium text-slate-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <>
                <a href={loginUrl} className="w-full text-center py-2.5 font-semibold text-slate-300 border border-white/10 rounded-xs hover:bg-white/5">
                  Sign in
                </a>
                <a href={signupUrl} className="w-full text-center py-2.5 font-semibold text-white bg-[#714b67] rounded-xs shadow-md">
                  Try it free
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
