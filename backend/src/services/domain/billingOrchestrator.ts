import { ConvexHttpClient } from 'convex/browser';
import { BaseRepository } from '../../repositories/baseRepository.js';
import { BillingRepository } from '../../repositories/billingRepository.js';
import { AuditNotificationRepository } from '../../repositories/auditNotificationRepository.js';
import { paystackService } from '../paystackService.js';
import { flutterwaveService } from '../flutterwaveService.js';

export interface InitializeCheckoutParams {
  userId: string;
  userEmail: string;
  userName?: string;
  workspaceId?: string;
  organizationId?: string;
  planKey: string;
  interval: 'monthly' | 'yearly';
  currency?: 'NGN' | 'USD';
  gateway: 'paystack' | 'flutterwave';
  callbackUrl?: string;
}

export interface VerifyPaymentParams {
  reference: string;
  gateway: 'paystack' | 'flutterwave';
  userId: string;
  workspaceId?: string;
  organizationId?: string;
}

/**
 * Domain Service: BillingOrchestrator
 * Coordinates multi-gateway payments, plan tier state machines, idempotency,
 * and subscription lifecycle transitions.
 */
export class BillingOrchestrator extends BaseRepository {
  constructor(
    client?: ConvexHttpClient,
    private readonly billingRepo?: BillingRepository,
    private readonly auditRepo?: AuditNotificationRepository
  ) {
    super(client);
  }

  /**
   * Initialize a checkout transaction across gateways
   */
  public async initializeCheckout(params: InitializeCheckoutParams): Promise<{
    authorizationUrl: string;
    reference: string;
    gateway: string;
  }> {
    const { userId, userEmail, planKey, interval, currency = 'NGN', gateway, callbackUrl } = params;

    // Plan pricing resolver
    const planPrices: Record<string, { monthly: number; yearly: number }> = {
      standard: { monthly: 15000, yearly: 150000 },
      pro: { monthly: 35000, yearly: 350000 },
      enterprise: { monthly: 75000, yearly: 750000 },
    };

    const targetPlan = planPrices[planKey.toLowerCase()] || planPrices['standard'];
    const amount = interval === 'yearly' ? targetPlan.yearly : targetPlan.monthly;
    const reference = `ref_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    let authorizationUrl = '';

    if (gateway === 'paystack') {
      const initResult = await paystackService.initializePayment({
        email: userEmail,
        amountInKobo: amount * 100,
        reference,
        callbackUrl,
        metadata: {
          userId,
          workspaceId: params.workspaceId,
          organizationId: params.organizationId,
          planKey,
          interval,
        },
      });
      authorizationUrl = initResult.authorizationUrl;
    } else {
      const initResult = await flutterwaveService.initializePayment({
        email: userEmail,
        amountInNaira: amount,
        txRef: reference,
        redirectUrl: callbackUrl,
        meta: {
          userId,
          workspaceId: params.workspaceId,
          organizationId: params.organizationId,
          planKey,
          interval,
        },
      });
      authorizationUrl = initResult.paymentLink;
    }

    // Record pending transaction
    if (this.billingRepo) {
      await this.billingRepo.recordInitiatedTransaction({
        workspaceId: params.workspaceId || params.organizationId || 'default',
        planKey,
        amount,
        currency,
        billingCycle: interval,
        gateway,
        gatewayReference: reference,
        customerEmail: userEmail,
        metadata: { userId, organizationId: params.organizationId },
      });
    }

    return { authorizationUrl, reference, gateway };
  }

  /**
   * Verify transaction with gateway and apply subscription upgrade
   */
  public async verifyAndApplyPayment(params: VerifyPaymentParams): Promise<{
    success: boolean;
    planKey: string;
    reference: string;
  }> {
    const { reference, gateway, userId, workspaceId, organizationId } = params;

    let isSuccess = false;
    let verifiedPlanKey = 'standard';

    if (gateway === 'paystack') {
      const result = await paystackService.verifyPayment(reference);
      isSuccess = result.status === 'success';
      verifiedPlanKey = (result.metadata?.planKey as string) || 'standard';
    } else {
      const result = await flutterwaveService.verifyPayment(reference);
      isSuccess = result.status === 'success';
      verifiedPlanKey = (result.meta?.planKey as string) || 'standard';
    }

    if (!isSuccess) {
      const err: any = new Error('Payment verification failed or was not completed.');
      err.code = 'PAYMENT_VERIFICATION_FAILED';
      err.statusCode = 400;
      throw err;
    }

    const now = Date.now();
    const periodEnd = now + 30 * 86_400_000;

    // Upgrade subscription
    if (this.billingRepo) {
      if (workspaceId) {
        await this.billingRepo.updateWorkspaceSubscription(workspaceId, verifiedPlanKey, 'active', periodEnd);
      }
      await this.billingRepo.updateUserSubscription(userId, verifiedPlanKey, 'active', periodEnd);
      await this.billingRepo.markSuccessfulTransaction({
        gatewayReference: reference,
        gateway,
        metadata: { planKey: verifiedPlanKey },
      });
    }

    // Audit log
    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        organizationId,
        workspaceId,
        actorUserId: userId,
        eventType: 'subscription.upgraded',
        resource: 'subscriptions',
        entityId: workspaceId || userId,
        metadata: { reference, gateway, planKey: verifiedPlanKey },
      }).catch(() => {});
    }

    return {
      success: true,
      planKey: verifiedPlanKey,
      reference,
    };
  }

  /**
   * Process manual bank payment submission
   */
  public async submitManualPayment(params: {
    workspaceId: string;
    userId: string;
    amount: number;
    planKey: string;
    receiptUrl: string;
    notes?: string;
  }): Promise<any> {
    let payment: any;
    if (this.billingRepo) {
      payment = await this.billingRepo.recordManualPayment({
        workspaceId: params.workspaceId,
        planKey: params.planKey,
        amount: params.amount,
        currency: 'NGN',
        billingCycle: 'monthly',
        paymentMethod: 'bank_transfer',
        paymentReference: `man_${Date.now()}`,
        recordedBy: params.userId,
        notes: params.notes,
      });
    }

    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        workspaceId: params.workspaceId,
        actorUserId: params.userId,
        eventType: 'manual_payment.submitted',
        resource: 'manual_payments',
        entityId: payment?.paymentId || params.workspaceId,
        metadata: { amount: params.amount, planKey: params.planKey },
      }).catch(() => {});
    }

    return payment;
  }
}

export const billingOrchestrator = new BillingOrchestrator();
