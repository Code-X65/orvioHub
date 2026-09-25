import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const clientLogItemSchema = z.object({
  message: z.string().min(1).max(2000),
  code: z.string().max(100).optional(),
  endpoint: z.string().max(500).optional(),
  method: z.string().max(20).optional(),
  status: z.number().int().optional(),
  stack: z.string().max(10000).optional(),
  context: z
    .object({
      userId: z.string().max(100).nullable().optional(),
      workspaceId: z.string().max(100).nullable().optional(),
      branchId: z.string().max(100).nullable().optional(),
      url: z.string().max(2000).optional(),
      userAgent: z.string().max(1000).optional(),
      os: z.string().max(100).optional(),
      browser: z.string().max(100).optional(),
    })
    .passthrough()
    .optional(),
  payload: z.any().optional(),
  timestamp: z.string().optional(),
});

const clientLogsBodySchema = z.union([
  clientLogItemSchema,
  z.array(clientLogItemSchema).min(1).max(50),
  z.object({
    logs: z.array(clientLogItemSchema).min(1).max(50),
  }),
]);

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'secret',
  'authorization',
  'cardnumber',
  'cvv',
  'cvc',
  'pin',
  'cookie',
  'cookieheader',
  'session',
]);

/**
 * Recursively redacts sensitive keys from client-submitted payloads.
 */
function sanitizePayload(data: any, depth = 0): any {
  if (depth > 5 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const clientLogsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/client-logs',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = clientLogsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_LOG_PAYLOAD',
            message: 'Invalid client log schema',
            details: parsed.error.issues,
          },
        });
      }

      const rawItems = Array.isArray(parsed.data)
        ? parsed.data
        : 'logs' in parsed.data && Array.isArray(parsed.data.logs)
        ? parsed.data.logs
        : [parsed.data as z.infer<typeof clientLogItemSchema>];

      for (const item of rawItems) {
        const sanitizedItem = {
          ...item,
          payload: sanitizePayload(item.payload),
          clientIp: request.ip,
          receivedAt: new Date().toISOString(),
        };

        request.log.warn({ clientLog: sanitizedItem }, `[Client Log] ${item.message}`);

        if (item.status && item.status >= 500) {
          const syntheticErr = new Error(`[Client Error] ${item.endpoint || 'unknown'}: ${item.message}`);
          syntheticErr.name = item.code || 'ClientApiError';
          if (item.stack) syntheticErr.stack = item.stack;
          fastify.captureException?.(syntheticErr);
        } else if (fastify.logtail) {
          fastify.logtail.warn(`[Client Log] ${item.message}`, sanitizedItem);
        }
      }

      return reply.status(200).send({
        success: true,
        logged: rawItems.length,
      });
    }
  );
};
