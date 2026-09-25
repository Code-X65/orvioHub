import React from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { RefreshCw } from 'lucide-react';

export const TokenRefreshIndicator: React.FC = () => {
  const isRefreshingToken = useAuthStore((s) => s.isRefreshingToken);

  if (!isRefreshingToken) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Refreshing session in background"
      className="fixed top-3 right-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-[#714b67]/40 text-slate-200 text-xs shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none"
    >
      <RefreshCw className="w-3.5 h-3.5 text-[#e5a8d4] animate-spin shrink-0" />
      <span className="text-[11px] font-medium tracking-wide text-zinc-300">Syncing session...</span>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
    </div>
  );
};
