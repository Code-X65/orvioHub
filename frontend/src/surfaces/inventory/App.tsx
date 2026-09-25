import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { InventoryLanding } from './pages/Landing';
import { InventoryLayout } from '@/layouts/InventoryLayout';
import { InventoryDashboard } from '../../pages/inventory/InventoryDashboard';
import { InventoryAppOnboarding } from './pages/InventoryAppOnboarding';
import { SingleBranchConfirmation } from './pages/SingleBranchConfirmation';
import { MultiBranchSetup } from './pages/MultiBranchSetup';
import { InventorySetupWizard } from './pages/InventorySetupWizard';
import { InventorySettingsPage } from '../../pages/settings/InventorySettingsPage';
import { BranchSettingsPage } from '../../pages/settings/BranchSettingsPage';
import { WorkspaceSettingsPage } from '../../pages/settings/WorkspaceSettingsPage';
import { WorkspaceMembers } from '../../pages/settings/WorkspaceMembers';
import { WorkspaceInvitationsPage } from '../../pages/workspaces/WorkspaceInvitationsPage';
import {
  ProductsCatalogPage,
  SalesPOSPage,
  StockTransfersPage,
  ReportsAnalyticsPage,
} from '../../pages/inventory/InventoryDemoViews';
import { AcceptInvite } from '../../pages/auth/AcceptInvite';
import { FirstRunGuard } from '../../components/workspace/FirstRunGuard';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { getCrossSubdomainUrl, getLoginUrl, getSignupUrl, getAccountsUrl } from '@/lib/domain';
import { getCrossSubdomainItem } from '@/lib/cookieStorage';
import { crossSubdomainNavigate } from '@/lib/crossSubdomainNavigate';

function RedirectToLogin() {
  useEffect(() => {
    const query = window.location.search;
    const base = getLoginUrl();
    const delimiter = base.includes('?') ? '&' : '?';
    crossSubdomainNavigate(query ? `${base}${delimiter}${query.replace(/^\?/, '')}` : base);
  }, []);
  return null;
}

function RedirectToSignup() {
  useEffect(() => {
    const query = window.location.search;
    const base = getSignupUrl();
    const delimiter = base.includes('?') ? '&' : '?';
    crossSubdomainNavigate(query ? `${base}${delimiter}${query.replace(/^\?/, '')}` : base);
  }, []);
  return null;
}

function RedirectToAccounts() {
  useEffect(() => {
    crossSubdomainNavigate(`${getAccountsUrl()}${window.location.pathname}${window.location.search}`);
  }, []);
  return null;
}

/**
 * Guard for checking whether the active workspace has the Inventory module activated.
 */
const inFlightActivationChecks = new Map<string, Promise<[any, any, any]>>();

function InventoryActivationGuard({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const urlOrg = searchParams.get('org');
  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace, isLoading: isWsLoading } = useWorkspaceStore();

  const [isChecking, setIsChecking] = useState(true);
  const [isAppInactive, setIsAppInactive] = useState(false);
  const [isAppForbidden, setIsAppForbidden] = useState(false);
  const [isAppError, setIsAppError] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  // 1. Ensure workspaces are loaded on initial subdomain visit
  useEffect(() => {
    if (workspaces.length === 0 && !isWsLoading) {
      fetchWorkspaces('inventory').catch(() => {});
    }
  }, [workspaces.length, isWsLoading, fetchWorkspaces]);

  // 2. Check activation status & onboarding once workspace is identified
  useEffect(() => {
    let isMounted = true;
    const resolvedOrgId = urlOrg || currentWorkspace?.id || getCrossSubdomainItem('orvio_active_workspace_id');

    if (!resolvedOrgId) {
      if (!isWsLoading && workspaces.length === 0) {
        setIsChecking(false);
      }
      return;
    }

    if (urlOrg && currentWorkspace?.id !== urlOrg) {
      selectWorkspace(urlOrg).catch(() => {});
    }

    // Safety timeout so user never hangs indefinitely
    const timeout = setTimeout(() => {
      if (isMounted) {
        setIsChecking(false);
      }
    }, 2000);

    let checkPromise = inFlightActivationChecks.get(resolvedOrgId);
    if (!checkPromise) {
      checkPromise = api
        .get<{
          success: boolean;
          data: {
            active: boolean;
            status?: string;
            onboardingCompleted: boolean;
            access: { allowed: boolean; reason?: string };
          };
        }>(`/organizations/${resolvedOrgId}/applications/inventory/status`)
        .then((res: any) => {
          const data = res?.data || res;
          return [
            { data: { active: data?.active, status: data?.status } },
            { completed: data?.onboardingCompleted },
            { data: { allowed: data?.access?.allowed, reason: data?.access?.reason } },
          ] as [any, any, any];
        })
        .catch(() => null as any);
      inFlightActivationChecks.set(resolvedOrgId, checkPromise);
      checkPromise.finally(() => {
        setTimeout(() => inFlightActivationChecks.delete(resolvedOrgId), 5000);
      });
    }

    checkPromise
      .then(async ([activeRes, onboardRes, accessRes]) => {
        if (!isMounted) return;

        // Check RBAC permission first
        if (accessRes?.data && accessRes.data.allowed === false) {
          setIsAppForbidden(true);
        } else {
          setIsAppForbidden(false);
        }

        // Check app activation status — server-returned state only, never inferred
        if (activeRes?.data && !activeRes.data.active) {
          setIsAppInactive(true);
        } else if (activeRes?.data && activeRes.data.active) {
          setIsAppInactive(false);
        }

        const isCompleted = Boolean(onboardRes?.completed || (onboardRes as any)?.data?.completed);
        setHasCompletedOnboarding(isCompleted);
        setIsAppError(false);
      })
      .catch(() => {
        if (!isMounted) return;
        // Distinct error state — do NOT fall through to onboarding-incomplete behavior
        setIsAppError(true);
        setHasCompletedOnboarding(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (isMounted) {
          setIsChecking(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [urlOrg, currentWorkspace?.id, isWsLoading, workspaces.length, selectWorkspace]);

  const effectiveOrgId = urlOrg || currentWorkspace?.id || getCrossSubdomainItem('orvio_active_workspace_id');

  if (!effectiveOrgId && !isWsLoading && workspaces.length === 0) {
    crossSubdomainNavigate(getCrossSubdomainUrl('home', '/dashboard'));
    return null;
  }

  // Always verify against the server; never infer activation from store state alone
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAppError) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#714b67] selection:text-white">
        <div className="max-w-md w-full bg-[#120a11] border border-amber-500/30 rounded-sm p-6 sm:p-8 shadow-2xl text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
            <span className="text-xl sm:text-2xl font-bold">⚠️</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-sm border border-amber-500/20 uppercase tracking-wider">
              Connection Error
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Could Not Verify Application Status
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              We couldn't reach the server to confirm whether Inventory is active for{' '}
              <span className="text-slate-200 font-semibold">{currentWorkspace?.name || 'this organization'}</span>.
              Please check your connection and try again.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsChecking(true);
                setIsAppError(false);
                inFlightActivationChecks.delete(effectiveOrgId);
              }}
              className="w-full sm:flex-1 h-10 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold flex items-center justify-center shadow-lg shadow-[#714b67]/25 transition-all"
            >
              Retry
            </button>
            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="w-full sm:flex-1 h-10 rounded-sm border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center transition-all"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isAppForbidden) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#714b67] selection:text-white">
        <div className="max-w-md w-full bg-[#120a11] border border-rose-500/30 rounded-sm p-6 sm:p-8 shadow-2xl text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-lg">
            <span className="text-xl sm:text-2xl font-bold">🔒</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-sm border border-rose-500/20 uppercase tracking-wider">
              Access Restricted
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Permission Required
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              You do not have permission to access the Inventory module in{' '}
              <span className="text-slate-200 font-semibold">{currentWorkspace?.name || 'this organization'}</span>.
              Please ask your organization owner or administrator to grant you access.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="w-full sm:flex-1 h-10 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold flex items-center justify-center shadow-lg shadow-[#714b67]/25 transition-all"
            >
              All Organizations
            </a>
            <a
              href={getCrossSubdomainUrl('home', '/workplace')}
              className="w-full sm:flex-1 h-10 rounded-sm border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center transition-all"
            >
              Workplace Hub
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isAppInactive) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#714b67] selection:text-white">
        <div className="max-w-md w-full bg-[#120a11] border border-[#714b67]/30 rounded-sm p-6 sm:p-8 shadow-2xl text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#FDB02F] shadow-lg">
            <span className="text-xl sm:text-2xl font-bold">📦</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-sm border border-amber-500/20 uppercase tracking-wider">
              Application Inactive
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Inventory Is Deactivated
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              The Inventory application is currently deactivated for{' '}
              <span className="text-slate-200 font-semibold">{currentWorkspace?.name || 'this organization'}</span>.
              An administrator can reactivate it in Organization Applications.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <a
              href={getCrossSubdomainUrl('home', '/workplace')}
              className="w-full sm:flex-1 h-10 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold flex items-center justify-center shadow-lg shadow-[#714b67]/25 transition-all"
            >
              Workplace Hub
            </a>
            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="w-full sm:flex-1 h-10 rounded-sm border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center transition-all"
            >
              All Organizations
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (hasCompletedOnboarding === false) {
    return <Navigate to={`/onboard/app?org=${effectiveOrgId}`} replace />;
  }

  return <>{children}</>;
}

export default function InventoryApp() {
  return (
    <Routes>
      <Route path="/signup" element={<RedirectToSignup />} />
      <Route path="/login" element={<RedirectToLogin />} />
      <Route path="/verify-email" element={<RedirectToAccounts />} />
      <Route path="/verify-email/:token" element={<RedirectToAccounts />} />
      <Route path="/reset-password" element={<RedirectToAccounts />} />
      <Route path="/invite" element={<AcceptInvite />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />

      {/* 1. Public Inventory Landing & Feature Showcase */}
      <Route path="/" element={<InventoryLanding />} />
      <Route path="/features" element={<InventoryLanding />} />
      <Route path="/pricing" element={<InventoryLanding />} />
      <Route path="/preview" element={<InventoryLanding />} />
      <Route path="/overview" element={<InventoryLanding />} />

      {/* 2. Authenticated Inventory Operations Wrapped in InventoryLayout with Primary Sidebar */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <InventoryDashboard />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <InventoryDashboard />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <InventoryDashboard />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <InventoryDashboard />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard/*"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <InventoryDashboard />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />

      {/* 3. Demo Navigation Views */}
      <Route
        path="/inventory/products"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <ProductsCatalogPage />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/sales"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <SalesPOSPage />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/stock"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <StockTransfersPage />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/reports"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <FirstRunGuard>
                <InventoryLayout>
                  <ReportsAnalyticsPage />
                </InventoryLayout>
              </FirstRunGuard>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/settings/branch"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryLayout>
                <BranchSettingsPage />
              </InventoryLayout>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/settings/branches/:branchId"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryLayout>
                <BranchSettingsPage />
              </InventoryLayout>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />

      {/* 4. Application Activation & Onboarding Wizard */}
      <Route
        path="/setup"
        element={
          <AuthGuard>
            <InventoryAppOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/setup/*"
        element={
          <AuthGuard>
            <InventoryAppOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/activate"
        element={
          <AuthGuard>
            <InventoryAppOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/app"
        element={
          <AuthGuard>
            <InventoryAppOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/branch-single"
        element={
          <AuthGuard>
            <SingleBranchConfirmation />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/branch-multi"
        element={
          <AuthGuard>
            <MultiBranchSetup />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/inventory"
        element={
          <AuthGuard>
            <InventorySetupWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/inventory/*"
        element={
          <AuthGuard>
            <InventorySetupWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/first-sale"
        element={
          <AuthGuard>
            <InventorySetupWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/onboarding"
        element={
          <AuthGuard>
            <InventorySetupWizard />
          </AuthGuard>
        }
      />
      <Route path="/onboard" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboard/*" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding" element={<Navigate to="/onboard/inventory" replace />} />
      <Route path="/onboarding/*" element={<Navigate to="/onboard/inventory" replace />} />

      {/* 5. Inventory & Branch Settings */}
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchSettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branches"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchSettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branches/:branchId"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchSettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/products"
        element={
          <AuthGuard>
            <InventoryLayout>
              <InventorySettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/stock"
        element={
          <AuthGuard>
            <InventoryLayout>
              <InventorySettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/sales"
        element={
          <AuthGuard>
            <InventoryLayout>
              <InventorySettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/receipts"
        element={
          <AuthGuard>
            <InventoryLayout>
              <InventorySettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />

      {/* 6. Organization Settings Bridges */}
      <Route
        path="/settings/general"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/organization"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/workspace"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/organization/settings"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/members"
        element={
          <AuthGuard>
            <WorkspaceMembers />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/team"
        element={
          <AuthGuard>
            <WorkspaceMembers />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/invitations"
        element={
          <AuthGuard>
            <WorkspaceInvitationsPage />
          </AuthGuard>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
