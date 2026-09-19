import React from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export interface ProfileSaveStateProps {
  status: 'idle' | 'saving' | 'success' | 'error';
  errorMessage?: string | null;
  successMessage?: string | null;
  className?: string;
}

export const ProfileSaveState: React.FC<ProfileSaveStateProps> = ({
  status,
  errorMessage,
  successMessage = 'Personal profile updated successfully.',
  className = '',
}) => {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <div className={`flex items-center gap-2 p-3 bg-slate-900/60 border border-white/10 text-slate-300 rounded-xs text-xs animate-in fade-in duration-150 ${className}`}>
        <Loader2 className="w-4 h-4 text-[#714b67] animate-spin shrink-0" />
        <span>Saving profile changes...</span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={`flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xs text-xs animate-in fade-in duration-200 ${className}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{successMessage}</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xs text-xs animate-in fade-in duration-200 ${className}`}>
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-medium">Failed to save profile changes</p>
          <p className="text-rose-300/80 text-[11px]">{errorMessage || 'An unexpected error occurred. Please check your inputs and try again.'}</p>
        </div>
      </div>
    );
  }

  return null;
};
