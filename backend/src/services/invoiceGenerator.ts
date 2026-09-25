import { dataService } from './dataService.js';
import { notificationService } from './notificationService.js';
import { jobService } from './jobService.js';

export interface InvoiceGenerationItem {
  description: string;
  amount: number;
}

export class InvoiceGenerator {
  /**
   * Evaluates subscriptions nearing renewal (within 3 days) and creates pending invoices
   */
  public async runDailyGeneration(): Promise<{ generatedInvoices: number; errors: number }> {
    let generatedInvoices = 0;
    let errors = 0;

    try {
      const subscriptions = await dataService.listSubscriptionsForInvoiceGeneration({
        nextRenewalWithinDays: 3,
        excludeStatus: ['cancelled', 'suspended', 'expired', 'trialing'],
      });

      for (const sub of subscriptions) {
        try {
          const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
          const planKey = sub.planKey || 'standard';
          const billingCycle = sub.billingInterval || sub.billingCycle || 'monthly';
          const amount = sub.amount || (planKey === 'premium' ? (billingCycle === 'annual' ? 250000 : 25000) : (billingCycle === 'annual' ? 75000 : 7500));

          const invoice = await dataService.createInvoice({
            workspaceId: sub.workspaceId || sub.organizationId,
            organizationId: sub.organizationId || sub.workspaceId,
            subscriptionId: sub.id || sub._id,
            invoiceNumber,
            planKey,
            amount,
            billingCycle,
            status: 'pending',
            issueDate: Date.now(),
            dueDate: sub.currentPeriodEnd || (Date.now() + 3 * 86_400_000),
            items: [
              {
                description: `${planKey === 'premium' ? 'Premium Plan' : 'Standard Plan'} Subscription (${billingCycle})`,
                amount,
              },
            ],
          });

          if (invoice && sub.userId) {
            generatedInvoices++;
            // Notify user of upcoming renewal and generated invoice
            await notificationService.onUpcomingRenewal({
              userId: sub.userId,
              organizationId: sub.organizationId,
              workspaceId: sub.workspaceId,
              currentPeriodEnd: sub.currentPeriodEnd || (Date.now() + 3 * 86_400_000),
              amount,
              planKey,
            });
          }
        } catch (err) {
          errors++;
          console.error(`[InvoiceGenerator] Failed to generate invoice for ${sub.workspaceId}:`, err);
        }
      }
    } catch (err) {
      console.error('[InvoiceGenerator] Daily invoice generation job error:', err);
    }

    return { generatedInvoices, errors };
  }
}

export const invoiceGenerator = new InvoiceGenerator();

// Schedule daily invoice generation cycle (every 24 hours)
jobService.schedule('invoice-generation', 24 * 60 * 60 * 1000, async () => {
  await invoiceGenerator.runDailyGeneration();
});
