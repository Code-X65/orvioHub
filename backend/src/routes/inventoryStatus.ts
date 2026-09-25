import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';

const inventoryStatusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/organizations/:organizationId/applications/inventory/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Organizations', 'Applications'],
      summary: 'Get consolidated inventory application status, onboarding, and access permissions',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
        },
        required: ['organizationId'],
      },
    },
    handler: async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };

      const [activeRes, onboardRes, accessRes] = await Promise.all([
        dataService.isApplicationActiveForOrg(organizationId, 'inventory').catch(() => null),
        dataService.getInventoryOnboardingStatus(organizationId).catch(() => null),
        dataService.checkUserAppAccess(organizationId, request.user.id, 'inventory').catch(() => null),
      ]);

      return reply.send({
        success: true,
        data: {
          active: activeRes?.active ?? false,
          status: activeRes?.status || (activeRes?.active ? 'active' : 'inactive'),
          onboardingCompleted: onboardRes?.completed ?? false,
          access: {
            allowed: accessRes?.allowed ?? true,
            reason: accessRes?.reason,
          },
        },
      });
    },
  });
};

export default fp(inventoryStatusRoute, { name: 'inventory-status-route' });
export { inventoryStatusRoute };
