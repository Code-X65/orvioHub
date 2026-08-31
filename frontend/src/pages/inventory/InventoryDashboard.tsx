import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { BranchSwitcher } from '@/components/workspace/BranchSwitcher';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import { BranchEditModal } from '@/components/workspace/BranchEditModal';
import { Button } from '@/components/ui/button';
import { getCrossSubdomainUrl, getLauncherUrl } from '@/lib/domain';
import { useHost } from '@/host/useHost';
import { toast } from 'sonner';
import {
  Boxes,
  LayoutGrid,
  LogOut,
  User as UserIcon,
  Settings,
  Package,
  Receipt,
  Users,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileBarChart,
  Warehouse,
  Sparkles,
  Edit2,
  PlusCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { activeBranch, branches, isLoading } = useBranchStore();
  const host = useHost();

  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isEditingBranch, setIsEditingBranch] = useState(false);

  const workspaceName = currentWorkspace?.name || 'Organization';

  const handleComingSoonAction = (featureName: string) => {
    toast.info(`${featureName} is coming soon in the next phase!`, {
      description: 'Authentication and branch management setup is active.',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#714b67] to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-[#714b67]/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-white tracking-tight text-sm">Inventory Hub</span>
                <span className="text-[10px] block text-slate-400 font-mono truncate max-w-[160px]">
                  {workspaceName}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <WorkspaceSwitcher productKey="inventory" />
              <BranchSwitcher productKey="inventory" />
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs transition-colors cursor-pointer"
              title="Organization Settings"
            >
              <Settings className="w-3.5 h-3.5 text-[#c79dbd]" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = getLauncherUrl(host.environment);
              }}
              className="border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs hidden md:flex cursor-pointer rounded-lg"
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              App Launcher
            </Button>

            <a
              href={getCrossSubdomainUrl('accounts', '/profile/personal', true, host.environment)}
              className="w-8 h-8 rounded-full bg-[#714b67] text-white text-xs font-bold flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors shadow-sm"
              title="Personal Profile"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </a>

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                window.location.href = getCrossSubdomainUrl('accounts', '/login?logged_out=true', false, host.environment);
              }}
              className="text-rose-400 hover:bg-rose-500/10 cursor-pointer rounded-lg p-2"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex-1">
        {/* EMPTY STATE: No branches found */}
        {!isLoading && branches.length === 0 ? (
          <div className="max-w-xl mx-auto py-16 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[#d4a8c9] mx-auto shadow-2xl relative">
              <Warehouse className="w-10 h-10" />
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                !
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                This organization has no branches yet
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                To start tracking inventory, assigning attendants, and ringing sales, create your first branch location for <span className="text-white font-medium">{workspaceName}</span>.
              </p>
            </div>

            <Button
              onClick={() => setIsCreatingBranch(true)}
              className="h-11 px-6 bg-[#714b67] hover:bg-[#85587a] text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#714b67]/25 cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Your First Branch</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Header: Welcome & Branch Context */}
            <div className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#714b67]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      Welcome to {activeBranch?.name || 'Main Store'}
                    </h1>
                    {activeBranch?.code && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {activeBranch.code}
                      </span>
                    )}
                    {activeBranch?.isPrimary && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        PRIMARY LOCATION
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Part of <span className="text-slate-200 font-medium">{workspaceName}</span>
                    {activeBranch?.address ? ` • ${activeBranch.address}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {activeBranch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingBranch(true)}
                      className="border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs rounded-xl h-9"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      Edit Branch
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setIsCreatingBranch(true)}
                    className="bg-[#714b67] hover:bg-[#85587a] text-white text-xs font-semibold rounded-xl h-9 shadow-md"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    New Branch
                  </Button>
                </div>
              </div>
            </div>

            {/* Demo Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {/* Stat 1: Products */}
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Products in Catalog</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  —
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  <span>Coming Soon (Phase 3)</span>
                </div>
              </div>

              {/* Stat 2: Sales Today */}
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Sales Today</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
                  ₦0
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <span>No sales recorded yet</span>
                </div>
              </div>

              {/* Stat 3: Stock Items */}
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700/80 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Stock Inventory Units</span>
                  <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/40 flex items-center justify-center">
                    <Warehouse className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  —
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <Clock className="w-3 h-3 text-[#d4a8c9]" />
                  <span>Coming Soon (Phase 3)</span>
                </div>
              </div>
            </div>

            {/* "What's Next?" Onboarding Cards */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#d4a8c9]" />
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    What's Next?
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400">Branch Onboarding Steps</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1: Add Products */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Add Products</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Start by adding your first products, categories, and barcodes to the catalog.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleComingSoonAction('Product Catalog')}
                    className="w-full text-xs border-slate-800 hover:bg-slate-800 text-slate-200 justify-between cursor-pointer"
                  >
                    <span>Add Products</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>

                {/* Step 2: Invite Staff */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/40 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Invite Staff</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Add attendants, store managers, and team members to manage this location.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/settings')}
                    className="w-full text-xs border-slate-800 hover:bg-slate-800 text-slate-200 justify-between cursor-pointer"
                  >
                    <span>Invite Staff</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>

                {/* Step 3: Record First Sale */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Record First Sale</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Complete a checkout test sale on the POS register to see how receipts work.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleComingSoonAction('POS Terminal')}
                    className="w-full text-xs border-slate-800 hover:bg-slate-800 text-slate-200 justify-between cursor-pointer"
                  >
                    <span>Record Sale</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Coming Soon Features Grid */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-300 tracking-tight">
                Upcoming Operational Modules
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Module 1 */}
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      COMING SOON
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white">Recent Sales</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Track your daily sales transactions across registers and attendant shifts.
                  </p>
                </div>

                {/* Module 2 */}
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      COMING SOON
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white">Low Stock Alerts</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Get notified in real-time when products run low at this branch location.
                  </p>
                </div>

                {/* Module 3 */}
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <FileBarChart className="w-4 h-4 text-blue-400" />
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      COMING SOON
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white">Sales Reports</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    View detailed branch analytics, gross profit margins, and peak traffic periods.
                  </p>
                </div>

                {/* Module 4 */}
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <Warehouse className="w-4 h-4 text-[#d4a8c9]" />
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/40">
                      COMING SOON
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white">Stock Management</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Manage multi-warehouse transfers, stock reconciliations, and vendor shipments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {isCreatingBranch && currentWorkspace?.id && (
        <BranchCreationModal
          isOpen={isCreatingBranch}
          workspaceId={currentWorkspace.id}
          onClose={() => setIsCreatingBranch(false)}
        />
      )}

      {isEditingBranch && activeBranch && (
        <BranchEditModal
          isOpen={isEditingBranch}
          branch={activeBranch}
          onClose={() => setIsEditingBranch(false)}
        />
      )}

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-600">
        Orviohub Platform • Inventory Branch Management
      </footer>
    </div>
  );
};
