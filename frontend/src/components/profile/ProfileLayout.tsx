import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/landing/Header';
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
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActiveProfileSection =
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

interface ProfileLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  activeSection: ActiveProfileSection;
  fullWidth?: boolean;
}

interface NavGroup {
  groupLabel?: string;
  items: {
    id: ActiveProfileSection;
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | null;
    isDanger?: boolean;
  }[];
}

const navGroups: NavGroup[] = [
  {
    groupLabel: 'Personal Account',
    items: [
      {
        id: 'personal',
        label: 'Personal Profile',
        path: '/profile/personal',
        icon: User,
      },
      {
        id: 'contact',
        label: 'Contact & Location',
        path: '/profile/contact',
        icon: Mail,
      },
      {
        id: 'security',
        label: 'Security & 2FA',
        path: '/profile/security',
        icon: Shield,
      },
      {
        id: 'sessions',
        label: 'Active Sessions',
        path: '/profile/sessions',
        icon: Laptop,
      },
      {
        id: 'activity',
        label: 'Security Activity Log',
        path: '/profile/activity',
        icon: Activity,
      },
    ],
  },
  {
    groupLabel: 'Settings & Data',
    items: [
      {
        id: 'notifications',
        label: 'Notification Preferences',
        path: '/profile/notifications',
        icon: Bell,
      },
      {
        id: 'preferences',
        label: 'Regional & Display',
        path: '/profile/preferences',
        icon: Sliders,
      },
      {
        id: 'workspaces',
        label: 'Organizations',
        path: '/profile/workspaces',
        icon: Briefcase,
      },
      {
        id: 'privacy',
        label: 'Privacy & Data Export',
        path: '/profile/privacy',
        icon: Database,
        badge: 'GDPR/NDPR',
      },
      {
        id: 'delete',
        label: 'Account Deletion',
        path: '/profile/delete',
        icon: Trash2,
        isDanger: true,
      },
    ],
  },
];

export const ProfileLayout: React.FC<ProfileLayoutProps> = ({
  children,
  title,
  description,
  activeSection,
  fullWidth = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      {/* 1. Landing Page Header */}
      <Header />

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex-1">
        {/* Mobile Navigation Toggle */}
        <div className="lg:hidden mb-4 flex items-center justify-between p-3 rounded-xs bg-[#0c070a] border border-white/10">
          <div className="text-xs font-semibold text-slate-300">
            Navigation Menu
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-slate-400 hover:text-white rounded-xs flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            {mobileMenuOpen ? (
              <>
                <X className="w-4 h-4" />
                <span>Close</span>
              </>
            ) : (
              <>
                <Menu className="w-4 h-4" />
                <span>Sections</span>
              </>
            )}
          </button>
        </div>

        {/* Content Layout Grid: Main Content First (Left), Sidebar at the End (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Main Content Panel (Left / Start) */}
          <main className={cn('lg:col-span-8 xl:col-span-9 space-y-6', fullWidth && 'lg:col-span-12')}>
            {fullWidth ? (
              children
            ) : (
              <div className="bg-[#0c070a] border border-white/10 rounded-xs p-5 sm:p-8 shadow-xl">
                <div className="border-b border-white/10 pb-4 mb-6">
                  <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
                  {description && <p className="text-xs sm:text-sm text-slate-400 mt-1">{description}</p>}
                </div>

                {children}
              </div>
            )}
          </main>

          {/* Sidebar Navigation at the End (Right) */}
          <aside
            className={cn(
              'lg:col-span-4 xl:col-span-3',
              mobileMenuOpen ? 'block' : 'hidden lg:block'
            )}
          >
            <nav className="space-y-4 bg-[#0a0508] border border-white/10 rounded-xs p-3 sticky top-24 shadow-xl">
              {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    {group.groupLabel}
                  </div>

                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 rounded-xs text-xs font-medium transition-all group',
                          isActive
                            ? 'bg-[#714b67] text-white shadow-sm font-semibold'
                            : item.isDanger
                            ? 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              'w-4 h-4 transition-colors shrink-0',
                              isActive
                                ? 'text-white'
                                : item.isDanger
                                ? 'text-rose-400'
                                : 'text-slate-400 group-hover:text-white'
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge && (
                            <span
                              className={cn(
                                'text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-xs',
                                isActive
                                  ? 'bg-black/30 text-white'
                                  : 'bg-white/10 text-slate-400'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight
                            className={cn(
                              'w-3 h-3 transition-transform opacity-60',
                              isActive ? 'text-white translate-x-0.5' : 'text-slate-600'
                            )}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
};
