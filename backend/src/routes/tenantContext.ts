import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

const tenantContextRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/workspaces/:workspaceId/context', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Workspaces'],
      summary: 'Get workspace tenant context (batched)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
        },
        required: ['workspaceId'],
      },
    },
    handler: async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const context = await dataService.getTenantContext(
        workspaceId,
        request.user.id
      );

      if (!context) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.WORKSPACE_NOT_FOUND,
            message: 'Workspace not found or access denied.',
          },
        });
      }

      return reply.send({ success: true, data: context });
    },
  });
};

export default fp(tenantContextRoute, { name: 'tenant-context-route' });
export { tenantContextRoute };
