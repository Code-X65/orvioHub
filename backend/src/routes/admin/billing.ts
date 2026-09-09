import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { env } from '../../config/env.js';

export const adminBillingRoutes: FastifyPluginAsync = async (fastify) => {
  const requireSingleAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    if (env.ADMIN_USER_ID && request.user?.id !== env.ADMIN_USER_ID) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Access forbidden. Platform administrator privileges required.',
        },
      });
    }
  };

  // GET /api/v1/admin/plans - List all plans
  fastify.get(
    '/plans',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'List all subscription plans and pricing',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const plans = await dataService.listPlans();
        return reply.send({
          success: true,
          data: { plans: plans || [] },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list plans.',
          },
        });
      }
    }
  );

  // PATCH /api/v1/admin/plans/:planKey - Update plan price or active status
  fastify.patch(
    '/plans/:planKey',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Update subscription plan prices and status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['planKey'],
          properties: {
            planKey: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'object' },
            monthlyPrice: { type: 'number' },
            annualPrice: { type: 'number' },
            limits: { type: 'object' },
            allowedApps: { type: 'array', items: { type: 'string' } },
            allowedAppKeys: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { planKey } = request.params as { planKey: string };
      const body = request.body as any;

      try {
        const updated = await dataService.updatePlan(planKey, body);
        return reply.send({
          success: true,
          message: 'Plan updated successfully.',
          data: { plan: updated },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to update plan.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/users/:userId/usage - View user usage against plan limits
  fastify.get(
    '/users/:userId/usage',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Get user resource usage and entitlements against plan limits',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      try {
        const usage = await dataService.getUserUsage(userId);
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

  // GET /api/v1/admin/organizations/:id/subscription (supports orgId or workspaceId)
  fastify.get(
    '/organizations/:id/subscription',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Get organization subscription details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        let subscription: any = await dataService.getOrganizationSubscription(id);
        if (!subscription || !subscription.organizationId) {
          const wsSub = await dataService.getWorkspaceSubscription(id);
          if (wsSub) subscription = wsSub;
        }

        return reply.send({
          success: true,
          data: { subscription },
        });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: err.message || 'Subscription not found.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/organizations/:id/subscription/change
  fastify.post(
    '/organizations/:id/subscription/change',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Manually change an organization plan tier or status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['planKey'],
          properties: {
            planKey: { type: 'string', enum: ['free', 'free_trial', 'standard', 'premium'] },
            status: { type: 'string', enum: ['active', 'trialing', 'cancelled', 'canceled', 'past_due', 'expired'] },
            currentPeriodEnd: { type: 'number' },
            trialEndsAt: { type: 'number' },
            cancelAtPeriodEnd: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        planKey: string;
        status?: 'active' | 'trialing' | 'cancelled' | 'canceled' | 'past_due' | 'expired';
        currentPeriodEnd?: number;
        trialEndsAt?: number;
        cancelAtPeriodEnd?: boolean;
      };

      try {
        const normalizedStatus = body.status === 'cancelled' ? 'canceled' : body.status;
        const normalizedPlanKey = body.planKey === 'free' ? 'free_trial' : body.planKey;

        // Try updating organization subscription first
        let updated: any;
        try {
          updated = await dataService.updateOrganizationSubscription(
            id,
            normalizedPlanKey,
            normalizedStatus as any,
            body.currentPeriodEnd,
            body.trialEndsAt,
            body.cancelAtPeriodEnd
          );
        } catch {
          // Fallback to workspace subscription
          updated = await dataService.updateWorkspaceSubscription(
            id,
            normalizedPlanKey,
            normalizedStatus as any,
            body.currentPeriodEnd,
            body.cancelAtPeriodEnd
          );
        }

        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: 'billing.plan_updated',
          metadata: {
            targetId: id,
            newPlan: normalizedPlanKey,
            status: normalizedStatus,
            adminEmail: request.user.email,
          },
        });

        return reply.send({
          success: true,
          message: `Subscription updated to ${normalizedPlanKey.toUpperCase()} plan.`,
          data: { subscription: updated },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to update subscription.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/organizations/:id/subscription/extend-trial
  fastify.post(
    '/organizations/:id/subscription/extend-trial',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Extend organization trial period',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            extensionDays: { type: 'number', minimum: 1 },
            trialEndsAt: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        extensionDays?: number;
        trialEndsAt?: number;
      };

      try {
        const updated = await dataService.extendOrganizationTrial(
          id,
          body.extensionDays || 14,
          body.trialEndsAt
        );

        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: 'billing.trial_extended' as any,
          metadata: {
            organizationId: id,
            extensionDays: body.extensionDays,
            adminEmail: request.user.email,
          },
        });

        return reply.send({
          success: true,
          message: 'Trial period extended successfully.',
          data: { subscription: updated },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to extend trial.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/organizations/:workspaceId/usage
  fastify.get(
    '/organizations/:workspaceId/usage',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Get organization resource usage counters',
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
        return reply.send({
          success: true,
          data: usage,
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

  // GET /api/v1/admin/subscriptions - List all subscriptions
  fastify.get(
    '/subscriptions',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'List all workspace subscriptions across the platform',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            planKey: { type: 'string' },
            status: { type: 'string' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = (request.query as any) || {};
      try {
        const subscriptions = await dataService.listAllSubscriptions({
          planKey: query.planKey,
          status: query.status,
          search: query.search,
        });

        return reply.send({
          success: true,
          data: { subscriptions },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list subscriptions.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/subscriptions/stats - Overview stats & MRR
  fastify.get(
    '/subscriptions/stats',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Get platform revenue & subscription metrics overview',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const stats = await dataService.getSubscriptionOverviewStats();
        return reply.send({
          success: true,
          data: stats,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to retrieve stats.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/organizations/:id/payments/manual - Record offline payment
  fastify.post(
    '/organizations/:id/payments/manual',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Record manual offline payment and extend subscription',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['planKey', 'amount', 'billingCycle', 'paymentReference', 'paymentMethod'],
          properties: {
            planKey: { type: 'string', enum: ['free_trial', 'standard', 'premium'] },
            amount: { type: 'number' },
            currency: { type: 'string', default: 'NGN' },
            billingCycle: { type: 'string', enum: ['monthly', 'annual'] },
            paymentReference: { type: 'string' },
            paymentMethod: { type: 'string', enum: ['bank_transfer', 'cash', 'pos', 'cheque', 'manual', 'other'] },
            paidAt: { type: 'number' },
            notes: { type: 'string' },
            extensionDays: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      try {
        const result = await dataService.recordOrganizationManualPayment({
          organizationId: id,
          planKey: body.planKey,
          amount: body.amount,
          currency: body.currency || 'NGN',
          billingCycle: body.billingCycle,
          paymentReference: body.paymentReference,
          paymentMethod: body.paymentMethod,
          paidAt: body.paidAt,
          recordedBy: request.user.id,
          notes: body.notes,
          extensionDays: body.extensionDays,
        });

        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: 'billing.payment_received',
          metadata: {
            organizationId: id,
            amount: body.amount,
            planKey: body.planKey,
            reference: body.paymentReference,
            adminEmail: request.user.email,
          },
        });

        return reply.status(201).send({
          success: true,
          message: 'Payment recorded and organization subscription updated successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to record manual payment.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/organizations/:id/payments - List all payments for organization
  fastify.get(
    '/organizations/:id/payments',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'List all payment records for an organization (manual and gateway)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const payments = await dataService.getOrganizationPayments(id);
        const manualPayments = await dataService.listManualPayments(id);
        return reply.send({
          success: true,
          data: {
            payments: payments || [],
            manualPayments: manualPayments || [],
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list payments.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/organizations/:workspaceId/payments/manual - Backwards compatibility
  fastify.get(
    '/organizations/:workspaceId/payments/manual',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'List manual payment records for an organization (compat)',
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
        const payments = await dataService.listManualPayments(workspaceId);
        return reply.send({
          success: true,
          data: { payments },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list manual payments.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/revenue/overview
  fastify.get(
    '/revenue/overview',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Billing'],
        summary: 'Get revenue overview & plan distribution statistics',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const stats: any = await dataService.getSubscriptionOverviewStats();
        return reply.send({
          success: true,
          data: {
            totalOrganizations: stats.totalSubscriptions || 0,
            planDistribution: stats.countsByPlan || { free: 0, standard: 0, premium: 0 },
            monthlyRecurringRevenueKobo: stats.totalMRRKobo || 0,
            monthlyRecurringRevenueNaira: stats.totalMRRNaira || 0,
            currency: 'NGN',
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to calculate revenue stats.',
          },
        });
      }
    }
  );
};
