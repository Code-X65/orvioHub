import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { paystackService } from '../services/paystackService.js';
import { flutterwaveService } from '../services/flutterwaveService.js';
import { ERROR_CODES } from '../config/constants.js';

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
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

  // GET /api/v1/plans (Public Pricing for User Frontend)
  fastify.get(
    '/plans',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Get all active subscription plans and pricing for the frontend',
      },
    },
    async (_request, reply) => {
      try {
        const plans = await dataService.listPlans();
        return reply.send({
          success: true,
          data: plans,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch subscription plans.',
          },
        });
      }
    }
  );

  // GET /billing/plans (Master checklist alias)
  fastify.get(
    '/billing/plans',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Get all active subscription plans and pricing (checklist alias)',
      },
    },
    async (_request, reply) => {
      try {
        const plans = await dataService.listPlans();
        return reply.send({
          success: true,
          data: {
            plans,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch subscription plans.',
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



  // POST /billing/cancel - Cancel subscription at period end
  fastify.post(
    '/billing/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Cancel subscription at period end',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as any;
      const targetWorkspaceId = body.workspaceId || body.organizationId;
      const now = Date.now();
      const currentPeriodEnd = now + 30 * 86_400_000;

      if (targetWorkspaceId) {
        try {
          await dataService.updateOrganizationSubscription(
            targetWorkspaceId,
            'standard',
            'active',
            currentPeriodEnd,
            undefined,
            true
          );
        } catch {
          await dataService.updateWorkspaceSubscription(
            targetWorkspaceId,
            'standard',
            'active',
            currentPeriodEnd,
            true
          );
        }
      }

      return reply.send({
        success: true,
        message: 'Subscription scheduled for cancellation at the end of the current period.',
        data: {
          subscription: {
            status: 'active',
            cancelAtPeriodEnd: true,
            currentPeriodEnd,
          },
        },
      });
    }
  );

  // POST /billing/downgrade - Schedule downgrade to Free
  fastify.post(
    '/billing/downgrade',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Schedule downgrade to Free plan at period end',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            organizationId: { type: 'string' },
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as any;
      const targetWorkspaceId = body.workspaceId || body.organizationId;
      const now = Date.now();
      const currentPeriodEnd = now + 30 * 86_400_000;

      if (targetWorkspaceId) {
        await dataService.updateWorkspaceSubscription(
          targetWorkspaceId,
          'free',
          'active',
          currentPeriodEnd,
          true
        );
      }

      return reply.send({
        success: true,
        message: 'Subscription scheduled to downgrade to Free plan at period end.',
        data: {
          planKey: 'free',
          cancelAtPeriodEnd: true,
        },
      });
    }
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

  // GET /entitlements/user
  fastify.get(
    '/entitlements/user',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Entitlements'],
        summary: 'Get user plan entitlements and quotas',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const entitlements = await entitlementService.getUserEntitlements(request.user.id);
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

  // GET /entitlements/can-create-workspace
  fastify.get(
    '/entitlements/can-create-workspace',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Entitlements'],
        summary: 'Check if user can create another workspace',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const check = await entitlementService.checkWorkspaceCreationEntitlement(request.user.id);
        return reply.send({
          success: true,
          data: check,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check workspace entitlement.',
          },
        });
      }
    }
  );

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

  const orgInvoicesHandler = async (request: any, reply: any) => {
    const { organizationId } = request.params as { organizationId: string };
    try {
      const invoices = await dataService.getInvoicesByOrganization(organizationId);
      return reply.send({
        success: true,
        data: invoices,
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

  fastify.get('/organizations/:organizationId/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);
  fastify.get('/billing/organizations/:organizationId/invoices', { preHandler: [fastify.authenticate] }, orgInvoicesHandler);

  const invoiceDetailHandler = async (request: any, reply: any) => {
    const { invoiceId } = request.params as { invoiceId: string };
    try {
      const invoice = await dataService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Invoice not found.',
          },
        });
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

  fastify.get('/invoices/:invoiceId', { preHandler: [fastify.authenticate] }, invoiceDetailHandler);
  fastify.get('/billing/invoices/:invoiceId', { preHandler: [fastify.authenticate] }, invoiceDetailHandler);
};
