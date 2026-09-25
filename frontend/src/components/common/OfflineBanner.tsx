import React, { useState } from 'react';
import { useOnlineStatus } from '../../lib/offline';
import { useOfflineQueueCount, offlineQueue } from '../../lib/offlineQueue';
import { WifiOff, RefreshCw, CheckCircle2, X } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const pendingCount = useOfflineQueueCount();
  const [isSyncing, setIsSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If online and no pending mutations, do not show
  if (isOnline && pendingCount === 0) {
    return null;
  }

  if (dismissed && isOnline) {
    return null;
  }

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await offlineQueue.flush();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-xs transition-all duration-300 flex items-center justify-between shadow-md ${
        !isOnline
          ? 'bg-amber-950/95 text-amber-200 border-b border-amber-600/40 backdrop-blur-sm'
          : 'bg-emerald-950/95 text-emerald-200 border-b border-emerald-600/40 backdrop-blur-sm'
      }`}
    >
      <div className="flex items-center gap-2.5 max-w-4xl mx-auto w-full">
        {!isOnline ? (
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        )}

        <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-white">
            {!isOnline ? 'You are currently offline.' : 'Connection restored.'}
          </span>
          <span className="text-[11px] opacity-90">
            {!isOnline
              ? pendingCount > 0
                ? `${pendingCount} action${pendingCount > 1 ? 's' : ''} queued locally and will sync automatically when you reconnect.`
                : 'Browsing in offline cache mode. Mutations will be queued safely.'
              : `${pendingCount} pending change${pendingCount > 1 ? 's' : ''} ready to synchronize.`}
          </span>
        </div>

        {isOnline && pendingCount > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
