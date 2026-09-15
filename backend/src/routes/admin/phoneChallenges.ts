import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';

export const adminPhoneChallengeRoutes: FastifyPluginAsync = async (fastify) => {
  const getAdminToken = (request: FastifyRequest) => {
    return (
      (request.headers['x-admin-session'] as string) ||
      (request.headers['x-admin-token'] as string) ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      ''
    );
  };

  // GET /api/v1/admin/phone-challenges
  fastify.get(
    '/phone-challenges',
    {
      schema: {
        tags: ['Superadmin Phone Challenges'],
        summary: 'List phone verification challenges, deliverability metrics, and error rates',
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            statusFilter: { type: 'string' },
            purposeFilter: { type: 'string' },
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = (request.query as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminGetPhoneChallenges(token, {
          search: query.search,
          statusFilter: query.statusFilter,
          purposeFilter: query.purposeFilter,
          page: query.page ? Number(query.page) : 1,
          pageSize: query.pageSize ? Number(query.pageSize) : 20,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to fetch phone verification challenges.',
          },
        });
      }
    }
  );
};

export default adminPhoneChallengeRoutes;
