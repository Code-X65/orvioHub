import React from 'react';
import { OrivioLogo } from '@/components/brand/OrivioLogo';
import { getMarketingUrl } from '@/lib/domain';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
  showHeader?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, fullWidth = false }) => {
  const marketingUrl = getMarketingUrl();

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-[#714b67] selection:text-white relative overflow-x-hidden">
      {/* Clean Brand Top Header for Auth pages */}
      <header className="w-full pt-8 pb-4 flex items-center justify-center">
        <a
          href={marketingUrl}
          className="inline-flex items-center gap-2 group transition-transform hover:scale-[1.02] focus:outline-none"
          aria-label="Orviohub Home"
        >
          <OrivioLogo size={36} />
        </a>
      </header>

      {/* Background Subtle Radial Glow */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-radial from-[#714b67]/15 to-transparent pointer-events-none -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
        <div className={`w-full ${fullWidth ? 'max-w-[1240px]' : 'max-w-[460px]'} mx-auto`}>
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-6">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Orivo Inc. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <a href="mailto:support@orviohub.com" className="hover:text-slate-300 transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
