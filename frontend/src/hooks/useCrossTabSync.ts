import { useEffect } from 'react';
import { crossTabSync } from '@/lib/crossTabSync';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getCrossSubdomainItem } from '@/lib/cookieStorage';

/**
 * Hook to automatically synchronize application state across open browser tabs.
 */
export function useCrossTabSync() {
  useEffect(() => {
    // 1. Sync workspace changes from other tabs
    const unsubWs = crossTabSync.subscribe('WORKSPACE_CHANGED', (msg) => {
      const targetWsId = msg.payload?.workspaceId;
      const currentWsId = useWorkspaceStore.getState().currentWorkspace?.id;

      if (targetWsId && targetWsId !== currentWsId) {
        // Load context without full page reload
        useWorkspaceStore.getState().loadWorkspaceContext(targetWsId);
        useBranchStore.getState().loadBranches(targetWsId, undefined, true);
      }
    });

    // 2. Sync branch selection from other tabs
    const unsubBranch = crossTabSync.subscribe('BRANCH_CHANGED', (msg) => {
      const targetBranchId = msg.payload?.branchId;
      const branches = useBranchStore.getState().branches;
      const target = branches.find((b) => (b.id || b._id) === targetBranchId);

      if (target) {
        useBranchStore.setState({ activeBranch: target });
      } else if (targetBranchId) {
        const activeWsId = getCrossSubdomainItem('orvio_active_workspace_id') || '';
        if (activeWsId) {
          useBranchStore.getState().loadBranches(activeWsId, undefined, true);
        }
      }
    });

    // 3. Sync notification count and status from other tabs
    const unsubNotif = crossTabSync.subscribe('NOTIFICATIONS_SYNC', (msg) => {
      if (typeof msg.payload?.unreadCount === 'number') {
        useNotificationStore.getState().setUnreadCount(msg.payload.unreadCount);
      }
      if (msg.payload?.readId) {
        useNotificationStore.setState((state) => ({
          notifications: state.notifications.map((n) =>
            n._id === msg.payload.readId || n.id === msg.payload.readId
              ? { ...n, status: 'READ', readAt: Date.now() }
              : n
          ),
        }));
      }
    });

    // 4. Sync auth changes (logout / token refreshed)
    const unsubAuth = crossTabSync.subscribe('AUTH_STATE_CHANGED', (msg) => {
      if (msg.payload?.type === 'LOGOUT') {
        useAuthStore.getState().logout(true);
      } else if (msg.payload?.type === 'LOGIN') {
        useAuthStore.getState().refreshUser();
      }
    });

    return () => {
      unsubWs();
      unsubBranch();
      unsubNotif();
      unsubAuth();
    };
  }, []);
}
