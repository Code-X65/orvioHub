import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';

export interface WorkspaceContextValue {
  workspace: any | null;
  role: string;
  isOwner: boolean;
  isAdmin: boolean;
  isOwnerOrAdmin: boolean;
  permissions: string[];
  hasPermission: (perm: string) => boolean;
  branches: any[];
  currentBranch: any | null;
  setCurrentBranch: (branch: any) => void;
  applications: any[];
  isInventoryActive: boolean;
  isLoading: boolean;
  refreshWorkspaceContext: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const WorkspaceContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const [branches, setBranches] = useState<any[]>([]);
  const [currentBranch, setCurrentBranch] = useState<any | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeMembership = useMemo(() => {
    return memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  }, [memberships, activeOrganizationId]);

  const role = (activeMembership?.role || 'MEMBER').toUpperCase();
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';
  const isOwnerOrAdmin = isOwner || isAdmin;

  const refreshWorkspaceContext = async () => {
    const wsId = activeOrganizationId || currentWorkspace?.id;
    if (!wsId) return;

    setIsLoading(true);
    try {
      const [appRes, branchRes, permRes] = await Promise.all([
        api.get<{ data: any[] }>(`/workspaces/${wsId}/applications`).catch(() => ({ data: [] })),
        api.get<{ data: any[] }>(`/workspaces/${wsId}/inventory/branches`).catch(() => ({ data: [] })),
        api.get<{ data: any }>(`/workspaces/${wsId}/entitlements`).catch(() => ({ data: null })),
      ]);

      const appsList = appRes.data || [];
      const branchList = branchRes.data || [];
      setApplications(appsList);
      setBranches(branchList);

      if (branchList.length > 0 && !currentBranch) {
        const primary = branchList.find((b: any) => b.isPrimary) || branchList[0];
        setCurrentBranch(primary);
      }

      if (isOwnerOrAdmin) {
        setPermissions(['*']);
      } else {
        setPermissions(permRes.data?.permissions || ['inventory.view', 'inventory.view_stock']);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkspaceContext();
  }, [activeOrganizationId, currentWorkspace?.id]);

  const hasPerm = (perm: string): boolean => {
    if (isOwnerOrAdmin) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(perm);
  };

  const isInventoryActive = useMemo(() => {
    const inv = applications.find((a) => a.key === 'inventory');
    return !!inv && (inv.status === 'active' || inv.status === 'setup_incomplete' || inv.enabled);
  }, [applications]);

  const value: WorkspaceContextValue = {
    workspace: currentWorkspace || activeMembership?.organization || null,
    role,
    isOwner,
    isAdmin,
    isOwnerOrAdmin,
    permissions,
    hasPermission: hasPerm,
    branches,
    currentBranch,
    setCurrentBranch,
    applications,
    isInventoryActive,
    isLoading,
    refreshWorkspaceContext,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceContextProvider');
  }
  return ctx;
}
