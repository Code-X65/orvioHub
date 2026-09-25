import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

export const platformRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/platform/applications or /api/v1/platform/applications
  fastify.get(
    '/applications',
    {
      schema: {
        tags: ['Platform'],
        summary: 'List registered platform applications with metadata and requirements',
      },
    },
    async (_request, reply) => {
      try {
        const apps = await dataService.listPlatformApplications();
        return reply.send({
          success: true,
          data: {
            applications: apps || [],
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list platform applications.',
          },
        });
      }
    }
  );

  // GET /v1/platform/applications/:key
  fastify.get(
    '/applications/:key',
    {
      schema: {
        tags: ['Platform'],
        summary: 'Get single platform application by key',
        params: {
          type: 'object',
          required: ['key'],
          properties: {
            key: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { key } = request.params as { key: string };
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
        return reply.send({
          success: true,
          data: { application: app },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to get platform application.',
          },
        });
      }
    }
  );
};
