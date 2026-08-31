import React, { useState, useEffect } from 'react';
import { Key, Loader2, CheckCircle2, Unlink, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { LinkedIdentityItem } from '../../lib/types';
import { toast } from 'sonner';

export const LinkedIdentities: React.FC = () => {
  const [identities, setIdentities] = useState<LinkedIdentityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const fetchIdentities = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ identities: LinkedIdentityItem[] }>('/users/me/identities');
      if (res && res.identities) {
        setIdentities(res.identities);
      }
    } catch {
      toast.error('Failed to load linked accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdentities();
  }, []);

  const handleUnlink = async (identity: LinkedIdentityItem) => {
    if (identities.length <= 1) {
      toast.error('You cannot disconnect your only login method.');
      return;
    }

    if (!window.confirm(`Are you sure you want to disconnect ${identity.provider}?`)) return;

    try {
      setUnlinkingId(identity.id);
      await api.delete(`/users/me/identities/${identity.id}`);
      toast.success(`${identity.provider} disconnected successfully.`);
      setIdentities((prev) => prev.filter((i) => i.id !== identity.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect identity.');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleConnectOAuth = (provider: 'google' | 'facebook') => {
    window.location.href = `/api/v1/auth/${provider}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading linked login methods...</span>
      </div>
    );
  }

  const hasPassword = identities.some((i) => i.provider === 'password');
  const hasGoogle = identities.some((i) => i.provider === 'google');
  const hasFacebook = identities.some((i) => i.provider === 'facebook');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          Linked Authentication Methods
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Connect multiple login providers for seamless single sign-on across all devices.
        </p>
      </div>

      <div className="space-y-3">
        {/* Email & Password */}
        <div className="flex items-center justify-between p-4 rounded-sm border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Password Login
                </p>
                {hasPassword && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in with your email address and secure master password
              </p>
            </div>
          </div>
        </div>

        {/* Google OAuth */}
        <div className="flex items-center justify-between p-4 rounded-sm border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Google Account
                </p>
                {hasGoogle && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quick 1-click login with your Google Workspace or Gmail profile
              </p>
            </div>
          </div>

          <div>
            {hasGoogle ? (
              <button
                type="button"
                disabled={unlinkingId !== null}
                onClick={() => {
                  const ident = identities.find((i) => i.provider === 'google');
                  if (ident) handleUnlink(ident);
                }}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 hover:border-rose-200 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConnectOAuth('google')}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Facebook OAuth */}
        <div className="flex items-center justify-between p-4 rounded-sm border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-sm bg-[#1877F2] text-white flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Facebook Account
                </p>
                {hasFacebook && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in with your Facebook personal or business profile
              </p>
            </div>
          </div>

          <div>
            {hasFacebook ? (
              <button
                type="button"
                disabled={unlinkingId !== null}
                onClick={() => {
                  const ident = identities.find((i) => i.provider === 'facebook');
                  if (ident) handleUnlink(ident);
                }}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 hover:border-rose-200 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConnectOAuth('facebook')}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
