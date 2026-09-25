import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { realtimeClient } from '@/lib/realtimeClient';
import { crossTabSync } from '@/lib/crossTabSync';

export interface WorkspaceUsageData {
  workspaceId?: string;
  planKey?: string;
  branches: number;
  members: number;
  products: number;
  transactions: number;
  workspacesCount?: number;
  appsCount?: number;
  usage?: {
    branches?: number;
    members?: number;
    products?: number;
    transactions?: number;
    [key: string]: any;
  };
  records?: any[];
  [key: string]: any;
}

const DEFAULT_USAGE: WorkspaceUsageData = {
  branches: 1,
  members: 1,
  products: 0,
  transactions: 0,
  workspacesCount: 1,
  appsCount: 1,
};

export function useLiveUsage(workspaceId?: string | null) {
  const [usage, setUsage] = useState<WorkspaceUsageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchUsage = useCallback(async (silent = false) => {
    if (!workspaceId) {
      setUsage(null);
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // First try canonical /api/v1/workspaces/:id/usage
      let res: any;
      try {
        res = await api.get(`/api/v1/workspaces/${workspaceId}/usage`);
      } catch {
        res = await api.get(`/workspaces/${workspaceId}/usage`);
      }

      if (isMountedRef.current) {
        const data = res?.data || res;
        const normalizedUsage: WorkspaceUsageData = {
          workspaceId,
          planKey: data?.planKey || 'free_trial',
          branches: data?.branches ?? data?.usage?.branches ?? data?.usage?.branchesCount ?? 1,
          members: data?.members ?? data?.usage?.members ?? data?.usage?.membersCount ?? 1,
          products: data?.products ?? data?.usage?.products ?? data?.usage?.productsCount ?? 0,
          transactions: data?.transactions ?? data?.usage?.transactions ?? data?.usage?.transactionsCount ?? 0,
          workspacesCount: data?.workspacesCount ?? data?.usage?.workspacesCount ?? 1,
          appsCount: data?.appsCount ?? data?.usage?.appsCount ?? 1,
          usage: data?.usage || data,
          records: data?.records || [],
        };
        setUsage(normalizedUsage);
        setError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.error('[useLiveUsage] Failed to fetch usage:', err);
        setError(err?.message || 'Unable to load workspace usage metrics.');
        // Provide safe fallback so UI does not crash
        setUsage((prev) => prev || { ...DEFAULT_USAGE, workspaceId });
      }
    } finally {
      if (isMountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!workspaceId) return;

    // 1. Initial fetch
    fetchUsage(false);

    // 2. Realtime SSE subscription
    const unsubRealtime = realtimeClient.subscribe('usage.updated', (eventData: any) => {
      if (eventData?.workspaceId === workspaceId || !eventData?.workspaceId) {
        fetchUsage(true);
      }
    });

    // 3. Cross-tab synchronization
    const unsubCrossTab = crossTabSync.subscribe('USAGE_SYNC', (msg) => {
      if (msg.payload?.workspaceId === workspaceId && msg.payload?.usage) {
        setUsage(msg.payload.usage);
      } else if (!msg.payload?.workspaceId || msg.payload?.workspaceId === workspaceId) {
        fetchUsage(true);
      }
    });

    // 4. Polling fallback every 30s
    const pollInterval = setInterval(() => {
      fetchUsage(true);
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(pollInterval);
      unsubRealtime();
      unsubCrossTab();
    };
  }, [workspaceId, fetchUsage]);

  const broadcastUsageUpdate = useCallback(
    (newUsage: WorkspaceUsageData) => {
      setUsage(newUsage);
      crossTabSync.broadcast('USAGE_SYNC', { workspaceId, usage: newUsage });
    },
    [workspaceId]
  );

  return {
    usage,
    isLoading,
    error,
    refetch: () => fetchUsage(false),
    broadcastUsageUpdate,
  };
}
