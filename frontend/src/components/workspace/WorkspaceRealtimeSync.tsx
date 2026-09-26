import { useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useRealtimeSocket, type RealtimeEvent } from '@/lib/useRealtimeSocket';

/** Keeps open tabs aligned when workspace context changes on another surface. */
export function WorkspaceRealtimeSync() {
  const { currentWorkspace, loadWorkspaceContext } = useWorkspaceStore();
  const workspaceId = currentWorkspace?.id || currentWorkspace?.workspaceId || null;
  const onEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'context.switched' || event.type === 'product.activated') void loadWorkspaceContext(String(event.workspaceId || workspaceId));
    if (event.type === 'branch.changed' && typeof event.data === 'object') window.dispatchEvent(new CustomEvent('orvio:branch-context', { detail: event.data }));
  }, [loadWorkspaceContext, workspaceId]);
  const { send } = useRealtimeSocket(workspaceId ? `/api/v1/workspaces/${workspaceId}/context/stream` : null, onEvent);
  useEffect(() => {
    const publish = (event: Event) => send({ type: 'context.switched', data: (event as CustomEvent).detail || {} });
    window.addEventListener('orvio:workspace-context', publish);
    return () => window.removeEventListener('orvio:workspace-context', publish);
  }, [send]);
  return null;
}
