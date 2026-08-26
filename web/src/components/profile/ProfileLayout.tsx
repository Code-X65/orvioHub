import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  User,
  Mail,
  Shield,
  Laptop,
  Activity,
  Bell,
  Sliders,
  Briefcase,
  Database,
  Trash2,
  LogOut,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ProfileLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  activeSection:
    | 'personal'
    | 'contact'
    | 'security'
    | 'sessions'
    | 'activity'
    | 'notifications'
    | 'preferences'
    | 'workspaces'
    | 'privacy'
    | 'delete';
}

const navItems = [
  {
    id: 'personal',
    label: 'Personal Information',
    path: '/profile/personal',
    icon: User,
    badge: null,
  },
  {
    id: 'contact',
    label: 'Contact & Location',
    path: '/profile/contact',
    icon: Mail,
    badge: null,
  },
  {
    id: 'security',
    label: 'Security & Login Methods',
    path: '/profile/security',
    icon: Shield,
    badge: null,
  },
  {
    id: 'sessions',
    label: 'Active Sessions',
    path: '/profile/sessions',
    icon: Laptop,
    badge: null,
  },
  {
    id: 'activity',
    label: 'Security Activity Log',
    path: '/profile/activity',
    icon: Activity,
    badge: null,
  },
  {
    id: 'notifications',
    label: 'Notification Preferences',
    path: '/profile/notifications',
    icon: Bell,
    badge: null,
  },
  {
    id: 'preferences',
    label: 'Regional & Display',
    path: '/profile/preferences',
    icon: Sliders,
    badge: null,
  },
  {
    id: 'workspaces',
    label: 'Workspace Memberships',
    path: '/profile/workspaces',
    icon: Briefcase,
    badge: null,
  },
  {
    id: 'privacy',
    label: 'Privacy & Data Export',
    path: '/profile/privacy',
    icon: Database,
    badge: 'NDPA/GDPR',
  },
  {
    id: 'delete',
    label: 'Account Deletion',
    path: '/profile/delete',
    icon: Trash2,
    badge: null,
    isDanger: true,
  },
];

export const ProfileLayout: React.FC<ProfileLayoutProps> = ({
  children,
  title,
  description,
  activeSection,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      {/* Top Universal Accounts Header */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app" className="flex items-center gap-2">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-7 h-7">
                  <circle cx="50" cy="50" r="38" stroke="white" strokeWidth="16" fill="none" />
                  <polygon points="50,50 88,12 55,28" fill="#714b67" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white tracking-tight">rivo</span>
              <span className="text-xs bg-[#714b67]/30 border border-[#714b67]/50 text-pink-200 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider ml-1">
                Accounts
              </span>
            </Link>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/workspaces')}
              className="hidden sm:inline-flex border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs"
            >
              <Briefcase className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Workspaces
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app')}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Open App Launcher
            </Button>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-white/5"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* User Identity Header Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-[#1c1219] via-black to-[#13111c] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#714b67] to-indigo-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg overflow-hidden border border-white/20">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {user?.displayName || user?.name || 'My Account'}
                </h1>
                {user?.jobTitle && (
                  <span className="text-xs bg-white/10 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                    {user.jobTitle}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 font-mono mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Central Identity Active
            </span>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Navigation Sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <nav className="space-y-1 bg-black/40 border border-white/10 rounded-2xl p-2 sticky top-24">
              <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Personal Management
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={cn(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                      isActive
                        ? 'bg-[#714b67] text-white shadow-sm'
                        : item.isDanger
                        ? 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          'w-4 h-4 transition-colors',
                          isActive
                            ? 'text-white'
                            : item.isDanger
                            ? 'text-rose-400'
                            : 'text-slate-400 group-hover:text-white'
                        )}
                      />
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={cn(
                          'w-3.5 h-3.5 transition-transform opacity-60',
                          isActive ? 'text-white translate-x-0.5' : 'text-slate-500'
                        )}
                      />
                    </div>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Right Content Panel */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="border-b border-white/10 pb-5 mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
                {description && <p className="text-xs sm:text-sm text-slate-400 mt-1">{description}</p>}
              </div>

              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
