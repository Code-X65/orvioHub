import React from 'react';
import { UserPlus, LogOut, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { RememberedAccount } from '../../lib/types';
import { useAuthStore } from '../../stores/useAuthStore';

interface AccountSwitcherProps {
  accounts: RememberedAccount[];
  currentEmail?: string;
  onSelectAccount: (account: RememberedAccount) => void;
  onUseAnotherAccount: () => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accounts,
  currentEmail,
  onSelectAccount,
  onUseAnotherAccount,
}) => {
  const { removeRememberedAccount, logoutAllAccounts } = useAuthStore();

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return (email?.slice(0, 2) || 'OR').toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Choose an account
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          to continue to your Orvio services
        </p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-sm">
        {accounts.map((account) => {
          const isCurrent = currentEmail?.toLowerCase() === account.email.toLowerCase();
          const hasActiveToken = !!account.token;

          return (
            <div
              key={account.email}
              className="group relative flex items-center justify-between p-3.5 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
              onClick={() => onSelectAccount(account)}
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div className="relative shrink-0">
                  {account.avatarUrl ? (
                    <img
                      src={account.avatarUrl}
                      alt={account.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-inner">
                      {getInitials(account.displayName || account.name, account.email)}
                    </div>
                  )}
                  {hasActiveToken && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {account.displayName || account.name}
                    </p>
                    {isCurrent && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {account.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {hasActiveToken ? 'Signed In' : 'Signed Out'}
                </span>
                <button
                  type="button"
                  title="Remove account"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRememberedAccount(account.email);
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}

        {/* Use another account CTA */}
        <button
          type="button"
          onClick={onUseAnotherAccount}
          className="w-full flex items-center gap-3.5 p-3.5 text-left hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors text-indigo-600 dark:text-indigo-400 font-medium text-sm group"
        >
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-indigo-300 dark:border-indigo-800 flex items-center justify-center shrink-0 group-hover:border-indigo-500 transition-colors">
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Use another account
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sign in with a different email address
            </p>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{accounts.length} active {accounts.length === 1 ? 'account' : 'accounts'}</span>
        <button
          type="button"
          onClick={() => logoutAllAccounts()}
          className="hover:text-rose-500 flex items-center gap-1 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out of all accounts
        </button>
      </div>
    </div>
  );
};
