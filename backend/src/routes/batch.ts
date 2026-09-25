import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const subRequestSchema = z.object({
  id: z.string().min(1).max(100),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  path: z.string().min(1).max(1000),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
});

const batchBodySchema = z.object({
  requests: z.array(subRequestSchema).min(1).max(20),
});

export const batchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/batch',
    {
      schema: {
        tags: ['Batch'],
        summary: 'Execute multiple API requests in a single HTTP round-trip',
        body: {
          type: 'object',
          required: ['requests'],
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'path'],
                properties: {
                  id: { type: 'string' },
                  method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                  path: { type: 'string' },
                  headers: { type: 'object' },
                  body: {},
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = batchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_BATCH_REQUEST',
            message: 'Invalid batch request payload',
            details: parsed.error.issues,
          },
        });
      }

      const { requests } = parsed.data;

      // Base headers inherited from parent request (e.g. Authorization, cookies, workspace context)
      const baseHeaders: Record<string, string> = {};
      if (request.headers.authorization) {
        baseHeaders.authorization = request.headers.authorization;
      }
      if (request.headers.cookie) {
        baseHeaders.cookie = request.headers.cookie;
      }
      if (request.headers['x-workspace-id']) {
        baseHeaders['x-workspace-id'] = String(request.headers['x-workspace-id']);
      }
      if (request.headers['x-branch-id']) {
        baseHeaders['x-branch-id'] = String(request.headers['x-branch-id']);
      }
      if (request.headers['x-requested-with']) {
        baseHeaders['x-requested-with'] = String(request.headers['x-requested-with']);
      }

      // Execute sub-requests via fastify.inject
      const results = await Promise.all(
        requests.map(async (subReq) => {
          let cleanPath = subReq.path.trim();
          if (!cleanPath.startsWith('/')) {
            cleanPath = `/${cleanPath}`;
          }

          let targetUrl = cleanPath;
          if (cleanPath.startsWith('/v1/')) {
            targetUrl = `/api${cleanPath}`;
          } else if (
            !cleanPath.startsWith('/api/') &&
            !cleanPath.startsWith('/ready') &&
            !cleanPath.startsWith('/version') &&
            !cleanPath.startsWith('/health') &&
            cleanPath !== '/'
          ) {
            targetUrl = `/api/v1${cleanPath}`;
          }

          // Prevent nested recursive batch calls
          if (targetUrl.includes('/batch')) {
            return {
              id: subReq.id,
              status: 400,
              data: {
                success: false,
                error: {
                  code: 'RECURSIVE_BATCH_NOT_ALLOWED',
                  message: 'Nested batch requests are not permitted.',
                },
              },
            };
          }

          const combinedHeaders = {
            ...baseHeaders,
            ...subReq.headers,
            'content-type': 'application/json',
          };

          try {
            const injectRes = await fastify.inject({
              method: subReq.method as any,
              url: targetUrl,
              headers: combinedHeaders,
              payload: subReq.body,
            });

            let responseData: any;
            try {
              responseData = JSON.parse(injectRes.body);
            } catch {
              responseData = injectRes.body;
            }

            const responseHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(injectRes.headers)) {
              if (v !== undefined && typeof v === 'string') {
                responseHeaders[k] = v;
              }
            }

            return {
              id: subReq.id,
              status: injectRes.statusCode,
              headers: responseHeaders,
              data: responseData,
            };
          } catch (err: any) {
            return {
              id: subReq.id,
              status: 500,
              data: {
                success: false,
                error: {
                  code: 'SUBREQUEST_EXECUTION_ERROR',
                  message: err.message || 'Subrequest failed to execute.',
                },
              },
            };
          }
        })
      );

      return reply.status(200).send({
        success: true,
        responses: results,
      });
    }
  );
};
