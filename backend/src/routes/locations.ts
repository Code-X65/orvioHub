import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';

export const locationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/locations/states
  fastify.get(
    '/states',
    {
      schema: {
        tags: ['Locations'],
        summary: 'List all Nigerian states',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  states: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        _id: { type: 'string' },
                        name: { type: 'string' },
                        code: { type: 'string' },
                        stateCode: { type: 'string' },
                      },
                    },
                  },
                },
              },
              states: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                    stateCode: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const states = await dataService.getStates();
      return reply.send({
        success: true,
        data: { states },
        states,
      });
    }
  );

  // GET /api/v1/locations/states/:stateCode/lgas
  fastify.get(
    '/states/:stateCode/lgas',
    {
      schema: {
        tags: ['Locations'],
        summary: 'List Local Government Areas (LGAs) for a Nigerian state',
        params: {
          type: 'object',
          required: ['stateCode'],
          properties: {
            stateCode: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { stateCode } = request.params as { stateCode: string };
      const lgas = await dataService.getLgas(stateCode);
      return reply.send({
        success: true,
        data: { stateCode: stateCode.toUpperCase(), lgas },
        lgas,
      });
    }
  );

  // POST /api/v1/locations/seed (Seeds / verifies database)
  fastify.post(
    '/seed',
    {
      schema: {
        tags: ['Locations'],
        summary: 'Seed Nigerian states and LGAs database',
      },
    },
    async (request, reply) => {
      const body = (request.body as { force?: boolean }) || {};
      const result = await dataService.seedNigerianLocations(body.force);
      return reply.send(result);
    }
  );
};
