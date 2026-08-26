import React from 'react';
import { ShieldCheck, Lock, MessageCircle, Globe } from 'lucide-react';

export const TrustFooter: React.FC = () => {
  return (
    <footer className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/80 space-y-4">
      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>NDPR Compliant</span>
        </div>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <div className="flex items-center gap-1.5 font-medium">
          <Lock className="w-3.5 h-3.5 text-indigo-500" />
          <span>256-Bit SSL Encrypted</span>
        </div>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <a
          href="https://wa.me/2348000000000?text=Hi%20Orvio%20Support%2C%20I%20need%20help%20logging%20in"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp Assistance</span>
        </a>
      </div>

      {/* Regional & Copyright */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-2">
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3" />
          <span>Nigeria (English)</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy</a>
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms</a>
          <span>© {new Date().getFullYear()} Orvio Inc.</span>
        </div>
      </div>
    </footer>
  );
};
