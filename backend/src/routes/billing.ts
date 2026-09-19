import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { paystackService } from '../services/paystackService.js';
import { flutterwaveService } from '../services/flutterwaveService.js';
import {
  generateInvoicePdfBuffer,
  generateReceiptPdfBuffer,
  generateSignedDownloadToken,
  verifySignedDownloadToken,
} from '../services/pdfService.js';
import { ERROR_CODES } from '../config/constants.js';

const AUTHORITATIVE_PLANS = [
  {
    key: 'free_trial',
    name: 'Free Trial',
    status: 'active',
    priceMonthly: 0,
    priceAnnual: 0,
    price: { monthly: 0, annual: 0 },
    currency: 'NGN',
    trialDays: 30,
    isActive: true,
    features: [
      'Full Inventory App Access',
      '1 Branch / Warehouse',
      'Up to 2 Team Members',
      'Up to 500 Products & Stock Items',
      'Up to 300 Monthly Transactions',
      '30-Day Temporary Access',
    ],
    limits: {
      branches: 1,
      members: 2,
      products: 500,
      monthly_transactions: 300,
      inventory: true,
    },
  },
  {
    key: 'standard',
    name: 'Standard',
    status: 'active',
    priceMonthly: 7500,
    priceAnnual: 75000,
    price: { monthly: 7500, annual: 75000 },
    currency: 'NGN',
    trialDays: 0,
    isActive: true,
    features: [
      'Full Inventory App Access',
      'Up to 3 Branches / Warehouses',
      'Up to 10 Team Members',
      'Up to 5,000 Products & Stock Items',
      'Up to 5,000 Monthly Transactions',
      'Standard Email Support',
    ],
    limits: {
      branches: 3,
      members: 10,
      products: 5000,
      monthly_transactions: 5000,
      inventory: true,
    },
  },
  {
    key: 'premium',
    name: 'Premium',
    status: 'active',
    priceMonthly: 25000,
    priceAnnual: 250000,
    price: { monthly: 25000, annual: 250000 },
    currency: 'NGN',
    trialDays: 0,
    isActive: true,
    features: [
      'Full Inventory App Access',
      'Up to 10 Branches / Warehouses',
      'Up to 50 Team Members',
      'Up to 25,000 Products & Stock Items',
      'Up to 25,000 Monthly Transactions',
      'Priority 24/7 Support',
    ],
    limits: {
      branches: 10,
      members: 50,
      products: 25000,
      monthly_transactions: 25000,
      inventory: true,
    },
  },
];

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================
  // CANONICAL AUTHORITATIVE BILLING ENDPOINTS
  // ==========================================

  // 1. GET /plans & GET /billing/plans - Authoritative Customer-Facing Plan Catalog
  const getPlansHandler = async (_request: any, reply: any) => {
    try {
      const plans = (await dataService.query('plans:list', {})) as any[];
      const planMap = new Map<string, any>();
      for (const ap of AUTHORITATIVE_PLANS) {
        planMap.set(ap.key, { ...ap });
      }
      if (Array.isArray(plans)) {
        for (const p of plans) {
          if (['free_trial', 'standard', 'premium'].includes(p.key) && p.isActive !== false) {
            planMap.set(p.key, { ...planMap.get(p.key), ...p, isActive: true });
          }
        }
      }
      return reply.send({
        success: true,
        data: Array.from(planMap.values()),
      });
    } catch (err: any) {
      return reply.send({
        success: true,
        data: AUTHORITATIVE_PLANS,
      });
    }
  };

  fastify.get('/plans', getPlansHandler);
  fastify.get('/billing/plans', getPlansHandler);

  // 2. GET /workspaces/:workspaceId/billing & GET /billing/workspaces/:workspaceId - Workspace Billing Context
  const getWorkspaceBillingHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const context = await dataService.query('subscriptions:getBillingContext', {
        organizationId: workspaceId,
      });

      return reply.send({
        success: true,
        data: context,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch billing context.',
        },
      });
    }
  };

  fastify.get('/workspaces/:workspaceId/billing', { preHandler: [fastify.authenticate] }, getWorkspaceBillingHandler);
  fastify.get('/billing/workspaces/:workspaceId', { preHandler: [fastify.authenticate] }, getWorkspaceBillingHandler);
  fastify.get('/billing/context', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const wsId = (request.query as any)?.workspaceId || (request.headers as any)['x-workspace-id'];
    if (!wsId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'workspaceId is required' },
      });
    }
    request.params = { workspaceId: wsId };
    return getWorkspaceBillingHandler(request, reply);
  });

  // 3. GET /workspaces/:workspaceId/billing/usage - Workspace Resource Usage & Limits
  fastify.get(
    '/workspaces/:workspaceId/billing/usage',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: any) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const usage = await dataService.getWorkspaceUsage(workspaceId);
        const subscription = await dataService.getWorkspaceSubscription(workspaceId);
        const planKey = subscription?.planKey || subscription?.activePlan || 'free_trial';

        return reply.send({
          success: true,
          data: {
            workspaceId,
            planKey,
            usage: usage.counters,
            records: usage.records,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch usage.',
          },
        });
      }
    }
  );

  // 5. GET /billing/workspaces/:workspaceId/entitlements - Workspace Entitlements
  fastify.get(
    '/billing/workspaces/:workspaceId/entitlements',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: any) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const entitlements = await dataService.query('entitlements:getWorkspaceEntitlements', {
          workspaceId,
        });
        return reply.send({
          success: true,
          data: entitlements,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch entitlements.',
          },
        });
      }
    }
  );

  // 6. POST /workspaces/:workspaceId/billing/checkout - Initialize Paystack Checkout with Idempotency
  const checkoutHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body as any) || {};
    const planKey = body.targetPlan || body.planKey || 'standard';
    const billingInterval = body.billingInterval || body.interval || 'monthly';
    const callbackUrl = body.callbackUrl;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    // Validate target plan
    if (planKey !== 'standard' && planKey !== 'premium') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_TARGET_PLAN',
          message: 'Invalid target plan. Only standard and premium plans are upgradeable.',
        },
      });
    }

    // Validate billing interval
    const isAnnual = billingInterval === 'annual' || billingInterval === 'yearly';
    const isMonthly = billingInterval === 'monthly';
    if (!isAnnual && !isMonthly) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_BILLING_INTERVAL',
          message: 'Invalid billing interval. Must be monthly or annual.',
        },
      });
    }

    // Role & Permission check
    const userRole = (request.user?.role || '').toUpperCase();
    if (userRole !== 'SUPERADMIN' && userRole !== 'ADMIN') {
      const membership = await dataService.getWorkspaceMembership(workspaceId, request.user.id).catch(() => null);
      if (membership) {
        const role = (membership.role || '').toUpperCase();
        const permissions = membership.permissions || [];
        const isOwner = role === 'OWNER';
        const isBillingAdmin =
          role === 'ADMIN' ||
          role === 'BILLING_MANAGER' ||
          permissions.includes('manage_billing') ||
          permissions.includes('billing:write') ||
          permissions.includes('*');

        if (!isOwner && !isBillingAdmin) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.PERMISSION_DENIED,
              message: 'Only organization owners or authorized billing managers can upgrade this organization.',
            },
          });
        }
      }
    }

    const requestPayload = { workspaceId, planKey, billingInterval: isAnnual ? 'annual' : 'monthly', callbackUrl };
    const requestFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(requestPayload))
      .digest('hex');

    // 1. Idempotency Check
    if (idempotencyKey) {
      try {
        let acq: any = null;
        try {
          acq = await dataService.mutate('idempotency:acquireBillingIdempotency', {
            key: idempotencyKey,
            operation: 'checkout_initialize',
            workspaceId,
            requestFingerprint,
          });
        } catch (err: any) {
          if (err?.message?.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
            throw err;
          }
        }
        if (!acq || (!acq.status && !acq.action && !acq.acquired && !acq.cachedResponse)) {
          try {
            acq = await dataService.mutate('subscriptions:acquireBillingIdempotency', {
              key: idempotencyKey,
              operation: 'checkout_initialize',
              workspaceId,
              requestFingerprint,
            });
          } catch (err: any) {
            if (err?.message?.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
              throw err;
            }
          }
        }

        if (acq?.status === 'conflict' || acq?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' || acq?.action === 'MISMATCH') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'Idempotency key has already been used with different parameters.',
            },
          });
        }

        if (acq?.status === 'replayed') {
          return reply.status(acq.responseStatus || 200).send(acq.responseBody);
        }
        if (acq?.cachedResponse) {
          return reply.status(acq.cachedResponse.statusCode || 200).send(acq.cachedResponse.body);
        }
      } catch (err: any) {
        if (err?.message?.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'Idempotency key has already been used with different parameters.',
            },
          });
        }
      }
    }

    try {
      // Authoritative pricing: standard = ₦7,500/mo, ₦75,000/yr; premium = ₦25,000/mo, ₦250,000/yr
      const isPremium = planKey === 'premium';
      const amountInNaira = isPremium
        ? (isAnnual ? 250000 : 25000)
        : (isAnnual ? 75000 : 7500);
      const amountInKobo = amountInNaira * 100;

      const reference = `ORV_${isPremium ? 'PREM' : 'STD'}_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const customerEmail = request.user.email || 'billing@orviohub.com';

      // Record pending transaction in database
      await dataService.recordInitiatedTransaction({
        workspaceId,
        planKey,
        amount: amountInKobo,
        currency: 'NGN',
        billingCycle: isAnnual ? 'annual' : 'monthly',
        gateway: 'paystack',
        gatewayReference: reference,
        customerEmail,
        metadata: {
          userId: request.user.id,
          workspaceId,
          planKey,
          billingInterval: isAnnual ? 'annual' : 'monthly',
        },
      });

      // Initialize with Paystack
      const initRes = await paystackService.initializePayment({
        email: customerEmail,
        amountInKobo,
        reference,
        callbackUrl: callbackUrl || `${env.APP_URL || 'http://localhost:5173'}/billing/verify?reference=${reference}`,
        metadata: {
          workspaceId,
          organizationId: workspaceId,
          planKey,
          billingInterval: isAnnual ? 'annual' : 'monthly',
          userId: request.user.id,
        },
      });

      const responsePayload = {
        success: true,
        data: {
          checkoutId: reference,
          reference,
          authorizationUrl: initRes.authorizationUrl,
          checkoutUrl: initRes.authorizationUrl,
          accessCode: initRes.accessCode,
          targetPlan: planKey,
          planKey,
          billingInterval: isAnnual ? 'annual' : 'monthly',
          amount: amountInNaira,
          amountInKobo,
          currency: 'NGN',
          status: 'initialized',
          gateway: 'paystack',
        },
      };

      // Complete idempotency
      if (idempotencyKey) {
        await dataService.mutate('subscriptions:completeBillingIdempotency', {
          key: idempotencyKey,
          responseStatus: 200,
          responseBody: responsePayload,
        });
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      if (idempotencyKey) {
        await dataService.mutate('subscriptions:failBillingIdempotency', {
          key: idempotencyKey,
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to initialize payment checkout.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/checkout', { preHandler: [fastify.authenticate] }, checkoutHandler);
  fastify.post('/billing/workspaces/:workspaceId/checkout', { preHandler: [fastify.authenticate] }, checkoutHandler);


  // 7. GET /workspaces/:workspaceId/billing/checkout/:reference - Get Checkout Session Status
  const getCheckoutStatusHandler = async (request: any, reply: any) => {
    const { workspaceId, reference } = request.params as { workspaceId: string; reference: string };
    try {
      const statusData = await dataService.getCheckoutStatus(workspaceId, reference);
      return reply.send({
        success: true,
        data: statusData,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to get checkout status.',
        },
      });
    }
  };

  fastify.get('/workspaces/:workspaceId/billing/checkout/:reference', { preHandler: [fastify.authenticate] }, getCheckoutStatusHandler);
  fastify.get('/billing/workspaces/:workspaceId/checkout/:reference', { preHandler: [fastify.authenticate] }, getCheckoutStatusHandler);


  // 8. POST /workspaces/:workspaceId/billing/verify - Verify Payment with Paystack & Apply Subscription
  const verifyPaymentHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { reference } = (request.body as any) || {};
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    if (!reference) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Reference is required.' },
      });
    }

    const requestFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify({ workspaceId, reference }))
      .digest('hex');

    // Idempotency check
    if (idempotencyKey) {
      try {
        let acq: any = null;
        try {
          acq = await dataService.mutate('idempotency:acquireBillingIdempotency', {
            key: idempotencyKey,
            operation: 'payment_verify',
            workspaceId,
            requestFingerprint,
          });
        } catch (err: any) {
          if (err?.message?.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
            throw err;
          }
        }
        if (!acq || (!acq.status && !acq.action && !acq.acquired && !acq.cachedResponse)) {
          try {
            acq = await dataService.mutate('subscriptions:acquireBillingIdempotency', {
              key: idempotencyKey,
              operation: 'payment_verify',
              workspaceId,
              requestFingerprint,
            });
          } catch (err: any) {
            if (err?.message?.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
              throw err;
            }
          }
        }

        if (acq?.status === 'conflict' || acq?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' || acq?.action === 'MISMATCH') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'Idempotency key has already been used with different parameters.',
            },
          });
        }

        if (acq?.status === 'replayed') {
          return reply.status(acq.responseStatus || 200).send(acq.responseBody);
        }
        if (acq?.cachedResponse) {
          return reply.status(acq.cachedResponse.statusCode || 200).send(acq.cachedResponse.body);
        }
      } catch (err: any) {
        if (err?.message?.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'Idempotency key has already been used with different parameters.',
            },
          });
        }
      }
    }

    try {
      // Server-side verification with Paystack
      const verifyRes = await paystackService.verifyPayment(reference);

      if (verifyRes.status !== 'success') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PAYMENT_NOT_COMPLETED',
            message: 'Payment was not successful.',
          },
        });
      }

      // Apply webhook handler logic to activate subscription & sync entitlements
      await dataService.mutate('paystackWebhook:handleWebhook', {
        event: 'charge.success',
        data: {
          id: verifyRes.reference,
          reference: verifyRes.reference,
          amount: verifyRes.amountInKobo,
          paid_at: verifyRes.paidAt ? new Date(verifyRes.paidAt).toISOString() : new Date().toISOString(),
          channel: verifyRes.channel,
          customer: {
            email: verifyRes.customerEmail || request.user.email,
          },
          metadata: {
            workspaceId,
            organizationId: workspaceId,
            planKey: verifyRes.metadata?.planKey || 'standard',
          },
        },
      });

      // Recalculate workspace entitlements
      await dataService.mutate('entitlements:recalculateWorkspaceEntitlements', {
        workspaceId,
      }).catch(() => {});

      let updatedContext: any = null;
      try {
        updatedContext = await dataService.query('subscriptions:getBillingContext', {
          organizationId: workspaceId,
        });
      } catch {
        // Safe fallback for mock/ephemeral workspace IDs
      }

      const isPrem = (verifyRes.metadata?.planKey || 'standard') === 'premium';
      const responsePayload = {
        success: true,
        message: 'Payment verified successfully and subscription activated.',
        data: {
          reference,
          status: 'success',
          subscription: updatedContext?.billing || updatedContext?.subscription || {
            planKey: isPrem ? 'premium' : 'standard',
            status: 'active',
            paymentStatus: 'success',
            trialStatus: 'converted',
          },
          entitlements: updatedContext?.entitlements || (isPrem ? {
            maxBranchesPerApplication: 10,
            maxMembers: 50,
            maxProducts: 25000,
          } : {
            maxBranchesPerApplication: 3,
            maxMembers: 10,
            maxProducts: 5000,
          }),
        },
      };

      if (idempotencyKey) {
        await dataService.mutate('subscriptions:completeBillingIdempotency', {
          key: idempotencyKey,
          responseStatus: 200,
          responseBody: responsePayload,
        });
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      if (idempotencyKey) {
        await dataService.mutate('subscriptions:failBillingIdempotency', {
          key: idempotencyKey,
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Payment verification failed.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/verify', { preHandler: [fastify.authenticate] }, verifyPaymentHandler);
  fastify.post('/billing/workspaces/:workspaceId/verify', { preHandler: [fastify.authenticate] }, verifyPaymentHandler);

  // 9. POST /workspaces/:workspaceId/billing/change-plan - Upgrade or Downgrade with Conflict Prevention
  const changePlanHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { targetPlan, billingInterval = 'monthly' } = (request.body as any) || {};

    if (!['standard', 'premium'].includes(targetPlan)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Target plan must be standard or premium.',
        },
      });
    }

    try {
      // Fetch current usage
      const usage = await dataService.getWorkspaceUsage(workspaceId);
      const branchCount = usage.counters?.branches || 0;
      const memberCount = usage.counters?.members || 0;
      const productCount = usage.counters?.products || 0;

      // Check downgrade conflicts if moving to Standard
      if (targetPlan === 'standard') {
        const standardLimits = { branches: 3, members: 10, products: 5000 };
        const conflicts: Record<string, { current: number; allowed: number }> = {};

        if (branchCount > standardLimits.branches) {
          conflicts.branches = { current: branchCount, allowed: standardLimits.branches };
        }
        if (memberCount > standardLimits.members) {
          conflicts.members = { current: memberCount, allowed: standardLimits.members };
        }
        if (productCount > standardLimits.products) {
          conflicts.products = { current: productCount, allowed: standardLimits.products };
        }

        if (Object.keys(conflicts).length > 0) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'DOWNGRADE_CONFLICT',
              message: 'Cannot downgrade to Standard because current usage exceeds Standard limits. Please reduce resource usage before downgrading.',
              details: conflicts,
            },
          });
        }
      }

      // Initialize checkout for plan change
      const isAnnual = billingInterval === 'annual' || billingInterval === 'yearly';
      const amountInNaira = targetPlan === 'premium'
        ? (isAnnual ? 250000 : 25000)
        : (isAnnual ? 75000 : 7500);

      const reference = `ORV_CHG_${targetPlan.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;

      const initRes = await paystackService.initializePayment({
        email: request.user.email || 'customer@orviohub.com',
        amountInKobo: amountInNaira * 100,
        reference,
        metadata: {
          workspaceId,
          organizationId: workspaceId,
          planKey: targetPlan,
          billingInterval: isAnnual ? 'annual' : 'monthly',
          userId: request.user.id,
          action: 'plan_change',
        },
      });

      return reply.send({
        success: true,
        message: 'Plan change checkout initialized.',
        data: {
          reference,
          checkoutUrl: initRes.authorizationUrl,
          targetPlan,
          amount: amountInNaira,
          currency: 'NGN',
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to initiate plan change.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/change-plan', { preHandler: [fastify.authenticate] }, changePlanHandler);
  fastify.post('/billing/workspaces/:workspaceId/change-plan', { preHandler: [fastify.authenticate] }, changePlanHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/change-plan', { preHandler: [fastify.authenticate] }, changePlanHandler);

  // Helper: Verify billing permission (Owner, Admin, or Billing Manager)
  const verifyBillingPermission = async (user: any, workspaceId: string): Promise<boolean> => {
    if (!user || !workspaceId) return false;
    const userRole = ((user.role || '') as string).toUpperCase();
    if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;

    try {
      const membership = await dataService.getWorkspaceMembership(workspaceId, user.id || user.userId).catch(() => null);
      if (membership) {
        const role = (membership.role || '').toUpperCase();
        const permissions = membership.permissions || [];
        const isOwner = role === 'OWNER';
        const isBillingAdmin =
          role === 'ADMIN' ||
          role === 'BILLING_MANAGER' ||
          permissions.includes('manage_billing') ||
          permissions.includes('billing:write') ||
          permissions.includes('*');

        return isOwner || isBillingAdmin;
      }
      const orgMem = await dataService.getMembership(workspaceId, user.id || user.userId).catch(() => null);
      if (orgMem) {
        const role = (orgMem.role || '').toUpperCase();
        return role === 'OWNER' || role === 'ADMIN' || role === 'BILLING_MANAGER';
      }
      return true;
    } catch {
      return true;
    }
  };

  // 10. POST /workspaces/:workspaceId/billing/downgrade/preview - Preview downgrade conflicts
  const downgradePreviewHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body || {}) as any;
    const targetPlan = (body.targetPlan || body.targetPlanKey || 'standard').toLowerCase();

    const hasPerm = await verifyBillingPermission(request.user, workspaceId);
    if (!hasPerm) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Only organization owners and billing managers can manage subscription downgrades.',
        },
      });
    }

    if (targetPlan === 'free' || targetPlan === 'free_trial' || targetPlan === 'trial') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FREE_TRIAL_NOT_DOWNGRADE_DESTINATION',
          message: 'Free Trial is a one-time onboarding entitlement, not a downgrade destination. The only supported downgrade is Premium to Standard.',
        },
      });
    }

    if (targetPlan !== 'standard') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_DOWNGRADE_TARGET',
          message: `Cannot downgrade to "${targetPlan}". The only supported downgrade is Premium to Standard.`,
        },
      });
    }

    try {
      const result: any = await dataService.calculateDowngradeConflicts(workspaceId, 'standard');
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      const msg = err.message || '';
      const code = msg.includes('STANDARD_CANNOT_DOWNGRADE')
        ? 'STANDARD_CANNOT_DOWNGRADE'
        : msg.includes('FREE_TRIAL_NOT_DOWNGRADE_DESTINATION')
        ? 'FREE_TRIAL_NOT_DOWNGRADE_DESTINATION'
        : ERROR_CODES.VALIDATION_ERROR;
      return reply.status(400).send({
        success: false,
        error: {
          code,
          message: msg || 'Failed to preview downgrade conflicts.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/downgrade/preview', { preHandler: [fastify.authenticate] }, downgradePreviewHandler);
  fastify.post('/billing/workspaces/:workspaceId/downgrade/preview', { preHandler: [fastify.authenticate] }, downgradePreviewHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/downgrade/preview', { preHandler: [fastify.authenticate] }, downgradePreviewHandler);

  // 11. POST /workspaces/:workspaceId/billing/downgrade - Schedule Downgrade (Premium -> Standard)
  const scheduleDowngradeHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body || {}) as any;
    const targetPlan = (body.targetPlan || body.targetPlanKey || 'standard').toLowerCase();
    const idempotencyKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;

    const hasPerm = await verifyBillingPermission(request.user, workspaceId);
    if (!hasPerm) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Only organization owners and billing managers can schedule a downgrade.',
        },
      });
    }

    if (targetPlan === 'free' || targetPlan === 'free_trial' || targetPlan === 'trial') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FREE_TRIAL_NOT_DOWNGRADE_DESTINATION',
          message: 'Free Trial is a one-time onboarding entitlement, not a downgrade destination. The only supported downgrade is Premium to Standard.',
        },
      });
    }

    if (!body.confirmed) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Explicit user confirmation is required to schedule a downgrade.',
        },
      });
    }

    if (targetPlan !== 'standard') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_DOWNGRADE_TARGET',
          message: `"${targetPlan}" is not a valid downgrade target. Only Premium to Standard downgrade is supported.`,
        },
      });
    }

    const requestFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify({ workspaceId, targetPlan, decisions: body.resourceDecisions, reason: body.reason }))
      .digest('hex');

    if (idempotencyKey) {
      try {
        const acq: any = await dataService.mutate('subscriptions:acquireBillingIdempotency', {
          key: idempotencyKey,
          operation: 'downgrade_schedule',
          workspaceId,
          requestFingerprint,
        }).catch(() => null);

        if (acq?.status === 'conflict' || acq?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'This request key was already used for a different request payload.',
            },
          });
        }
        if (acq?.status === 'replayed' && acq?.responseBody) {
          return reply.status(acq.responseStatus || 200).send(acq.responseBody);
        }
      } catch {}
    }

    try {
      const result: any = await dataService.scheduleDowngradeWithConflictResolution({
        workspaceId,
        organizationId: workspaceId,
        userId: request.user.id,
        targetPlan: 'standard',
        targetPlanKey: 'standard',
        effectiveAt: body.effectiveAt,
        resourceDecisions: body.resourceDecisions,
        reason: body.reason,
      });

      const responsePayload = {
        success: true,
        message: 'Downgrade to Standard plan successfully scheduled for the end of the current billing period.',
        data: result,
      };

      if (idempotencyKey) {
        await dataService.mutate('subscriptions:completeBillingIdempotency', {
          key: idempotencyKey,
          status: 'completed',
          responseStatus: 200,
          responseBody: responsePayload,
        }).catch(() => {});
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      if (err.code === 'INVALID_RESOURCE_DECISION' || err.status === 400) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Invalid resource decisions for downgrade.',
          },
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to schedule downgrade.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/downgrade', { preHandler: [fastify.authenticate] }, scheduleDowngradeHandler);
  fastify.post('/billing/workspaces/:workspaceId/downgrade', { preHandler: [fastify.authenticate] }, scheduleDowngradeHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/downgrade', { preHandler: [fastify.authenticate] }, scheduleDowngradeHandler);

  // 12. GET /workspaces/:workspaceId/billing/downgrade - Get scheduled downgrade info
  const getDowngradeHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const result = await dataService.getScheduledDowngrade(workspaceId);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch downgrade details.',
        },
      });
    }
  };

  fastify.get('/workspaces/:workspaceId/billing/downgrade', { preHandler: [fastify.authenticate] }, getDowngradeHandler);
  fastify.get('/billing/workspaces/:workspaceId/downgrade', { preHandler: [fastify.authenticate] }, getDowngradeHandler);
  fastify.get('/api/v1/workspaces/:workspaceId/billing/downgrade', { preHandler: [fastify.authenticate] }, getDowngradeHandler);

  // 13. POST /workspaces/:workspaceId/billing/downgrade/cancel - Cancel scheduled downgrade
  const cancelDowngradeHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body || {}) as any;
    const idempotencyKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;

    const hasPerm = await verifyBillingPermission(request.user, workspaceId);
    if (!hasPerm) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Only organization owners and billing managers can cancel a scheduled downgrade.',
        },
      });
    }

    const requestFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify({ workspaceId, action: 'cancel_downgrade' }))
      .digest('hex');

    if (idempotencyKey) {
      try {
        const acq: any = await dataService.mutate('subscriptions:acquireBillingIdempotency', {
          key: idempotencyKey,
          operation: 'downgrade_cancel',
          workspaceId,
          requestFingerprint,
        }).catch(() => null);

        if (acq?.status === 'conflict' || acq?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'This request key was already used for a different request payload.',
            },
          });
        }
        if (acq?.status === 'replayed' && acq?.responseBody) {
          return reply.status(acq.responseStatus || 200).send(acq.responseBody);
        }
      } catch {}
    }

    try {
      const result = await dataService.cancelScheduledDowngrade(workspaceId, request.user.id);
      const responsePayload = {
        success: true,
        message: 'Scheduled downgrade has been cancelled. Your current plan and entitlements will renew normally.',
        data: result,
      };

      if (idempotencyKey) {
        await dataService.mutate('subscriptions:completeBillingIdempotency', {
          key: idempotencyKey,
          status: 'completed',
          responseStatus: 200,
          responseBody: responsePayload,
        }).catch(() => {});
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to cancel scheduled downgrade.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/downgrade/cancel', { preHandler: [fastify.authenticate] }, cancelDowngradeHandler);
  fastify.post('/billing/workspaces/:workspaceId/downgrade/cancel', { preHandler: [fastify.authenticate] }, cancelDowngradeHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/downgrade/cancel', { preHandler: [fastify.authenticate] }, cancelDowngradeHandler);

  // 14. POST /workspaces/:workspaceId/billing/downgrade/apply - Apply due scheduled downgrade immediately
  const applyDowngradeHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const result: any = await dataService.applyScheduledBillingChanges(workspaceId);
      return reply.send({
        success: true,
        message: 'Pending scheduled billing changes checked and applied.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to apply scheduled changes.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/downgrade/apply', { preHandler: [fastify.authenticate] }, applyDowngradeHandler);
  fastify.post('/billing/workspaces/:workspaceId/downgrade/apply', { preHandler: [fastify.authenticate] }, applyDowngradeHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/downgrade/apply', { preHandler: [fastify.authenticate] }, applyDowngradeHandler);

  // 15. POST /workspaces/:workspaceId/billing/cancel - Schedule Cancellation at Period End
  const cancelSubscriptionHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { reason, cancelAtPeriodEnd = true } = (request.body as any) || {};
    const idempotencyKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;

    const hasPerm = await verifyBillingPermission(request.user, workspaceId);
    if (!hasPerm) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Only organization owners and billing managers can cancel the subscription.',
        },
      });
    }

    const requestFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify({ workspaceId, reason, cancelAtPeriodEnd }))
      .digest('hex');

    if (idempotencyKey) {
      try {
        const acq: any = await dataService.mutate('subscriptions:acquireBillingIdempotency', {
          key: idempotencyKey,
          operation: 'subscription_cancel',
          workspaceId,
          requestFingerprint,
        }).catch(() => null);

        if (acq?.status === 'conflict' || acq?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'This request key was already used for a different request payload.',
            },
          });
        }
        if (acq?.status === 'replayed' && acq?.responseBody) {
          return reply.status(acq.responseStatus || 200).send(acq.responseBody);
        }
      } catch {}
    }

    try {
      const result: any = await dataService.cancelSubscription({
        workspaceId,
        organizationId: workspaceId,
        userId: request.user.id,
        reason,
        cancelAtPeriodEnd,
      });

      const responsePayload = {
        success: true,
        message: 'Subscription has been scheduled for cancellation at the end of the billing period. Access will continue until then, and data remains preserved.',
        data: result,
      };

      if (idempotencyKey) {
        await dataService.mutate('subscriptions:completeBillingIdempotency', {
          key: idempotencyKey,
          status: 'completed',
          responseStatus: 200,
          responseBody: responsePayload,
        }).catch(() => {});
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to cancel subscription.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/cancel', { preHandler: [fastify.authenticate] }, cancelSubscriptionHandler);
  fastify.post('/billing/workspaces/:workspaceId/cancel', { preHandler: [fastify.authenticate] }, cancelSubscriptionHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/cancel', { preHandler: [fastify.authenticate] }, cancelSubscriptionHandler);
  fastify.post('/billing/cancel', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const body = request.body || {};
    const targetWsId = body.workspaceId || body.organizationId;
    if (!targetWsId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'workspaceId or organizationId required' } });
    }
    request.params = { workspaceId: targetWsId };
    return cancelSubscriptionHandler(request, reply);
  });

  // 16. GET /workspaces/:workspaceId/billing/cancellation - Get cancellation status
  const getCancellationHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const result = await dataService.getCancellationStatus(workspaceId);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch cancellation status.',
        },
      });
    }
  };

  fastify.get('/workspaces/:workspaceId/billing/cancellation', { preHandler: [fastify.authenticate] }, getCancellationHandler);
  fastify.get('/billing/workspaces/:workspaceId/cancellation', { preHandler: [fastify.authenticate] }, getCancellationHandler);
  fastify.get('/api/v1/workspaces/:workspaceId/billing/cancellation', { preHandler: [fastify.authenticate] }, getCancellationHandler);

  // 17. POST /workspaces/:workspaceId/billing/resume & POST /workspaces/:workspaceId/billing/cancellation/cancel - Resume Subscription
  const resumeSubscriptionHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body || {}) as any;
    const idempotencyKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;

    const hasPerm = await verifyBillingPermission(request.user, workspaceId);
    if (!hasPerm) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Only organization owners and billing managers can resume a subscription.',
        },
      });
    }

    const requestFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify({ workspaceId, reason: body.reason, action: 'resume' }))
      .digest('hex');

    if (idempotencyKey) {
      try {
        const acq: any = await dataService.mutate('subscriptions:acquireBillingIdempotency', {
          key: idempotencyKey,
          operation: 'subscription_resume',
          workspaceId,
          requestFingerprint,
        }).catch(() => null);

        if (acq?.status === 'conflict' || acq?.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'This request key was already used for a different request payload.',
            },
          });
        }
        if (acq?.status === 'replayed' && acq?.responseBody) {
          return reply.status(acq.responseStatus || 200).send(acq.responseBody);
        }
      } catch {}
    }

    try {
      const result: any = await dataService.resumeSubscription({
        workspaceId,
        organizationId: workspaceId,
        userId: request.user.id,
      });

      const responsePayload = {
        success: true,
        message: 'Subscription has been resumed. It will renew normally at the end of the billing period.',
        data: result,
      };

      if (idempotencyKey) {
        await dataService.mutate('subscriptions:completeBillingIdempotency', {
          key: idempotencyKey,
          status: 'completed',
          responseStatus: 200,
          responseBody: responsePayload,
        }).catch(() => {});
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to resume subscription.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/resume', { preHandler: [fastify.authenticate] }, resumeSubscriptionHandler);
  fastify.post('/billing/workspaces/:workspaceId/resume', { preHandler: [fastify.authenticate] }, resumeSubscriptionHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/resume', { preHandler: [fastify.authenticate] }, resumeSubscriptionHandler);
  fastify.post('/workspaces/:workspaceId/billing/cancellation/cancel', { preHandler: [fastify.authenticate] }, resumeSubscriptionHandler);
  fastify.post('/billing/workspaces/:workspaceId/cancellation/cancel', { preHandler: [fastify.authenticate] }, resumeSubscriptionHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/cancellation/cancel', { preHandler: [fastify.authenticate] }, resumeSubscriptionHandler);
  fastify.post('/billing/resume', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const body = request.body || {};
    const targetWsId = body.workspaceId || body.organizationId;
    if (!targetWsId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'workspaceId or organizationId required' } });
    }
    request.params = { workspaceId: targetWsId };
    return resumeSubscriptionHandler(request, reply);
  });

  // 18. POST /workspaces/:workspaceId/billing/apply-scheduled-change & reconcile
  const applyScheduledChangeHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const result: any = await dataService.applyScheduledBillingChanges(workspaceId);
      return reply.send({
        success: true,
        message: 'Scheduled changes checked and applied if due.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to apply scheduled changes.',
        },
      });
    }
  };

  const reconcileHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      let result: any = null;
      if (typeof (dataService as any).reconcileSubscription === 'function') {
        result = await (dataService as any).reconcileSubscription(workspaceId);
      } else {
        result = await dataService.applyScheduledBillingChanges(workspaceId);
      }
      return reply.send({
        success: true,
        message: 'Subscription state reconciled.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to reconcile subscription.',
        },
      });
    }
  };

  fastify.post('/workspaces/:workspaceId/billing/apply-scheduled-change', { preHandler: [fastify.authenticate] }, applyScheduledChangeHandler);
  fastify.post('/billing/workspaces/:workspaceId/apply-scheduled-change', { preHandler: [fastify.authenticate] }, applyScheduledChangeHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/apply-scheduled-change', { preHandler: [fastify.authenticate] }, applyScheduledChangeHandler);
  fastify.post('/workspaces/:workspaceId/billing/reconcile', { preHandler: [fastify.authenticate] }, reconcileHandler);
  fastify.post('/billing/workspaces/:workspaceId/reconcile', { preHandler: [fastify.authenticate] }, reconcileHandler);
  fastify.post('/api/v1/workspaces/:workspaceId/billing/reconcile', { preHandler: [fastify.authenticate] }, reconcileHandler);

  // 12. POST /billing/webhooks/paystack - Authoritative Paystack Webhook Handler
  fastify.post(
    '/billing/webhooks/paystack',
    {
      config: { rawBody: true },
      schema: {
        tags: ['Webhooks'],
        summary: 'Paystack webhook receiver with signature validation and idempotent processing',
      },
    },
    async (request: any, reply: any) => {
      const signature = request.headers['x-paystack-signature'] as string;
      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});

      if (signature && !paystackService.verifyWebhookSignature(rawBody, signature)) {
        return reply.status(401).send({ message: 'Invalid Paystack signature' });
      }

      const payload = (request.body || {}) as any;
      const event = payload.event;
      const data = payload.data || {};
      const eventId = String(payload.id || data.id || data.reference || `evt_${Date.now()}`);

      try {
        await dataService.mutate('paystackWebhook:handleWebhook', {
          event,
          data,
          providerEventId: eventId,
        });
        return reply.status(200).send({ success: true, received: true, status: 'success', eventId });
      } catch (err: any) {
        fastify.log.error(err, `Error processing Paystack webhook event ${event}`);
        return reply.status(200).send({ success: true, received: true, status: 'acknowledged_with_error', error: err.message });
      }
    }
  );

  // ==========================================
  // EXISTING / LEGACY ROUTE COMPATIBILITY
  // ==========================================
  // GET /api/v1/workspaces/:workspaceId/subscription
  fastify.get(
    '/workspaces/:workspaceId/subscription',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get workspace subscription details and active plan',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const subscription = await dataService.getWorkspaceSubscription(workspaceId);
        const plan = await dataService.getPlanByKey(subscription.planKey || 'free');

        return reply.send({
          success: true,
          data: {
            subscription,
            plan,
          },
        });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: err.message || 'Workspace subscription not found.',
          },
        });
      }
    }
  );

  // GET /api/v1/workspaces/:workspaceId/usage
  fastify.get(
    '/workspaces/:workspaceId/usage',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get workspace resource usage counters and limits',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const usage = await dataService.getWorkspaceUsage(workspaceId);
        const subscription = await dataService.getWorkspaceSubscription(workspaceId);
        const plan = await dataService.getPlanByKey(subscription.planKey || 'free');

        return reply.send({
          success: true,
          data: {
            workspaceId,
            planKey: plan.key,
            usage: usage.counters,
            records: usage.records,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch usage.',
          },
        });
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/subscription/request-upgrade
  fastify.post(
    '/workspaces/:workspaceId/subscription/request-upgrade',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Submit a manual plan upgrade inquiry / contact request',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            requestedPlan: { type: 'string', enum: ['standard', 'premium'] },
            contactMethod: { type: 'string' },
            note: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};

      try {
        // Log notification / audit trail for platform owner
        await dataService.logAudit({
          workspaceId,
          actorUserId: request.user.id,
          eventType: 'billing.upgrade_requested',
          entityType: 'workspace',
          entityId: workspaceId,
          metadata: {
            requestedPlan: body.requestedPlan || 'standard',
            contactMethod: body.contactMethod,
            note: body.note,
            userEmail: request.user.email,
          },
        });

        return reply.send({
          success: true,
          message:
            'Upgrade request submitted! Our team will contact you shortly to complete the activation.',
          data: {
            workspaceId,
            requestedPlan: body.requestedPlan || 'standard',
            supportWhatsApp: '+2348000000000',
            supportEmail: 'billing@orviohub.com',
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to submit upgrade request.',
          },
        });
      }
    }
  );

  // GET /api/v1/workspaces/:workspaceId/usage/summary
  fastify.get(
    '/workspaces/:workspaceId/usage/summary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get unified resource usage percentages and limit threshold warnings',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const summary = await entitlementService.getWorkspaceUsageSummary(
          workspaceId,
          request.user.id
        );

        return reply.send({
          success: true,
          data: summary,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to get usage summary.',
          },
        });
      }
    }
  );

  // GET /api/v1/billing/payment-details
  fastify.get(
    '/billing/payment-details',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Get official offline bank transfer instructions and accounts',
      },
    },
    async (_request, reply) => {
      return reply.send({
        success: true,
        data: {
          bankAccounts: [
            {
              bankName: 'Guaranty Trust Bank (GTBank)',
              accountName: 'Orvio Technologies Limited',
              accountNumber: '0123456789',
              currency: 'NGN',
            },
            {
              bankName: 'Providus Bank',
              accountName: 'Orvio Technologies Limited',
              accountNumber: '5401928374',
              currency: 'NGN',
            },
          ],
          instructions:
            'Please transfer the exact subscription amount with your Workspace Slug or Name as the payment narration / reference. Send confirmation to billing@orviohub.com or submit reference in-app.',
          supportEmail: 'billing@orviohub.com',
          supportPhone: '+2348000000000',
        },
      });
    }
  );

  // GET /api/v1/billing/config
  fastify.get(
    '/billing/config',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Get public payment gateway keys and configuration',
      },
    },
    async (_request, reply) => {
      return reply.send({
        success: true,
        data: {
          paystackPublicKey: env.PAYSTACK_PUBLIC_KEY || '',
          flutterwavePublicKey: env.FLUTTERWAVE_PUBLIC_KEY || '',
        },
      });
    }
  );

  // POST /api/v1/billing/initialize
  fastify.post(
    '/billing/initialize',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Initialize Paystack or Flutterwave payment checkout for workspace plan upgrade or onboarding',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['planKey', 'gateway'],
          properties: {
            workspaceId: { type: 'string' },
            planKey: { type: 'string', enum: ['standard', 'premium'] },
            billingCycle: { type: 'string', enum: ['monthly', 'annual'], default: 'monthly' },
            gateway: { type: 'string', enum: ['paystack', 'flutterwave'] },
            callbackUrl: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { workspaceId, planKey, billingCycle = 'monthly', gateway, callbackUrl } = request.body as {
        workspaceId?: string;
        planKey: 'standard' | 'premium';
        billingCycle?: 'monthly' | 'annual';
        gateway: 'paystack' | 'flutterwave';
        callbackUrl?: string;
      };

      try {
        const plan = await dataService.getPlanByKey(planKey);
        const isAnnual = billingCycle === 'annual';
        const amountInKobo = isAnnual ? (plan.annualPrice || plan.monthlyPrice * 10) : plan.monthlyPrice;
        const amountInNaira = Math.round(amountInKobo / 100);

        const reference = `orv_${gateway === 'paystack' ? 'pst' : 'flw'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const customerEmail = user?.email || 'customer@orviohub.com';

        // Record pending transaction in database
        await dataService.recordInitiatedTransaction({
          workspaceId: workspaceId || '',
          planKey,
          amount: amountInKobo,
          currency: 'NGN',
          billingCycle,
          gateway,
          gatewayReference: reference,
          customerEmail,
          metadata: {
            userId: user.userId,
            workspaceId,
            planKey,
            billingCycle,
          },
        });

        if (gateway === 'paystack') {
          const initRes = await paystackService.initializePayment({
            email: customerEmail,
            amountInKobo,
            reference,
            callbackUrl,
            metadata: {
              workspaceId,
              planKey,
              billingCycle,
              userId: user.userId,
            },
          });

          return reply.send({
            success: true,
            data: {
              gateway: 'paystack',
              reference,
              checkoutUrl: initRes.authorizationUrl,
              accessCode: initRes.accessCode,
              amount: amountInNaira,
              amountInKobo,
              currency: 'NGN',
            },
          });
        } else {
          const initRes = await flutterwaveService.initializePayment({
            email: customerEmail,
            amountInNaira,
            txRef: reference,
            redirectUrl: callbackUrl,
            meta: {
              workspaceId,
              planKey,
              billingCycle,
              userId: user.userId,
            },
          });

          return reply.send({
            success: true,
            data: {
              gateway: 'flutterwave',
              reference,
              checkoutUrl: initRes.paymentLink,
              amount: amountInNaira,
              amountInKobo,
              currency: 'NGN',
            },
          });
        }
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to initialize payment checkout.',
          },
        });
      }
    }
  );

  // GET /api/v1/billing/verify
  fastify.get(
    '/billing/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Verify payment status and activate workspace subscription plan',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['reference', 'gateway'],
          properties: {
            reference: { type: 'string' },
            gateway: { type: 'string', enum: ['paystack', 'flutterwave'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { reference, gateway } = request.query as {
        reference: string;
        gateway: 'paystack' | 'flutterwave';
      };

      try {
        if (gateway === 'paystack') {
          const verifyRes = await paystackService.verifyPayment(reference);
          if (verifyRes.status !== 'success') {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'PAYMENT_NOT_SUCCESSFUL',
                message: `Paystack payment status is ${verifyRes.status}`,
              },
            });
          }

          const result = await dataService.markSuccessfulTransaction({
            gatewayReference: reference,
            gateway: 'paystack',
            metadata: verifyRes.metadata,
          });

          return reply.send({
            success: true,
            data: {
              ...result,
              gateway: 'paystack',
              status: 'success',
            },
          });
        } else {
          const verifyRes = await flutterwaveService.verifyPayment(reference);
          if (verifyRes.status !== 'success') {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'PAYMENT_NOT_SUCCESSFUL',
                message: `Flutterwave payment status is ${verifyRes.status}`,
              },
            });
          }

          const result = await dataService.markSuccessfulTransaction({
            gatewayReference: reference,
            gateway: 'flutterwave',
            metadata: verifyRes.meta,
          });

          return reply.send({
            success: true,
            data: {
              ...result,
              gateway: 'flutterwave',
              status: 'success',
            },
          });
        }
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Payment verification failed.',
          },
        });
      }
    }
  );



  // GET /billing/subscription - Get active user or organization subscription
  fastify.get(
    '/billing/subscription',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get authenticated user or organization subscription and plan details',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { organizationId?: string; workspaceId?: string };
      try {
        const now = Date.now();
        let targetWorkspaceId = query.workspaceId;
        if (!targetWorkspaceId && query.organizationId) {
          const workspaces = await dataService.getOrganizationWorkspaces(query.organizationId);
          if (workspaces && workspaces.length > 0) {
            targetWorkspaceId = workspaces[0]._id || workspaces[0].id;
          }
        }

        let sub: any;
        if (query.organizationId) {
          sub = await dataService.getOrganizationSubscription(query.organizationId);
        } else if (targetWorkspaceId) {
          sub = await dataService.getWorkspaceSubscription(targetWorkspaceId);
        } else {
          // Fallback to first user organization if available
          try {
            const memberships = await dataService.getUserMemberships(request.user.id);
            const firstOrgId = memberships?.[0]?.membership?.organizationId || memberships?.[0]?.organization?.id;
            if (firstOrgId) {
              sub = await dataService.getOrganizationSubscription(firstOrgId);
            }
          } catch {}
        }

        const effectivePlan = sub?.planKey || sub?.planId || sub?.plan?.key || 'free_trial';
        const effectiveStatus = sub?.status || 'trialing';

        return reply.send({
          success: true,
          data: {
            subscription: {
              id: sub?._id || sub?.id || 'sub_default',
              organizationId: query.organizationId || sub?.organizationId || targetWorkspaceId,
              workspaceId: targetWorkspaceId,
              planId: effectivePlan,
              planKey: effectivePlan,
              status: effectiveStatus,
              currentPeriodStart: sub?.currentPeriodStart || now,
              currentPeriodEnd: sub?.currentPeriodEnd || now + 14 * 86_400_000,
              trialEndsAt: sub?.trialEndsAt || sub?.trialEnd,
              cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
            },
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch subscription.',
          },
        });
      }
    }
  );

  const handleSubscribe = async (request: any, reply: any) => {
    const body = request.body as any;

    try {
      const effectivePlanKey = body.planKey || body.planId || 'free_trial';
      const normalizedPlanKey = (effectivePlanKey === 'free' ? 'free_trial' : effectivePlanKey) as 'free_trial' | 'standard' | 'premium';
      const interval = body.billingInterval || body.billingCycle || 'monthly';
      const now = Date.now();
      const orgId = body.organizationId;
      const targetWorkspaceId = body.workspaceId || orgId;
      const paymentRef = body.paymentReference || body.providerReference || body.reference;
      const gateway = body.paymentGateway || body.provider || 'paystack';

      if (normalizedPlanKey === 'free_trial') {
        const trialEnd = now + 14 * 86_400_000;
        let sub: any;

        if (orgId) {
          sub = await dataService.updateOrganizationSubscription(
            orgId,
            'free_trial',
            'trialing',
            trialEnd,
            trialEnd,
            false
          );
        } else if (targetWorkspaceId) {
          sub = await dataService.updateWorkspaceSubscription(
            targetWorkspaceId,
            'free_trial',
            'trialing',
            trialEnd,
            false
          );
        }

        return reply.send({
          success: true,
          message: '14-day Free Trial activated successfully.',
          data: {
            subscription: {
              id: sub?._id || 'sub_trialing',
              organizationId: orgId,
              planId: 'free_trial',
              planKey: 'free_trial',
              status: 'trialing',
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
              trialEndsAt: trialEnd,
              cancelAtPeriodEnd: false,
            },
            planKey: 'free_trial',
            status: 'trialing',
            currentPeriodEnd: trialEnd,
          },
        });
      } else {
        const periodDays = interval === 'annual' ? 365 : 30;
        const currentPeriodEnd = now + periodDays * 86_400_000;
        let sub: any;

        if (orgId) {
          sub = await dataService.updateOrganizationSubscription(
            orgId,
            normalizedPlanKey,
            'active',
            currentPeriodEnd,
            undefined,
            false
          );
        } else if (targetWorkspaceId) {
          sub = await dataService.updateWorkspaceSubscription(
            targetWorkspaceId,
            normalizedPlanKey,
            'active',
            currentPeriodEnd,
            false
          );
        }

        if (paymentRef) {
          await dataService.logAudit({
            actorUserId: request.user.id,
            workspaceId: targetWorkspaceId,
            eventType: 'billing.payment_received',
            entityType: 'subscription',
            metadata: {
              organizationId: orgId,
              planKey: normalizedPlanKey,
              amount: normalizedPlanKey === 'premium' ? (interval === 'annual' ? 200000 : 20000) : (interval === 'annual' ? 75000 : 7500),
              reference: paymentRef,
              gateway,
            },
          });
        }

        return reply.send({
          success: true,
          message: `${normalizedPlanKey.toUpperCase()} subscription activated successfully.`,
          data: {
            subscription: {
              id: sub?._id || 'sub_active',
              organizationId: orgId,
              planId: normalizedPlanKey,
              planKey: normalizedPlanKey,
              status: 'active',
              currentPeriodStart: now,
              currentPeriodEnd,
              cancelAtPeriodEnd: false,
            },
            planKey: normalizedPlanKey,
            planId: normalizedPlanKey,
            status: 'active',
            currentPeriodEnd,
          },
        });
      }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: err.message || 'Failed to process subscription.',
        },
      });
    }
  };

  // POST /billing/subscribe - Select or activate subscription plan (Free Trial or Standard)
  fastify.post(
    '/billing/subscribe',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Select or activate subscription plan for user/organization (Free Trial or Paid)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
            planKey: { type: 'string' },
            planId: { type: 'string' },
            billingInterval: { type: 'string' },
            billingCycle: { type: 'string' },
            paymentReference: { type: 'string' },
            providerReference: { type: 'string' },
            paymentGateway: { type: 'string' },
            provider: { type: 'string' },
          },
        },
      },
    },
    handleSubscribe
  );




  // POST /billing/payment-intent - Initiate payment checkout (checklist alias)
  fastify.post(
    '/billing/payment-intent',
    {
      preHandler: async (request: any) => {
        try {
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            request.user = await request.jwtVerify();
          } else if (request.cookies?.session || request.cookies?.orvio_session) {
            const sessionCookie = request.cookies.session || request.cookies.orvio_session;
            request.user = fastify.jwt.verify(sessionCookie);
          }
        } catch {
          // Allow guest/onboarding checkout
        }
      },
      schema: {
        tags: ['Billing'],
        summary: 'Initiate payment intent for plan subscription / upgrade',
        body: {
          type: 'object',
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
            planKey: { type: 'string' },
            planId: { type: 'string' },
            billingCycle: { type: 'string' },
            billingInterval: { type: 'string' },
            gateway: { type: 'string' },
            provider: { type: 'string' },
            email: { type: 'string' },
            callbackUrl: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const body = (request.body || {}) as any;
      const planKey = body.planKey || body.planId || 'standard';
      const gateway = body.gateway || body.provider || 'paystack';
      const billingCycle = body.billingCycle || body.billingInterval || 'monthly';
      const workspaceId = body.workspaceId || body.organizationId;
      const callbackUrl = body.callbackUrl;

      try {
        const plan = await dataService.getPlanByKey(planKey);
        const isAnnual = billingCycle === 'annual';
        const amountInKobo = isAnnual ? (plan.annualPrice || plan.monthlyPrice * 10) : plan.monthlyPrice;
        const amountInNaira = Math.round(amountInKobo / 100);
        const reference = `orv_${gateway === 'paystack' ? 'pst' : 'flw'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const customerEmail = user?.email || body.email || 'customer@orviohub.localhost';

        await dataService.recordInitiatedTransaction({
          workspaceId: workspaceId || '',
          planKey,
          amount: amountInKobo,
          currency: 'NGN',
          billingCycle,
          gateway,
          gatewayReference: reference,
          customerEmail,
          metadata: {
            userId: user?.userId || user?.id || 'guest_user',
            workspaceId,
            planKey,
            billingCycle,
          },
        });

        let checkoutUrl = '';
        let accessCode = '';

        if (gateway === 'paystack') {
          try {
            const initRes = await paystackService.initializePayment({
              email: customerEmail,
              amountInKobo,
              reference,
              callbackUrl,
              metadata: {
                workspaceId,
                planKey,
                billingCycle,
                userId: user?.userId || user?.id || 'guest_user',
              },
            });
            checkoutUrl = initRes.authorizationUrl;
            accessCode = initRes.accessCode;
          } catch {
            checkoutUrl = `https://checkout.paystack.com/dev-checkout-${reference}`;
            accessCode = `acc_${reference}`;
          }

          return reply.send({
            success: true,
            data: {
              gateway: 'paystack',
              reference,
              checkoutUrl,
              accessCode,
              amount: amountInKobo,
              amountInKobo,
              amountInNaira,
              currency: 'NGN',
            },
          });
        } else {
          try {
            const initRes = await flutterwaveService.initializePayment({
              email: customerEmail,
              amountInNaira,
              txRef: reference,
              redirectUrl: callbackUrl,
              meta: {
                workspaceId,
                planKey,
                billingCycle,
                userId: user?.userId || user?.id || 'guest_user',
              },
            });
            checkoutUrl = initRes.paymentLink;
          } catch {
            checkoutUrl = `https://checkout.flutterwave.com/dev-checkout-${reference}`;
          }

          return reply.send({
            success: true,
            data: {
              gateway: 'flutterwave',
              reference,
              checkoutUrl,
              amount: amountInKobo,
              amountInKobo,
              amountInNaira,
              currency: 'NGN',
            },
          });
        }
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to initialize payment intent.',
          },
        });
      }
    }
  );

  // POST /billing/webhook - Unified billing webhook endpoint
  fastify.post(
    '/billing/webhook',
    {
      schema: {
        tags: ['Billing', 'Webhooks'],
        summary: 'Unified billing webhook endpoint for payment providers',
      },
    },
    async (request, reply) => {
      const payload = (request.body || {}) as any;
      const gateway = payload.provider || (payload.event?.startsWith('charge.') ? 'paystack' : 'flutterwave');
      const reference = payload.reference || payload.data?.reference || payload.tx_ref || payload.data?.tx_ref;

      if (reference) {
        try {
          await dataService.markSuccessfulTransaction({
            gatewayReference: reference,
            gateway: gateway === 'flutterwave' ? 'flutterwave' : 'paystack',
            metadata: payload,
          });
        } catch (err: any) {
          fastify.log.error(err, `Error processing webhook for ${reference}`);
        }
      }

      return reply.send({ success: true, status: 'processed' });
    }
  );

  // POST /billing/initialize-checkout - Initialize Paystack checkout for user
  fastify.post(
    '/billing/initialize-checkout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Initialize Paystack checkout for plan upgrade',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['planKey', 'amount'],
          properties: {
            planKey: { type: 'string' },
            amount: { type: 'number' },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { planKey: string; amount: number; billingInterval?: string };
      try {
        const reference = `usr_${request.user.id.slice(-6)}_${Date.now()}`;
        const paystackRes = await paystackService.initializePayment({
          email: request.user.email,
          amountInKobo: Math.round(body.amount * 100),
          reference,
          metadata: {
            userId: request.user.id,
            planKey: body.planKey,
            billingInterval: body.billingInterval || 'monthly',
          },
        });

        return reply.send({
          success: true,
          data: {
            reference,
            authorizationUrl: paystackRes.authorizationUrl,
          },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to initialize payment.',
          },
        });
      }
    }
  );

  // POST /billing/verify - Verify checkout payment
  fastify.post(
    '/billing/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Verify Paystack payment and activate user plan',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['reference'],
          properties: {
            reference: { type: 'string' },
            planKey: { type: 'string' },
            billingInterval: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { reference, planKey, billingInterval } = request.body as {
        reference: string;
        planKey?: string;
        billingInterval?: string;
      };

      try {
        const verifyRes = await paystackService.verifyPayment(reference);
        if (verifyRes.status !== 'success') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'PAYMENT_VERIFICATION_FAILED',
              message: 'Payment verification failed or transaction not completed.',
            },
          });
        }

        const effectivePlan = planKey || verifyRes.metadata?.planKey || 'standard';
        const effectiveInterval = (billingInterval || verifyRes.metadata?.billingInterval || 'monthly') as 'monthly' | 'annual';
        const periodDuration = effectiveInterval === 'annual' ? 365 : 30;
        const currentPeriodEnd = Date.now() + periodDuration * 86_400_000;
        const bodyOrgId = (request.body as any)?.organizationId;
        const bodyWsId = (request.body as any)?.workspaceId;
        const metaOrgId = verifyRes.metadata?.organizationId;
        const metaWsId = verifyRes.metadata?.workspaceId;

        const effectiveOrgId = bodyOrgId || metaOrgId;
        const effectiveWorkspaceId = bodyWsId || metaWsId;

        let updated: any;
        if (effectiveOrgId) {
          updated = await dataService.updateOrganizationSubscription(
            effectiveOrgId,
            effectivePlan,
            'active',
            currentPeriodEnd,
            undefined,
            false
          );
          try {
            await dataService.recordOrganizationPayment({
              organizationId: effectiveOrgId,
              userId: request.user.id,
              amount: (verifyRes as any).amount ? (verifyRes as any).amount / 100 : 7500,
              currency: 'NGN',
              provider: 'paystack',
              providerReference: reference,
              status: 'success',
            });
          } catch {}
        } else if (effectiveWorkspaceId) {
          updated = await dataService.updateWorkspaceSubscription(
            effectiveWorkspaceId,
            effectivePlan,
            'active',
            currentPeriodEnd,
            false
          );
        } else {
          // Fallback to user's first organization
          try {
            const memberships = await dataService.getUserMemberships(request.user.id);
            const firstOrgId = memberships?.[0]?.membership?.organizationId || memberships?.[0]?.organization?.id;
            if (firstOrgId) {
              updated = await dataService.updateOrganizationSubscription(
                firstOrgId,
                effectivePlan,
                'active',
                currentPeriodEnd,
                undefined,
                false
              );
            }
          } catch {}
        }

        return reply.send({
          success: true,
          message: `Subscription successfully upgraded to ${effectivePlan}.`,
          data: { subscription: updated },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Payment verification failed.',
          },
        });
      }
    }
  );

  // GET /billing/user-free-trial-status - Query user free trial status
  fastify.get(
    '/billing/user-free-trial-status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Check if current user has an active Free Trial organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await dataService.getUserFreeTrialStatus(request.user.id);
        return reply.send({
          success: true,
          data: result || { hasFreeTrial: false },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check free trial status.',
          },
        });
      }
    }
  );

  // POST /billing/confirm-org-payment - Confirm payment and activate organization
  fastify.post(
    '/billing/confirm-org-payment',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Confirm payment and activate organization Standard plan',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['organizationId', 'paymentReference'],
          properties: {
            organizationId: { type: 'string' },
            paymentReference: { type: 'string' },
            provider: { type: 'string' },
            amount: { type: 'number' },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        organizationId: string;
        paymentReference: string;
        provider?: string;
        amount?: number;
        billingInterval?: 'monthly' | 'annual';
      };

      try {
        const result = await dataService.confirmPaymentAndActivateOrg({
          organizationId: body.organizationId,
          paymentReference: body.paymentReference,
          provider: body.provider || 'paystack',
          amount: body.amount,
          billingInterval: body.billingInterval,
          userId: request.user.id,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PAYMENT_ACTIVATION_FAILED',
            message: err.message || 'Failed to confirm payment and activate organization.',
          },
        });
      }
    }
  );

  // POST /billing/switch-org-plan - Switch pending/onboarding organization plan
  fastify.post(
    '/billing/switch-org-plan',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Switch organization plan during onboarding or checkout',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['organizationId', 'newPlanKey'],
          properties: {
            organizationId: { type: 'string' },
            newPlanKey: { type: 'string' },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        organizationId: string;
        newPlanKey: 'free_trial' | 'standard';
        billingInterval?: 'monthly' | 'annual';
      };

      try {
        const result = await dataService.switchOrgPlan({
          organizationId: body.organizationId,
          newPlanKey: body.newPlanKey,
          billingInterval: body.billingInterval,
          userId: request.user.id,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PLAN_SWITCH_FAILED',
            message: err.message || 'Failed to switch organization plan.',
          },
        });
      }
    }
  );

  // GET /api/v1/organizations/:organizationId/billing/context - Authoritative Organization Billing Context
  fastify.get(
    '/organizations/:organizationId/billing/context',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get single authoritative organization subscription and entitlement context',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      try {
        const context = await dataService.getOrganizationBillingContext(organizationId);
        return reply.send({
          success: true,
          data: context,
        });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: err.message || 'Organization billing context not found.',
          },
        });
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/billing/checkout - Initialize Paystack Checkout for Organization
  fastify.post(
    '/organizations/:organizationId/billing/checkout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Initialize Paystack payment checkout for Standard organization plan',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            planKey: { type: 'string' },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
            callbackUrl: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const body = (request.body || {}) as {
        planKey?: string;
        billingInterval?: 'monthly' | 'annual';
        callbackUrl?: string;
      };
      const userId = request.user?.id || (request.user as any)?._id || 'unknown_user';
      const userEmail = request.user?.email || 'customer@orviohub.com';
      const billingInterval = body.billingInterval || 'monthly';
      const expectedAmount = billingInterval === 'annual' ? 75000 : 7500;

      try {
        const initCheckout = await dataService.initializeBillingCheckout({
          organizationId,
          userId,
          billingInterval,
          amount: expectedAmount,
        });

        const paystackRes = await paystackService.initializePayment({
          email: userEmail,
          amountInKobo: expectedAmount * 100,
          reference: initCheckout.reference,
          callbackUrl: body.callbackUrl,
          metadata: {
            organizationId,
            billingInterval,
            userId,
          },
        });

        return reply.send({
          success: true,
          data: {
            reference: initCheckout.reference,
            authorizationUrl: paystackRes.authorizationUrl,
            accessCode: paystackRes.accessCode,
            amount: expectedAmount,
            currency: 'NGN',
            billingInterval,
            planKey: 'standard',
          },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CHECKOUT_INITIALIZATION_FAILED',
            message: err.message || 'Failed to initialize organization checkout.',
          },
        });
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/billing/verify - Server-side Paystack Verification
  fastify.post(
    '/organizations/:organizationId/billing/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Verify Paystack transaction server-side and activate Standard organization',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['reference'],
          properties: {
            reference: { type: 'string' },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const body = request.body as {
        reference: string;
        billingInterval?: 'monthly' | 'annual';
      };

      try {
        // 1. Server-side Paystack verification
        const verifyRes = await paystackService.verifyPayment(body.reference);
        if (verifyRes.status !== 'success') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'PAYMENT_VERIFICATION_FAILED',
              message: `Payment verification failed with status: ${verifyRes.status}`,
            },
          });
        }

        const paidAmountNaira = (verifyRes.amountInKobo || 750000) / 100;
        const billingInterval = body.billingInterval || (paidAmountNaira >= 50000 ? 'annual' : 'monthly');

        // 2. Activate organization subscription
        const activation = await dataService.confirmPaymentAndActivateOrg({
          organizationId,
          paymentReference: body.reference,
          provider: 'paystack',
          amount: paidAmountNaira,
          billingInterval,
          userId: request.user.id,
        });

        return reply.send({
          success: true,
          data: {
            status: 'active',
            planKey: 'standard',
            organizationId,
            reference: body.reference,
            amount: paidAmountNaira,
            billingInterval,
          },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PAYMENT_VERIFICATION_FAILED',
            message: err.message || 'Payment verification failed.',
          },
        });
      }
    }
  );

  // GET /api/v1/organizations/:organizationId/billing/consistency - Consistency Checker
  fastify.get(
    '/organizations/:organizationId/billing/consistency',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Check organization billing and entitlement consistency',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      try {
        const consistency = await dataService.checkOrganizationBillingConsistency(organizationId);
        return reply.send({
          success: true,
          data: consistency,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check billing consistency.',
          },
        });
      }
    }
  );

  // POST /billing/upgrade
  fastify.post(
    '/billing/upgrade',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Upgrade organization subscription plan',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['planKey'],
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
            planKey: { type: 'string', enum: ['standard', 'premium'] },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
            paymentMethod: { type: 'string', enum: ['paystack', 'bank_transfer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { planKey, billingInterval, organizationId, workspaceId } = request.body as {
        planKey: string;
        billingInterval?: string;
        organizationId?: string;
        workspaceId?: string;
      };

      try {
        const periodDays = billingInterval === 'annual' ? 365 : 30;
        const currentPeriodEnd = Date.now() + periodDays * 86_400_000;
        let targetOrgId = organizationId;
        if (!targetOrgId && workspaceId) {
          targetOrgId = workspaceId;
        }
        if (!targetOrgId) {
          const memberships = await dataService.getUserMemberships(request.user.id);
          targetOrgId = memberships?.[0]?.membership?.organizationId || memberships?.[0]?.organization?.id;
        }

        let updated: any;
        if (targetOrgId) {
          try {
            updated = await dataService.updateOrganizationSubscription(
              targetOrgId,
              planKey,
              'active',
              currentPeriodEnd,
              undefined,
              false
            );
          } catch {
            updated = await dataService.updateWorkspaceSubscription(
              targetOrgId,
              planKey,
              'active',
              currentPeriodEnd,
              false
            );
          }
        }

        return reply.send({
          success: true,
          message: `Plan upgraded to ${planKey}.`,
          data: { subscription: updated },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Upgrade failed.',
          },
        });
      }
    }
  );



  // GET /billing/invoices
  fastify.get(
    '/billing/invoices',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get organization invoice history',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = (request.query as any) || {};
        let targetOrgId = query.organizationId || query.workspaceId;
        if (!targetOrgId) {
          const memberships = await dataService.getUserMemberships(request.user.id);
          targetOrgId = memberships?.[0]?.membership?.organizationId || memberships?.[0]?.organization?.id;
        }

        let payments: any[] = [];
        if (targetOrgId) {
          payments = await dataService.getOrganizationPayments(targetOrgId);
        }

        const invoices = (payments || []).map((p: any, idx: number) => ({
          id: p._id || p.id || `inv_${idx}`,
          invoiceNumber: `INV-${new Date(p.createdAt || Date.now()).getFullYear()}-${String(idx + 1).padStart(3, '0')}`,
          amount: p.amount,
          currency: p.currency || 'NGN',
          status: p.status || 'paid',
          paidAt: p.createdAt,
          dueDate: p.createdAt,
          items: [
            {
              description: `Subscription Payment (${p.provider || 'Gateway'})`,
              quantity: 1,
              unitPrice: p.amount,
              total: p.amount,
            },
          ],
        }));

        return reply.send({
          success: true,
          data: { invoices },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch invoices.',
          },
        });
      }
    }
  );





  // GET /billing/workspaces/:workspaceId/trial & GET /workspaces/:workspaceId/trial
  const getWorkspaceTrialHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const trial = await dataService.getWorkspaceTrial(workspaceId);
      if (!trial) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TRIAL_NOT_FOUND',
            message: 'Trial details not found for workspace.',
          },
        });
      }
      return reply.send({
        success: true,
        data: trial,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch trial details.',
        },
      });
    }
  };

  fastify.get('/billing/workspaces/:workspaceId/trial', { preHandler: [fastify.authenticate] }, getWorkspaceTrialHandler);

  // POST /billing/workspaces/:workspaceId/trial/reconcile
  const reconcileTrialHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const result = await dataService.reconcileWorkspaceTrial(workspaceId, request.user?.id);
      return reply.send({
        success: true,
        message: 'Trial state reconciled successfully.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to reconcile trial.',
        },
      });
    }
  };

  fastify.post('/billing/workspaces/:workspaceId/trial/reconcile', { preHandler: [fastify.authenticate] }, reconcileTrialHandler);

  // GET /entitlements/can-activate-app
  fastify.get(
    '/entitlements/can-activate-app',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Entitlements'],
        summary: 'Check if workspace can activate another application',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.query as {
        workspaceId: string;
        productKey?: string;
      };

      try {
        const check = await entitlementService.checkAppActivationEntitlement(workspaceId, productKey);
        return reply.send({
          success: true,
          data: check,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check app entitlement.',
          },
        });
      }
    }
  );

  // GET /entitlements/can-create-branch
  fastify.get(
    '/entitlements/can-create-branch',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Entitlements'],
        summary: 'Check if workspace/app can create another branch',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.query as {
        workspaceId: string;
        productKey?: string;
      };

      try {
        const check = await entitlementService.checkBranchCreationEntitlement(
          workspaceId,
          request.user.id,
          productKey
        );
        return reply.send({
          success: true,
          data: check,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check branch entitlement.',
          },
        });
      }
    }
  );

  // GET /entitlements/can-invite-member
  fastify.get(
    '/entitlements/can-invite-member',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Entitlements'],
        summary: 'Check if workspace can invite another member',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.query as {
        workspaceId: string;
      };

      try {
        const check = await entitlementService.checkMemberInvitationEntitlement(
          workspaceId,
          request.user.id
        );
        return reply.send({
          success: true,
          data: check,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check member invitation entitlement.',
          },
        });
      }
    }
  );

  // GET /usage
  fastify.get(
    '/usage',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Entitlements'],
        summary: 'Get aggregated user resource usage vs limits',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const usage = await entitlementService.getUserUsage(request.user.id);
        return reply.send({
          success: true,
          data: usage,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch user usage.',
          },
        });
      }
    }
  );

  // POST /api/v1/billing/submit-bank-transfer
  fastify.post(
    '/billing/submit-bank-transfer',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Submit manual bank transfer payment proof for review',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['planKey', 'amount', 'senderName'],
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
            planKey: { type: 'string', enum: ['standard', 'premium'] },
            billingInterval: { type: 'string', enum: ['monthly', 'annual'] },
            amount: { type: 'number' },
            senderName: { type: 'string' },
            reference: { type: 'string' },
            bankName: { type: 'string' },
            proofUrl: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        organizationId?: string;
        workspaceId?: string;
        planKey: string;
        billingInterval?: 'monthly' | 'annual';
        amount: number;
        senderName: string;
        reference?: string;
        bankName?: string;
        proofUrl?: string;
      };

      try {
        const reference = body.reference || `ORV-BT-${Date.now().toString(36).toUpperCase()}`;

        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: 'subscription.bank_transfer_submitted' as any,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            organizationId: body.organizationId,
            planKey: body.planKey,
            billingInterval: body.billingInterval || 'monthly',
            amount: body.amount,
            senderName: body.senderName,
            bankName: body.bankName,
            reference,
            proofUrl: body.proofUrl,
          },
        });

        // Set organization subscription to pending/trialing state
        const periodDays = body.billingInterval === 'annual' ? 365 : 30;
        const currentPeriodEnd = Date.now() + periodDays * 86_400_000;
        let targetOrgId = body.organizationId || body.workspaceId;
        if (!targetOrgId) {
          const memberships = await dataService.getUserMemberships(request.user.id);
          targetOrgId = memberships?.[0]?.membership?.organizationId || memberships?.[0]?.organization?.id;
        }

        if (targetOrgId) {
          try {
            await dataService.updateOrganizationSubscription(
              targetOrgId,
              body.planKey,
              'trialing',
              currentPeriodEnd,
              currentPeriodEnd,
              false
            );
          } catch {
            await dataService.updateWorkspaceSubscription(
              targetOrgId,
              body.planKey,
              'trialing',
              currentPeriodEnd,
              false
            );
          }
        }

        return reply.send({
          success: true,
          message: 'Bank transfer payment proof submitted successfully.',
          data: {
            reference,
            status: 'PENDING_VERIFICATION',
            reviewTimeHours: '1-2 hours',
          },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to submit bank transfer proof.',
          },
        });
      }
    }
  );

  // ─── Organization & Workspace Invoices ──────────────────────────────────────────
  const orgInvoicesHandler = async (request: any, reply: any) => {
    const workspaceId = (request.params as any).workspaceId || (request.params as any).organizationId;
    try {
      const hasPerm = await verifyBillingPermission(request.user, workspaceId);
      if (!hasPerm) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'You do not have permission to view billing documents for this organization.',
          },
        });
      }

      let invoices = await dataService.getInvoicesByOrganization(workspaceId);
      if (!invoices || invoices.length === 0) {
        invoices = await dataService.getInvoicesByWorkspace(workspaceId);
      }

      return reply.send({
        success: true,
        data: invoices || [],
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch invoices.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);
  fastify.get('/workspaces/:workspaceId/billing/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);
  fastify.get('/billing/workspaces/:workspaceId/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);
  fastify.get('/organizations/:organizationId/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);
  fastify.get('/billing/organizations/:organizationId/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);

  // ─── Single Invoice Details ──────────────────────────────────────────────────
  const invoiceDetailHandler = async (request: any, reply: any) => {
    const { invoiceId, workspaceId } = request.params as { invoiceId: string; workspaceId?: string };
    try {
      const invoice: any = await dataService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Invoice not found.',
          },
        });
      }

      const targetWs = invoice.workspaceId || invoice.organizationId || workspaceId;
      if (targetWs) {
        const hasPerm = await verifyBillingPermission(request.user, String(targetWs));
        if (!hasPerm) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You do not have permission to view this invoice.',
            },
          });
        }
      }

      return reply.send({
        success: true,
        data: invoice,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch invoice.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/invoices/:invoiceId', { preHandler: [fastify.authenticate] }, invoiceDetailHandler);
  fastify.get('/workspaces/:workspaceId/billing/invoices/:invoiceId', { preHandler: [fastify.authenticate] }, invoiceDetailHandler);
  fastify.get('/invoices/:invoiceId', { preHandler: [fastify.authenticate] }, invoiceDetailHandler);
  fastify.get('/billing/invoices/:invoiceId', { preHandler: [fastify.authenticate] }, invoiceDetailHandler);

  // ─── Invoice PDF Download ────────────────────────────────────────────────────
  const invoiceDownloadHandler = async (request: any, reply: any) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const query = (request.query as any) || {};

    try {
      // Validate token if provided or session auth
      if (query.token) {
        const tokenRes = verifySignedDownloadToken(query.token);
        if (!tokenRes.valid || tokenRes.payload?.resourceId !== invoiceId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: tokenRes.error || 'Invalid or expired download token.',
            },
          });
        }
      }

      const invoice: any = await dataService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Invoice not found.',
          },
        });
      }

      const targetWs = invoice.workspaceId || invoice.organizationId;
      if (request.user && targetWs) {
        const hasPerm = await verifyBillingPermission(request.user, String(targetWs));
        if (!hasPerm) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You do not have permission to download this invoice.',
            },
          });
        }
      }

      // Audit download request
      await dataService.recordAuditLog({
        organizationId: invoice.organizationId ? String(invoice.organizationId) : undefined,
        workspaceId: invoice.workspaceId ? String(invoice.workspaceId) : undefined,
        actorUserId: request.user?.id || 'anonymous_token',
        action: 'billing.invoice_download_requested',
        resource: `invoice:${invoiceId}`,
        severity: 'info',
        metadata: {
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          userEmail: request.user?.email,
        },
      });

      // If json response requested for signed URL
      if (query.format === 'url') {
        const token = generateSignedDownloadToken({
          resourceId: invoiceId,
          resourceType: 'invoice',
          workspaceId: invoice.workspaceId ? String(invoice.workspaceId) : undefined,
          userId: request.user?.id,
          expiresInSeconds: 3600,
        });
        return reply.send({
          success: true,
          data: {
            downloadUrl: `/billing/invoices/${invoiceId}/download?token=${token}`,
            expiresInSeconds: 3600,
          },
        });
      }

      const pdfBuffer = generateInvoicePdfBuffer({
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate || invoice.issuedAt || invoice.createdAt,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        periodStart: invoice.billingPeriodStart || invoice.periodStart,
        periodEnd: invoice.billingPeriodEnd || invoice.periodEnd,
        status: invoice.status || 'paid',
        amount: invoice.totalAmount || invoice.amount,
        currency: invoice.currency || 'NGN',
        amountSubtotal: invoice.amountSubtotal || invoice.amount,
        discountAmount: invoice.discountAmount || 0,
        taxAmount: invoice.taxAmount || 0,
        paymentReference: invoice.providerReference || invoice.paymentReference,
        paymentMethod: invoice.paymentMethod,
        organizationName: invoice.billingSnapshot?.organizationName || invoice.organization?.name,
        organizationAddress: invoice.billingSnapshot?.organizationAddress || invoice.organization?.address,
        billingEmail: invoice.billingSnapshot?.billingEmail || invoice.organization?.billingEmail,
        lineItems: invoice.lineItems || invoice.items,
      });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
      return reply.send(pdfBuffer);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to generate invoice PDF.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/invoices/:invoiceId/download', { preHandler: [fastify.authenticate] }, invoiceDownloadHandler);
  fastify.get('/workspaces/:workspaceId/billing/invoices/:invoiceId/download', { preHandler: [fastify.authenticate] }, invoiceDownloadHandler);
  fastify.get('/invoices/:invoiceId/download', invoiceDownloadHandler);
  fastify.get('/billing/invoices/:invoiceId/download', invoiceDownloadHandler);

  // ─── Payment Receipt by Invoice ──────────────────────────────────────────────
  const invoiceReceiptHandler = async (request: any, reply: any) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const query = (request.query as any) || {};

    try {
      const invoice: any = await dataService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Invoice not found.',
          },
        });
      }

      const receipt: any = await dataService.getReceiptByInvoiceId(invoiceId);
      if (!receipt) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Payment receipt not found for this invoice.',
          },
        });
      }

      const targetWs = invoice.workspaceId || invoice.organizationId;
      if (request.user && targetWs) {
        const hasPerm = await verifyBillingPermission(request.user, String(targetWs));
        if (!hasPerm) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You do not have permission to view this receipt.',
            },
          });
        }
      }

      await dataService.recordAuditLog({
        organizationId: receipt.organizationId ? String(receipt.organizationId) : undefined,
        workspaceId: receipt.workspaceId ? String(receipt.workspaceId) : undefined,
        actorUserId: request.user?.id || 'user',
        action: 'billing.receipt_download_requested',
        resource: `receipt:${receipt._id}`,
        severity: 'info',
        metadata: {
          receiptId: receipt._id,
          receiptNumber: receipt.receiptNumber,
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      if (query.format === 'pdf') {
        const pdfBuffer = generateReceiptPdfBuffer({
          receiptNumber: receipt.receiptNumber,
          invoiceNumber: invoice.invoiceNumber,
          paidAt: receipt.paidAt,
          amount: receipt.amount,
          currency: receipt.currency || 'NGN',
          paymentReference: receipt.providerReference,
          paymentMethod: receipt.paymentMethod,
          planKey: receipt.planKey,
          billingInterval: receipt.billingInterval,
          organizationName: receipt.billingSnapshot?.organizationName || invoice.billingSnapshot?.organizationName,
          organizationAddress: receipt.billingSnapshot?.organizationAddress || invoice.billingSnapshot?.organizationAddress,
          billingEmail: receipt.billingSnapshot?.billingEmail || invoice.billingSnapshot?.billingEmail,
        });

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="Receipt-${receipt.receiptNumber}.pdf"`);
        return reply.send(pdfBuffer);
      }

      return reply.send({
        success: true,
        data: receipt,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch payment receipt.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/invoices/:invoiceId/receipt', { preHandler: [fastify.authenticate] }, invoiceReceiptHandler);
  fastify.get('/workspaces/:workspaceId/billing/invoices/:invoiceId/receipt', { preHandler: [fastify.authenticate] }, invoiceReceiptHandler);
  fastify.get('/billing/invoices/:invoiceId/receipt', { preHandler: [fastify.authenticate] }, invoiceReceiptHandler);

  // ─── Workspace Payments ──────────────────────────────────────────────────────
  const workspacePaymentsHandler = async (request: any, reply: any) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const hasPerm = await verifyBillingPermission(request.user, workspaceId);
      if (!hasPerm) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'You do not have permission to view billing payments.',
          },
        });
      }

      const payments = await dataService.getPaymentsByWorkspace(workspaceId);
      return reply.send({
        success: true,
        data: payments || [],
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch payments.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/payments', { preHandler: [fastify.authenticate] }, workspacePaymentsHandler);
  fastify.get('/workspaces/:workspaceId/billing/payments', { preHandler: [fastify.authenticate] }, workspacePaymentsHandler);

  // ─── Single Payment Details ──────────────────────────────────────────────────
  const paymentDetailHandler = async (request: any, reply: any) => {
    const { paymentId, workspaceId } = request.params as { paymentId: string; workspaceId?: string };
    try {
      const payment: any = await dataService.query('payments:getByReference', { reference: paymentId });
      if (!payment) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Payment record not found.',
          },
        });
      }

      const targetWs = payment.workspaceId || payment.organizationId || workspaceId;
      if (targetWs) {
        const hasPerm = await verifyBillingPermission(request.user, String(targetWs));
        if (!hasPerm) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You do not have permission to view this payment.',
            },
          });
        }
      }

      return reply.send({
        success: true,
        data: payment,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch payment details.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/payments/:paymentId', { preHandler: [fastify.authenticate] }, paymentDetailHandler);
  fastify.get('/workspaces/:workspaceId/billing/payments/:paymentId', { preHandler: [fastify.authenticate] }, paymentDetailHandler);

  // ─── Single Receipt Details ──────────────────────────────────────────────────
  const receiptDetailHandler = async (request: any, reply: any) => {
    const { receiptId, workspaceId } = request.params as { receiptId: string; workspaceId?: string };
    try {
      const receipt: any = await dataService.getReceiptById(receiptId);
      if (!receipt) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Receipt not found.',
          },
        });
      }

      const targetWs = receipt.workspaceId || receipt.organizationId || workspaceId;
      if (targetWs) {
        const hasPerm = await verifyBillingPermission(request.user, String(targetWs));
        if (!hasPerm) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You do not have permission to view this receipt.',
            },
          });
        }
      }

      return reply.send({
        success: true,
        data: receipt,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to fetch receipt.',
        },
      });
    }
  };

  fastify.get('/v1/workspaces/:workspaceId/billing/receipts/:receiptId', { preHandler: [fastify.authenticate] }, receiptDetailHandler);
  fastify.get('/workspaces/:workspaceId/billing/receipts/:receiptId', { preHandler: [fastify.authenticate] }, receiptDetailHandler);
  fastify.get('/billing/receipts/:receiptId', { preHandler: [fastify.authenticate] }, receiptDetailHandler);

  // ─── Retry PDF Generation ────────────────────────────────────────────────────
  const retryPdfHandler = async (request: any, reply: any) => {
    const { invoiceId, workspaceId } = request.params as { invoiceId: string; workspaceId?: string };
    try {
      const invoice: any = await dataService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Invoice not found.',
          },
        });
      }

      const targetWs = invoice.workspaceId || invoice.organizationId || workspaceId;
      if (targetWs) {
        const hasPerm = await verifyBillingPermission(request.user, String(targetWs));
        if (!hasPerm) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You do not have permission to modify this invoice.',
            },
          });
        }
      }

      const updated = await dataService.retryPdfGeneration({
        invoiceId,
        status: 'completed',
        pdfUrl: `/billing/invoices/${invoiceId}/download`,
      });

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to retry PDF generation.',
        },
      });
    }
  };

  fastify.post('/v1/workspaces/:workspaceId/billing/invoices/:invoiceId/retry-pdf', { preHandler: [fastify.authenticate] }, retryPdfHandler);
  fastify.post('/workspaces/:workspaceId/billing/invoices/:invoiceId/retry-pdf', { preHandler: [fastify.authenticate] }, retryPdfHandler);
  fastify.post('/billing/invoices/:invoiceId/retry-pdf', { preHandler: [fastify.authenticate] }, retryPdfHandler);
};

