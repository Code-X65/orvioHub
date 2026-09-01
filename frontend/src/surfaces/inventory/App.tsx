import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { InventoryLanding } from './pages/Landing';
import { ProductNotActivated } from './components/ProductNotActivated';
import { InventoryDashboard } from '../../pages/inventory/InventoryDashboard';
import { InventoryOnboarding } from '../../pages/inventory/InventoryOnboarding';
import { OrganizationSettings } from '../../pages/settings/OrganizationSettings';
import { AcceptInvite } from '../../pages/auth/AcceptInvite';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui/spinner';

/**
 * Guard for checking whether the active workspace has the Inventory module activated.
 */
function InventoryActivationGuard({ children }: { children: React.ReactNode }) {
  const { currentWorkspace, workspaces, products, fetchWorkspaces, isLoading: isWsLoading } = useWorkspaceStore();
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // 1. Ensure workspaces are loaded on initial subdomain visit
  useEffect(() => {
    if (workspaces.length === 0 && !isWsLoading) {
      fetchWorkspaces('inventory').catch(() => {});
    }
  }, [workspaces.length, isWsLoading, fetchWorkspaces]);

  // 2. Check activation status once workspace is identified
  useEffect(() => {
    const wsId = currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id');

    if (!wsId) {
      if (!isWsLoading && workspaces.length === 0) {
        setIsActivated(false);
        setIsChecking(false);
      }
      return;
    }

    // Check in-store products
    const hasActiveInventoryInStore = products.some(
      (p) => p.key === 'inventory' && (p.status === 'active' || p.status === 'trial')
    );

    if (hasActiveInventoryInStore) {
      setIsActivated(true);
      setIsChecking(false);
      return;
    }

    // Query backend is-active check
    setIsChecking(true);
    api
      .get<{ isActive: boolean }>(`/workspaces/${wsId}/products/inventory/is-active`)
      .then((res) => {
        setIsActivated(Boolean(res?.isActive));
      })
      .catch(() => {
        // Fallback default: active
        setIsActivated(true);
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, [currentWorkspace?.id, products, isWsLoading, workspaces.length]);

  if (isChecking || (isWsLoading && !currentWorkspace)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Verifying application access...</p>
      </div>
    );
  }

  if (isActivated === false) {
    return (
      <ProductNotActivated
        productKey="inventory"
        onActivated={() => {
          setIsActivated(true);
        }}
      />
    );
  }

  return <>{children}</>;
}

export default function InventoryApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
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
      <Route
        path="/onboarding"
        element={
          <AuthGuard>
            <InventoryOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/inventory"
        element={
          <AuthGuard>
            <InventoryOnboarding />
          </AuthGuard>
        }
      />
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
