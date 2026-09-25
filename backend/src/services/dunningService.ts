import { dataService } from './dataService.js';
import { notificationService } from './notificationService.js';
import { paystackService } from './paystackService.js';
import { flutterwaveService } from './flutterwaveService.js';
import { jobService } from './jobService.js';

export interface DunningStage {
  day: number;
  action: 'retry_payment' | 'notify_grace_expiring' | 'suspend';
  notify: boolean;
  template: string;
}

export class DunningService {
  private readonly DUNNING_SCHEDULE: DunningStage[] = [
    { day: 1, action: 'retry_payment', notify: true, template: 'payment-failed-day1' },
    { day: 3, action: 'retry_payment', notify: true, template: 'payment-failed-day3' },
    { day: 5, action: 'notify_grace_expiring', notify: true, template: 'grace-expiring' },
    { day: 7, action: 'suspend', notify: true, template: 'subscription-suspended' },
  ];

  /**
   * Evaluates all past-due subscriptions and performs scheduled retry and escalation actions
   */
  public async runDunningCycle(): Promise<{ processedCount: number; retriedCount: number; suspendedCount: number }> {
    let processedCount = 0;
    let retriedCount = 0;
    let suspendedCount = 0;

    try {
      const pastDueSubs = await dataService.listSubscriptionsByStatus('past_due');

      for (const sub of pastDueSubs) {
        processedCount++;
        const lastAttempt = sub.lastPaymentAttempt || sub.updatedAt || sub.currentPeriodEnd || Date.now();
        const daysInDunning = Math.max(1, Math.floor((Date.now() - lastAttempt) / 86_400_000));

        // Find stage matching or closest threshold
        const stage = this.DUNNING_SCHEDULE.find((s) => s.day === daysInDunning) || (daysInDunning >= 7 ? this.DUNNING_SCHEDULE[3] : undefined);

        if (!stage) continue;

        if (stage.action === 'retry_payment') {
          retriedCount++;
          try {
            if (sub.gateway === 'paystack' || sub.provider === 'paystack') {
              await this.retryPaystackPayment(sub);
            } else if (sub.gateway === 'flutterwave' || sub.provider === 'flutterwave') {
              await this.retryFlutterwavePayment(sub);
            }
          } catch (err) {
            console.warn(`[DunningService] Payment retry failed for ${sub.workspaceId}:`, err);
          }
        }

        if (stage.notify && sub.userId) {
          try {
            await notificationService.onPaymentFailed(
              {
                userId: sub.userId,
                organizationId: sub.organizationId,
                workspaceId: sub.workspaceId,
                planKey: sub.planKey || 'standard',
              },
              `Day ${stage.day} of grace period`
            );
          } catch {}
        }

        if (stage.action === 'suspend') {
          suspendedCount++;
          try {
            await dataService.updateSubscriptionStatus(sub.workspaceId || sub.organizationId, 'suspended');
          } catch (err) {
            console.error(`[DunningService] Suspension failed for ${sub.workspaceId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[DunningService] Dunning cycle execution error:', err);
    }

    return { processedCount, retriedCount, suspendedCount };
  }

  private async retryPaystackPayment(sub: any): Promise<boolean> {
    const lastRef = sub.lastPaymentReference || sub.reference;
    if (!lastRef) return false;

    try {
      const verifyRes: any = await paystackService.verifyPayment(lastRef);
      if (verifyRes?.status === 'success' || verifyRes?.data?.status === 'success' || verifyRes?.status === true) {
        await dataService.updateSubscriptionStatus(sub.workspaceId || sub.organizationId, 'active');
        return true;
      }
    } catch {}
    return false;
  }

  private async retryFlutterwavePayment(sub: any): Promise<boolean> {
    const lastRef = sub.lastPaymentReference || sub.reference;
    if (!lastRef) return false;

    try {
      const verifyRes: any = await flutterwaveService.verifyPayment(lastRef);
      if (verifyRes?.status === 'success' || verifyRes?.status === 'successful') {
        await dataService.updateSubscriptionStatus(sub.workspaceId || sub.organizationId, 'active');
        return true;
      }
    } catch {}
    return false;
  }
}

export const dunningService = new DunningService();

// Schedule automated dunning cycle every 6 hours
jobService.schedule('dunning-cycle', 6 * 60 * 60 * 1000, async () => {
  await dunningService.runDunningCycle();
});
