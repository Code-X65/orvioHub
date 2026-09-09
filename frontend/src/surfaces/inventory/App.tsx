import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { InventoryLanding } from './pages/Landing';
import { InventoryDashboard } from '../../pages/inventory/InventoryDashboard';
import { InventoryAppOnboarding } from './pages/InventoryAppOnboarding';
import { SingleBranchConfirmation } from './pages/SingleBranchConfirmation';
import { MultiBranchSetup } from './pages/MultiBranchSetup';
import { OrganizationSettings } from '../../pages/settings/OrganizationSettings';
import { AcceptInvite } from '../../pages/auth/AcceptInvite';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { api } from '../../lib/api';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { Spinner } from '../../components/ui/spinner';

/**
 * Guard for checking whether the active workspace has the Inventory module activated.
 */
function InventoryActivationGuard({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const urlOrg = searchParams.get('org');
  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace, isLoading: isWsLoading } = useWorkspaceStore();
  const [isChecking, setIsChecking] = useState(true);

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
    const resolvedOrgId = urlOrg || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id');

    if (!resolvedOrgId) {
      if (!isWsLoading && workspaces.length === 0) {
        setIsChecking(false);
      }
      return;
    }

    if (urlOrg && currentWorkspace?.id !== urlOrg) {
      selectWorkspace(urlOrg).catch(() => {});
    }

    setIsChecking(true);

    // Safety timeout so user never hangs indefinitely
    const timeout = setTimeout(() => {
      if (isMounted) {
        setIsChecking(false);
      }
    }, 2500);

    Promise.all([
      api
        .get<{ success: boolean; data?: { active: boolean; status?: string } }>(
          `/organizations/${resolvedOrgId}/applications/inventory/status`
        )
        .catch(() => null),
      api
        .get<{ completed: boolean }>(`/organizations/${resolvedOrgId}/inventory-onboarding`)
        .catch(() => null),
    ])
      .then(async ([activeRes, onboardRes]) => {
        if (!isMounted) return;
        if (!activeRes?.data || !activeRes.data.active) {
          // Auto-activate application under the organization's subscription
          try {
            await api.post(`/organizations/${resolvedOrgId}/applications/inventory/activate`, {});
          } catch {}
        }
        setHasCompletedOnboarding(Boolean(onboardRes?.completed ?? true));
      })
      .catch(() => {
        if (!isMounted) return;
        setHasCompletedOnboarding(true);
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

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Verifying application access...</p>
      </div>
    );
  }

  const effectiveOrgId = urlOrg || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id');

  if (!effectiveOrgId) {
    window.location.href = getCrossSubdomainUrl('home', '/dashboard');
    return null;
  }

  if (hasCompletedOnboarding === false) {
    return <Navigate to={`/onboard/app?org=${effectiveOrgId}`} replace />;
  }

  return <>{children}</>;
}

export default function InventoryApp() {
  return (
    <Routes>
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

      {/* 2. Authenticated Application Dashboard & Operations (Guarded with Activation Check) */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard/*"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      {/* 3. Application Activation & Onboarding Wizard Flows (US-A2, US-3, US-4A, US-4B) */}
      <Route
        path="/onboard/activate"
        element={<Navigate to="/onboard/app" replace />}
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
      <Route path="/onboard" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboard/*" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding/*" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding/inventory" element={<Navigate to="/onboard/app" replace />} />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <OrganizationSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/organization/settings"
        element={
          <AuthGuard>
            <OrganizationSettings />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
