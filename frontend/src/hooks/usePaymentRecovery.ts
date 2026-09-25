import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export interface PendingPaymentInfo {
  orgId?: string;
  plan?: string;
  cycle?: string;
  amount?: number;
  reference?: string;
  gateway?: string;
  timestamp?: number;
}

export interface UsePaymentRecoveryOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onSuccess?: (sub: any) => void;
  onTimeout?: () => void;
}

export function usePaymentRecovery(
  orgId: string | null | undefined,
  options: UsePaymentRecoveryOptions = {}
) {
  const { intervalMs = 15000, maxAttempts = 10, onSuccess, onTimeout } = options;
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { invalidateCache, fetchWorkspaces } = useWorkspaceStore();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsRecovering(false);
  }, []);

  const checkPendingPayment = useCallback(async () => {
    if (!orgId) return;

    const pendingKey = `orvio_pending_payment_${orgId}`;
    const pendingRaw = localStorage.getItem(pendingKey);
    if (!pendingRaw) {
      stopPolling();
      return;
    }

    let pending: PendingPaymentInfo = {};
    try {
      pending = JSON.parse(pendingRaw);
    } catch {}

    // If payment reference exists, try quick verification endpoint as well
    if (pending.reference) {
      try {
        await api.get(
          `/billing/verify?reference=${encodeURIComponent(pending.reference)}&gateway=${pending.gateway || 'paystack'}`
        ).catch(() => null);
      } catch {}
    }

    try {
      // Check subscription status
      let res: any;
      try {
        res = await api.get(`/billing/subscription?workspaceId=${orgId}`);
      } catch {
        res = await api.get(`/api/v1/workspaces/${orgId}/billing`);
      }

      const sub = res?.data?.subscription || res?.data || res?.subscription;
      const activePlan = sub?.planKey || sub?.activePlan || sub?.planId;
      const status = sub?.status;

      const isConfirmed =
        (status === 'active' || status === 'trialing') &&
        (!pending.plan || activePlan === pending.plan || (pending.plan === 'standard' && activePlan === 'premium'));

      if (isConfirmed) {
        localStorage.removeItem(pendingKey);
        stopPolling();
        invalidateCache();
        await fetchWorkspaces(undefined, undefined, true).catch(() => {});

        const planLabel = activePlan === 'premium' ? 'Premium Plan' : 'Standard Plan';
        toast.success(`Payment confirmed! Your ${planLabel} subscription is now active.`);

        if (onSuccess) {
          onSuccess(sub);
        }
      }
    } catch (err) {
      console.warn('[usePaymentRecovery] Polling error:', err);
    }
  }, [orgId, stopPolling, invalidateCache, fetchWorkspaces, onSuccess]);

  useEffect(() => {
    if (!orgId) return;

    const pendingKey = `orvio_pending_payment_${orgId}`;
    const pending = localStorage.getItem(pendingKey);

    if (!pending) {
      setIsRecovering(false);
      return;
    }

    setIsRecovering(true);
    let attempts = 0;

    // Run initial check immediately
    checkPendingPayment();

    pollRef.current = setInterval(async () => {
      attempts++;
      setAttemptCount(attempts);

      await checkPendingPayment();

      if (attempts >= maxAttempts) {
        stopPolling();
        toast.error('Payment verification timed out. Please check your billing settings.', {
          action: {
            label: 'View Billing',
            onClick: () => {
              window.location.href = '/billing/settings';
            },
          },
        });
        if (onTimeout) {
          onTimeout();
        }
      }
    }, intervalMs);

    return () => {
      stopPolling();
    };
  }, [orgId, intervalMs, maxAttempts, checkPendingPayment, stopPolling, onTimeout]);

  return {
    isRecovering,
    attemptCount,
    retryNow: checkPendingPayment,
    cancelRecovery: () => {
      if (orgId) {
        localStorage.removeItem(`orvio_pending_payment_${orgId}`);
      }
      stopPolling();
    },
  };
}
