import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { crossSubdomainNavigate } from '@/lib/crossSubdomainNavigate';
import { Spinner } from '@/components/ui/spinner';

interface GuardState {
  workspaceReady: boolean;
  appActivated: boolean;
  branchCreated: boolean;
  catalogPopulated: boolean;
  checking: boolean;
}

const EMPTY_STATE: GuardState = {
  workspaceReady: false,
  appActivated: false,
  branchCreated: false,
  catalogPopulated: false,
  checking: true,
};

/**
 * FirstRunGuard intercepts entry into inventory dashboard surfaces when the
 * workspace is in an incomplete state. Instead of rendering a blank dashboard,
 * it redirects to a contextual setup card that surfaces the next missing step.
 *
 * This guards against the "empty org + no app + no branch" dead-end state.
 */
export const FirstRunGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlOrg = searchParams.get('org');

  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace, isLoading: isWsLoading } =
    useWorkspaceStore();
  const { branches, loadBranches } = useBranchStore();

  const [state, setState] = useState<GuardState>(EMPTY_STATE);

  // 1. Ensure workspaces are loaded
  useEffect(() => {
    if (workspaces.length === 0 && !isWsLoading) {
      fetchWorkspaces('inventory').catch(() => {});
    }
  }, [workspaces.length, isWsLoading, fetchWorkspaces]);

  // 2. Resolve active org and check activation + onboarding
  useEffect(() => {
    let isMounted = true;
    const resolvedOrgId = urlOrg || currentWorkspace?.id;

    if (!resolvedOrgId) {
      if (!isWsLoading && workspaces.length === 0) {
        // No org at all — send back to launcher
        crossSubdomainNavigate(getCrossSubdomainUrl('home', '/dashboard'));
        return;
      }
      // Org exists but none selected — pick first
      if (workspaces.length > 0) {
        selectWorkspace(workspaces[0].workspace.id).catch(() => {});
      }
      return;
    }

    if (urlOrg && currentWorkspace?.id !== urlOrg) {
      selectWorkspace(urlOrg).catch(() => {});
    }

    const check = async () => {
      try {
        const [statusRes] = await Promise.all([
          api.get<any>(`/organizations/${resolvedOrgId}/applications/inventory/status`).catch(() => null),
          loadBranches(resolvedOrgId, 'inventory').catch(() => null),
        ]);

        if (!isMounted) return;

        const status = statusRes?.data || statusRes;
        const appActive = Boolean(status?.active);
        const onboardDone = Boolean(status?.onboardingCompleted);

        setState({
          workspaceReady: true,
          appActivated: appActive,
          branchCreated: (branches || []).length > 0,
          catalogPopulated: onboardDone,
          checking: false,
        });
      } catch {
        if (isMounted) {
          setState((prev) => ({ ...prev, checking: false }));
        }
      }
    };

    // Safety timeout
    const timeout = setTimeout(() => {
      if (isMounted) {
        setState((prev) => ({ ...prev, checking: false }));
      }
    }, 3000);

    check();
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOrg, currentWorkspace?.id, isWsLoading, workspaces.length]);

  // 3. Redirect logic — only when we have a definitive answer
  useEffect(() => {
    if (state.checking) return;
    if (!state.workspaceReady) return;

    // If app not activated, redirect to app activation page
    if (!state.appActivated) {
      const target = `/orgs/${urlOrg || currentWorkspace?.id}/apps`;
      navigate(target, { replace: true });
      return;
    }

    // If app activated but no branch, redirect to branch setup
    if (!state.branchCreated) {
      navigate(`/onboard/branch-multi?org=${urlOrg || currentWorkspace?.id}`, { replace: true });
      return;
    }

    // If branch exists but catalog not populated, redirect to catalog onboarding
    if (!state.catalogPopulated) {
      navigate(`/onboard/app?org=${urlOrg || currentWorkspace?.id}&step=5`, { replace: true });
      return;
    }

    // All clear — render children
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, navigate, urlOrg, currentWorkspace?.id]);

  if (state.checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Spinner size="lg" className="text-[#714b67]" />
      </div>
    );
  }

  // If all checks pass, render the wrapped component
  if (state.workspaceReady && state.appActivated && state.branchCreated && state.catalogPopulated) {
    return <>{children}</>;
  }

  // Should not reach here because redirects fire first, but render a fallback
  return null;
};

export default FirstRunGuard;