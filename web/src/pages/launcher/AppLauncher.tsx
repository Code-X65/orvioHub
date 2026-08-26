import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Plus,
  ArrowRight,
  LogOut,
  Settings,
  Users,
  CreditCard,
  Layers,
  Search,
  ChevronDown,
  Warehouse,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAppUrl, isLocalhost, ProductApp } from '@/lib/domain';

interface WorkspaceItem {
  workspace: {
    id: string;
    name: string;
    slug: string;
    type?: string;
    currency?: string;
  };
  role: string;
  enabledProducts: Array<{ productKey: string; status: string }>;
}

interface ProductItem {
  key: string;
  name: string;
  tagline: string;
  category: 'operations' | 'finance' | 'sales' | 'productivity';
  isProductionReady: boolean;
  badge?: string;
  appRoute: string;
  onboardingRoute: string;
  icon: React.ReactNode;
}

const APPS_CATALOG: ProductItem[] = [
  {
    key: 'inventory',
    name: 'Inventory & POS',
    tagline: 'Multi-branch warehouse stock, barcode POS checkout, receipts & telemetry.',
    category: 'operations',
    isProductionReady: true,
    badge: 'Production Ready',
    appRoute: '/inventory/dashboard',
    onboardingRoute: '/inventory/onboarding',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <rect x="18" y="24" width="12" height="16" rx="2" fill="#F59E0B" />
        <rect x="34" y="24" width="12" height="16" rx="2" fill="#06B6D4" />
        <polygon points="26,20 22,24 26,28" fill="#F59E0B" />
        <polygon points="38,36 42,40 38,44" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    key: 'taskmanagement',
    name: 'Task Management',
    tagline: 'Agile sprints, Kanban team delegation, automated task tracking & milestones.',
    category: 'productivity',
    isProductionReady: false,
    badge: 'Beta',
    appRoute: '/tasks/dashboard',
    onboardingRoute: '/tasks/onboarding',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <path d="M18 34 L 28 44 L 46 22" fill="none" stroke="#06B6D4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 38 L 28 44 L 38 30" fill="none" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'accounting',
    name: 'Accounting',
    tagline: 'Automated double-entry bookkeeping, multi-currency tax & instant P&L.',
    category: 'finance',
    isProductionReady: false,
    badge: 'Coming Soon',
    appRoute: '/app/accounting',
    onboardingRoute: '/app/accounting',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <circle cx="27" cy="24" r="10" fill="#F59E0B" />
        <circle cx="39" cy="40" r="10" fill="#14B8A6" />
        <rect x="26" y="6" width="12" height="52" rx="6" fill="#935a87" transform="rotate(45 32 32)" />
      </svg>
    ),
  },
  {
    key: 'crm',
    name: 'CRM & Pipeline',
    tagline: 'Visual deal pipeline, customer interaction history & lead scoring.',
    category: 'sales',
    isProductionReady: false,
    badge: 'Coming Soon',
    appRoute: '/app/crm',
    onboardingRoute: '/app/crm',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <path d="M14 26 L28 40 L36 32 L22 18 Z" fill="#14B8A6" />
        <path d="M50 26 L36 40 L28 32 L42 18 Z" fill="#EC4899" />
        <circle cx="32" cy="36" r="4.5" fill="#935a87" />
      </svg>
    ),
  },
  {
    key: 'sign',
    name: 'Sign & Approvals',
    tagline: 'Cryptographic digital signatures & multi-party document approval flows.',
    category: 'productivity',
    isProductionReady: false,
    badge: 'Coming Soon',
    appRoute: '/app/sign',
    onboardingRoute: '/app/sign',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <path
          d="M17 41 C 19 27, 26 19, 33 19 C 37 19, 37 27, 30 35 C 26 41, 22 43, 34 43 C 44 43, 47 37, 47 33"
          fill="none"
          stroke="#06B6D4"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="38" y1="35" x2="47" y2="35" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'timesheets',
    name: 'Timesheets & HR',
    tagline: 'Stopwatch timer, employee attendance & billable project rates.',
    category: 'productivity',
    isProductionReady: false,
    badge: 'Coming Soon',
    appRoute: '/app/timesheets',
    onboardingRoute: '/app/timesheets',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <circle cx="32" cy="34" r="16" stroke="#0284C7" strokeWidth="4" fill="#0C1B2A" />
        <line x1="32" y1="34" x2="42" y2="24" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="34" r="2.5" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    key: 'studio',
    name: 'Studio',
    tagline: 'No-code custom fields, automated workflow triggers & report builder.',
    category: 'operations',
    isProductionReady: false,
    badge: 'Coming Soon',
    appRoute: '/app/studio',
    onboardingRoute: '/app/studio',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <path d="M18 18 L46 46 M46 18 L18 46" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
        <circle cx="18" cy="18" r="5" fill="#06B6D4" />
        <circle cx="46" cy="46" r="5" fill="#EC4899" />
        <circle cx="46" cy="18" r="5" fill="#06B6D4" />
        <circle cx="18" cy="46" r="5" fill="#EC4899" />
      </svg>
    ),
  },
  {
    key: 'subscriptions',
    name: 'Subscriptions & Billing',
    tagline: 'Recurring subscription billing cycles, customer dunning & MRR telemetry.',
    category: 'finance',
    isProductionReady: false,
    badge: 'Coming Soon',
    appRoute: '/app/subscriptions',
    onboardingRoute: '/app/subscriptions',
    icon: (
      <svg viewBox="0 0 64 64" className="w-10 h-10">
        <path d="M20 32 A 12 12 0 0 1 38 22" fill="none" stroke="#F97316" strokeWidth="5" strokeLinecap="round" />
        <circle cx="38" cy="22" r="3.5" fill="#F97316" />
        <path d="M44 32 A 12 12 0 0 1 26 42" fill="none" stroke="#10B981" strokeWidth="5" strokeLinecap="round" />
        <circle cx="26" cy="42" r="3.5" fill="#10B981" />
      </svg>
    ),
  },
];

export const AppLauncher: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceIndex, setActiveWorkspaceIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'apps' | 'branches' | 'settings' | 'team' | 'billing'>('apps');

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get<{ workspaces: WorkspaceItem[] }>('/workspaces');
      setWorkspaces(res.workspaces || []);
    } catch (err: any) {
      toast.error('Failed to load workspaces.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const activeWorkspace = workspaces[activeWorkspaceIndex]?.workspace;
  const enabledProductKeys = new Set(
    workspaces[activeWorkspaceIndex]?.enabledProducts?.map((p) => p.productKey) || ['inventory']
  );

  const filteredApps = APPS_CATALOG.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'active' && enabledProductKeys.has(app.key)) ||
      app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-black text-slate-100 flex overflow-hidden">
      {/* 1. Sleek Left Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0508] border-r border-white/5 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-0 max-lg:-translate-x-full'
        )}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-white/5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group focus:outline-none">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-7 h-7">
                  <circle cx="50" cy="50" r="38" stroke="white" strokeWidth="16" fill="none" />
                  <polygon points="50,50 88,12 55,28" fill="#714b67" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white tracking-tight ml-0.5 font-sans">
                rivo
              </span>
            </Link>

            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-white lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workspace Switcher */}
          <div className="p-4 border-b border-white/5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 px-1">
              Active Workspace
            </div>

            {workspaces.length > 0 ? (
              <div className="relative">
                <select
                  value={activeWorkspaceIndex}
                  onChange={(e) => setActiveWorkspaceIndex(Number(e.target.value))}
                  className="w-full h-10 pl-3 pr-8 rounded-xs bg-[#160f14] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-[#714b67] cursor-pointer appearance-none truncate"
                >
                  {workspaces.map((w, idx) => (
                    <option key={w.workspace.id} value={idx} className="bg-[#120b10] text-white">
                      {w.workspace.name} ({w.role})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-[#160f14] p-2.5 rounded-xs border border-white/5">
                Default Workspace
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/welcome')}
              className="w-full mt-2 h-8 bg-transparent hover:bg-white/5 border-white/10 hover:border-white/20 text-slate-300 text-xs rounded-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Workspace</span>
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('apps')}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs transition-colors text-left cursor-pointer',
                activeTab === 'apps'
                  ? 'bg-[#714b67] text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <Layers className="w-4 h-4" />
              <span>App Directory</span>
              <span className="ml-auto text-[10px] bg-black/40 px-1.5 py-0.5 rounded-xs">
                {enabledProductKeys.size} Active
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('branches');
                navigate('/inventory/dashboard');
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs transition-colors text-left cursor-pointer',
                activeTab === 'branches'
                  ? 'bg-[#714b67] text-white font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <Warehouse className="w-4 h-4" />
              <span>Branches & Stock</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('team');
                navigate('/settings/profile');
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs transition-colors text-left cursor-pointer',
                activeTab === 'team'
                  ? 'bg-[#714b67] text-white font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <Users className="w-4 h-4" />
              <span>Team & Roles</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('billing');
                navigate('/pricing');
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs transition-colors text-left cursor-pointer',
                activeTab === 'billing'
                  ? 'bg-[#714b67] text-white font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <CreditCard className="w-4 h-4" />
              <span>Plans & Invoicing</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                navigate('/settings/profile');
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs transition-colors text-left cursor-pointer',
                activeTab === 'settings'
                  ? 'bg-[#714b67] text-white font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <Settings className="w-4 h-4" />
              <span>Workspace Settings</span>
            </button>
          </nav>
        </div>

        {/* User Card Bottom */}
        <div className="p-3 border-t border-white/5 bg-[#080407]">
          <div className="flex items-center justify-between p-2 rounded-xs bg-[#120b10] border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#714b67] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate leading-tight">
                  {user?.name || 'Account'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user?.email || 'admin@orvio.io'}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <header className="h-16 border-b border-white/5 bg-black/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-white lg:hidden rounded-xs"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Workspace /</span>
              <span className="font-semibold text-white">
                {activeWorkspace?.name || 'My Business Workspace'}
              </span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-xs font-medium ml-1">
                14-Day Free Trial
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => navigate('/inventory/dashboard')}
              className="h-8 px-3 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Launch Inventory</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </header>

        {/* Content Container */}
        <main className="p-6 sm:p-8 max-w-6xl w-full mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Apps & Workflows
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Choose what applications run in this workspace. All data is unified in real-time.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Apps' },
                { id: 'active', label: 'Active in Workspace' },
                { id: 'operations', label: 'Operations' },
                { id: 'finance', label: 'Finance' },
                { id: 'productivity', label: 'Productivity' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xs text-xs font-medium transition-colors cursor-pointer',
                    selectedCategory === c.id
                      ? 'bg-[#714b67] text-white font-semibold'
                      : 'bg-[#160f14] hover:bg-[#20151c] text-slate-300 border border-white/5'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps, modules, workflows..."
              className="pl-10 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
            />
          </div>

          {/* Apps Cards Grid */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Spinner size="default" className="text-[#714b67]" />
              <p className="text-xs">Loading workspace applications...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => {
                const isEnabled = enabledProductKeys.has(app.key) || app.key === 'inventory';

                return (
                  <div
                    key={app.key}
                    className={cn(
                      'p-5 rounded-sm border transition-all flex flex-col justify-between relative group',
                      isEnabled
                        ? 'bg-[#120b10] border-white/10 shadow-lg'
                        : 'bg-[#0c070a] border-white/5 opacity-85'
                    )}
                  >
                    <div>
                      {/* Card Top */}
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="w-12 h-12 rounded-sm bg-[#080407] border border-white/10 flex items-center justify-center p-2 shadow-inner">
                          {app.icon}
                        </div>

                        {app.badge && (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-xs',
                              app.isProductionReady
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                                : 'bg-[#251521] text-[#c79dbd] border border-[#44253b]'
                            )}
                          >
                            {app.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white group-hover:text-[#c79dbd] transition-colors">
                        {app.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {app.tagline}
                      </p>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      {app.isProductionReady ? (
                        <Button
                          onClick={() => {
                            if (isLocalhost()) {
                              navigate(app.appRoute);
                            } else {
                              window.location.href = getAppUrl(app.key as ProductApp, '/dashboard');
                            }
                          }}
                          className="w-full h-9 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Launch App</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 font-medium">Coming soon</span>
                          <button
                            type="button"
                            onClick={() => toast.success(`Added ${app.name} to beta notification queue!`)}
                            className="text-[11px] text-[#c79dbd] hover:text-white font-semibold transition-colors cursor-pointer"
                          >
                            Notify me →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
