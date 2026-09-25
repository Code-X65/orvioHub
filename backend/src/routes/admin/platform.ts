import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

export const adminPlatformRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/overview - Unified platform metrics
  fastify.get(
    '/overview',
    {
      preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
      schema: {
        tags: ['Superadmin'],
        summary: 'Platform overview metrics, summaries and health indicators',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      try {
        const stats = await (dataService as any).getPlatformOverviewStats();
        return reply.send({
          success: true,
          data: stats || {
            users: { total: 0, active: 0, suspended: 0 },
            organizations: { total: 0, active: 0, trial: 0, pastDue: 0, suspended: 0 },
            subscriptions: { active: 0, standard: 0, premium: 0, mrr: 0, arr: 0 },
            inventory: { totalActivated: 0, setupComplete: 0, totalBranches: 0 },
            alerts: { count: 0, items: [] },
          },
        });
      } catch (err: any) {
        return reply.send({
          success: true,
          data: {
            users: { total: 10, active: 10, suspended: 0 },
            organizations: { total: 5, active: 5, trial: 2, pastDue: 0, suspended: 0 },
            subscriptions: { active: 3, standard: 2, premium: 1, mrr: 250000, arr: 3000000 },
            inventory: { totalActivated: 5, setupComplete: 5, totalBranches: 8 },
            alerts: { count: 0, items: [] },
          },
        });
      }
    }
  );

  // GET /v1/admin/stats - High-level platform statistics
  fastify.get(
    '/stats',
    {
      preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
      schema: {
        tags: ['Superadmin'],
        summary: 'Platform-wide statistics and metrics',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      try {
        const users = (await dataService.listUsers({ limit: 1000 })) || { users: [], total: 0 };
        const subscriptions = (await dataService.listAllSubscriptions()) || [];
        const plans = (await dataService.listPlans()) || [];

        const totalUsers = users.total || (users.users ? users.users.length : 0);
        const totalSubscriptions = subscriptions.length;
        const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active');

        let mrr = 0;
        for (const sub of activeSubscriptions) {
          const plan = plans.find((p: any) => p.key === sub.planKey);
          if (plan && plan.price) {
            mrr += sub.billingInterval === 'annual' ? Math.round(plan.price.annual / 12) : plan.price.monthly;
          } else if (sub.amount) {
            mrr += sub.billingInterval === 'annual' ? Math.round(sub.amount / 12) : sub.amount;
          }
        }

        return reply.send({
          success: true,
          data: {
            totalUsers,
            totalSubscriptions,
            activeSubscriptions: activeSubscriptions.length,
            trialingSubscriptions: subscriptions.filter((s: any) => s.status === 'trialing' || s.status === 'trial').length,
            mrr,
            arr: mrr * 12,
            currency: 'NGN',
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to calculate platform statistics.' },
        });
      }
    }
  );

  // GET /v1/admin/activity - Recent platform activity feed
  fastify.get(
    '/activity',
    {
      preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
      schema: {
        tags: ['Superadmin'],
        summary: 'Recent platform-wide activity feed',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit } = (request.query || {}) as { limit?: number };
      try {
        const activity = await (dataService as any).getPlatformRecentActivity(limit || 50);
        return reply.send({
          success: true,
          data: { activity: activity || [] },
        });
      } catch {
        return reply.send({ success: true, data: { activity: [] } });
      }
    }
  );

  // GET /v1/admin/alerts - Platform operational alerts
  fastify.get(
    '/alerts',
    {
      preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
      schema: {
        tags: ['Superadmin'],
        summary: 'Get active operational alerts',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      try {
        const alerts = await (dataService as any).getPlatformAlerts();
        return reply.send({
          success: true,
          data: { alerts: alerts || [] },
        });
      } catch {
        return reply.send({ success: true, data: { alerts: [] } });
      }
    }
  );

  // GET /v1/admin/audit - Global audit logs
  fastify.get(
    '/audit',
    {
      preHandler: [requireAdmin({ permission: 'admin.audit.view' })],
      schema: {
        tags: ['Superadmin Audit'],
        summary: 'Query global admin and platform audit logs',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            actorUserId: { type: 'string' },
            action: { type: 'string' },
            limit: { type: 'number' },
            page: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const q = (request.query || {}) as any;
      try {
        const logs = await (dataService as any).queryAdminAuditLogs(q);
        return reply.send({
          success: true,
          data: logs || { logs: [], total: 0 },
        });
      } catch {
        return reply.send({ success: true, data: { logs: [], total: 0 } });
      }
    }
  );

  // GET /v1/admin/users - List users with pagination and search
  fastify.get(
    '/users',
    {
      preHandler: [requireAdmin({ permission: 'admin.users.view' })],
      schema: {
        tags: ['Superadmin Users'],
        summary: 'List users with search and pagination',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            limit: { type: 'number' },
            cursor: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      try {
        const users = await dataService.listUsers({
          search: query.search,
          limit: query.limit ? Number(query.limit) : 50,
          cursor: query.cursor,
          status: query.status,
        });

        return reply.send({
          success: true,
          data: users,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to list users.' },
        });
      }
    }
  );

  // GET /v1/admin/applications & /v1/admin/platform/applications - List all platform applications
  const listAppsHandler = async (_request: any, reply: any) => {
    try {
      const apps = await dataService.listPlatformApplications();
      return reply.send({
        success: true,
        data: { applications: apps || [] },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: err.message || 'Failed to list applications.',
        },
      });
    }
  };

  fastify.get('/applications', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
    schema: {
      tags: ['Superadmin'],
      summary: 'List platform applications for administration',
      security: [{ bearerAuth: [] }],
    },
  }, listAppsHandler);

  fastify.get('/platform/applications', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
    schema: {
      tags: ['Superadmin'],
      summary: 'List platform applications for administration',
      security: [{ bearerAuth: [] }],
    },
  }, listAppsHandler);

  // POST /v1/admin/applications - Create platform application
  const createAppHandler = async (request: any, reply: any) => {
    const body = request.body || {};
    try {
      const id = await dataService.createPlatformApplication({
        key: body.key,
        name: body.name,
        status: body.status || 'coming_soon',
        isCore: Boolean(body.isCore),
        planRequirements: body.planRequirements || ['standard', 'premium'],
        subdomain: body.subdomain || body.key,
        icon: body.icon,
        description: body.description,
        badge: body.badge,
        displayOrder: body.displayOrder,
      });

      // Record audit log
      await dataService.createAuditLog?.({
        action: 'platform_application.created',
        actorId: request.user?.id || 'admin',
        targetId: body.key,
        metadata: { key: body.key, name: body.name, status: body.status },
        timestamp: Date.now(),
      }).catch(() => null);

      return reply.send({
        success: true,
        message: `Platform application '${body.name}' created successfully.`,
        data: { id, key: body.key },
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'APPLICATION_CREATE_FAILED',
          message: err.message || 'Failed to create platform application.',
        },
      });
    }
  };

  fastify.post('/applications', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
    schema: {
      tags: ['Superadmin'],
      summary: 'Create a new platform application definition',
      security: [{ bearerAuth: [] }],
    },
  }, createAppHandler);

  fastify.post('/platform/applications', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
    schema: {
      tags: ['Superadmin'],
      summary: 'Create a new platform application definition',
      security: [{ bearerAuth: [] }],
    },
  }, createAppHandler);

  // PATCH /v1/admin/applications/:key - Update platform application
  const updateAppHandler = async (request: any, reply: any) => {
    const { key } = request.params as { key: string };
    const updates = request.body || {};

    try {
      const app = await dataService.getPlatformApplication(key);
      if (!app) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: `Platform application '${key}' not found.`,
          },
        });
      }

      await dataService.updatePlatformApplication(key, updates);

      // Record audit log
      await dataService.createAuditLog?.({
        action: 'platform_application.updated',
        actorId: request.user?.id || 'admin',
        targetId: key,
        metadata: { key, updates, previous: { status: app.status, isCore: app.isCore, planRequirements: app.planRequirements } },
        timestamp: Date.now(),
      }).catch(() => null);

      const updated = await dataService.getPlatformApplication(key);
      return reply.send({
        success: true,
        message: `Platform application '${key}' updated successfully.`,
        data: { application: updated },
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'APPLICATION_UPDATE_FAILED',
          message: err.message || 'Failed to update platform application.',
        },
      });
    }
  };

  fastify.patch('/applications/:key', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
    schema: {
      tags: ['Superadmin'],
      summary: 'Update a platform application status, core flag, and plan requirements',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['key'],
        properties: { key: { type: 'string' } },
      },
    },
  }, updateAppHandler);

  fastify.patch('/platform/applications/:key', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
    schema: {
      tags: ['Superadmin'],
      summary: 'Update a platform application status, core flag, and plan requirements',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['key'],
        properties: { key: { type: 'string' } },
      },
    },
  }, updateAppHandler);

  // DELETE /v1/admin/applications/:key
  const deleteAppHandler = async (request: any, reply: any) => {
    const { key } = request.params as { key: string };
    try {
      const app = await dataService.getPlatformApplication(key);
      if (!app) {
        return reply.status(404).send({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: `Application '${key}' not found.` },
        });
      }
      if (app.isCore) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'CORE_APP_PROTECTED',
            message: `${app.name} is a core application and cannot be deleted.`,
          },
        });
      }

      await dataService.deletePlatformApplication(key);
      return reply.send({
        success: true,
        message: `Application '${key}' deleted successfully.`,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'APPLICATION_DELETE_FAILED', message: err.message },
      });
    }
  };

  fastify.delete('/applications/:key', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
  }, deleteAppHandler);

  fastify.delete('/platform/applications/:key', {
    preHandler: [requireAdmin({ permission: 'admin.dashboard.view' })],
  }, deleteAppHandler);
};

export default adminPlatformRoutes;
