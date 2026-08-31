import type { FastifyPluginAsync } from 'fastify';
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

  // POST /api/v1/billing/initialize
  fastify.post(
    '/billing/initialize',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Initialize Paystack or Flutterwave payment checkout for workspace plan upgrade',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['workspaceId', 'planKey', 'gateway'],
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
        workspaceId: string;
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
          workspaceId,
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
};
