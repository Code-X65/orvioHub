import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, X, ArrowRight, User } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-white/5 transition-all duration-200">
      <div className="max-w-[1520px] mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        
        {/* Left: Orivo Logo */}
        <Link to="/" className="flex items-center gap-2.5 group focus:outline-none">
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
        </Link>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-2 xl:gap-4 text-[15px] font-medium text-slate-300">
          <a href="/#apps" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
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
                <a href="/#apps" className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Retail & Stores</a>
                <a href="/#apps" className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Wholesale & Distribution</a>
                <a href="/#apps" className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Services & Agencies</a>
                <a href="/#apps" className="block px-3 py-2 text-sm rounded-sm hover:bg-white/5 text-slate-300 hover:text-white transition-colors font-medium">Manufacturing</a>
              </div>
            )}
          </div>

          <a href="/#community" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
            Community
          </a>

          <a href="/#pricing" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
            Pricing
          </a>

          <a href="/#help" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
            Help
          </a>
        </nav>

        {/* Right: Auth State (Avatar if authenticated, Sign In/Try Free if not) */}
        <div className="hidden sm:flex items-center gap-4">
          {isAuthenticated && user ? (
            <Link
              to="/workspaces"
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xs bg-[#160f14] hover:bg-[#22151f] border border-[#2d1b27] hover:border-[#714b67]/50 text-white transition-all group shadow-sm"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-[#714b67]" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#714b67] text-white text-xs font-bold flex items-center justify-center">
                  {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
              )}
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white max-w-[130px] truncate">
                {user.name || user.email?.split('@')[0]}
              </span>
              <span className="text-[10px] text-[#c79dbd] bg-[#714b67]/20 px-1.5 py-0.5 rounded-xs font-medium">
                Workspace
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#c79dbd] group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <>
              <Link 
                to="/login" 
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-2 py-1"
              >
                Sign in
              </Link>
              
              <Link 
                to="/signup" 
                className="group relative inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] rounded-xs transition-all duration-200 shadow-md shadow-[#714b67]/25 hover:scale-[1.02]"
              >
                <span>Try it free</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
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
            <a href="/#apps" className="py-2 hover:text-white">Apps</a>
            <a href="/#industries" className="py-2 hover:text-white">Industries</a>
            <a href="/#community" className="py-2 hover:text-white">Community</a>
            <a href="/#pricing" className="py-2 hover:text-white">Pricing</a>
            <a href="/#help" className="py-2 hover:text-white">Help</a>
          </div>
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            {isAuthenticated && user ? (
              <Link to="/workspaces" className="w-full text-center py-2.5 font-semibold text-white bg-[#714b67] rounded-xs shadow-md flex items-center justify-center gap-2">
                <span>Go to Workspace ({user.name || 'Account'})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="w-full text-center py-2.5 font-semibold text-slate-300 border border-white/10 rounded-xs hover:bg-white/5">
                  Sign in
                </Link>
                <Link to="/signup" className="w-full text-center py-2.5 font-semibold text-white bg-[#714b67] rounded-xs shadow-md">
                  Try it free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
