import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { realtimeEventBus, type RealtimeEventType } from '../services/realtimeEventBus.js';

const PublishEventSchema = z.object({
  type: z.enum([
    'notification.created',
    'notification.read',
    'notification.archived',
    'workspace.updated',
    'workspace.member_joined',
    'workspace.member_left',
    'branch.created',
    'branch.updated',
    'branch.deactivated',
    'inventory.stock_updated',
    'job.progress',
    'job.completed',
    'job.failed',
  ]),
  payload: z.record(z.any()),
  targetUserId: z.string().optional(),
  targetWorkspaceId: z.string().optional(),
});

export const realtimeRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/realtime/stream
   * Server-Sent Events (SSE) stream for real-time app events
   */
  fastify.get('/realtime/stream', async (request, reply) => {
    // Resolve user from session/auth
    const userId =
      (request as any).user?.id ||
      (request as any).user?._id ||
      (request.query as any)?.userId ||
      'anonymous';

    const workspaceId = (request.query as any)?.workspaceId;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if proxied
    reply.raw.flushHeaders?.();

    // Send initial connected event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: Date.now() })}\n\n`);

    // Event handler
    const onEvent = (event: any) => {
      try {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        request.log.error({ err }, 'Error writing SSE event to client stream');
      }
    };

    // Subscriptions
    const unsubUser = realtimeEventBus.subscribeUser(userId, onEvent);
    const unsubWs = workspaceId ? realtimeEventBus.subscribeWorkspace(workspaceId, onEvent) : null;

    // Periodic heartbeat to keep connections alive
    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    // Cleanup on client disconnect
    request.raw.on('close', () => {
      clearInterval(pingInterval);
      unsubUser();
      if (unsubWs) unsubWs();
    });
  });

  /**
   * POST /api/v1/realtime/publish
   * Publish an event to the realtime bus
   */
  fastify.post('/realtime/publish', async (request, reply) => {
    const parseResult = PublishEventSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event payload structure',
          fields: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { type, payload, targetUserId, targetWorkspaceId } = parseResult.data;

    const event = realtimeEventBus.publish(type as RealtimeEventType, payload, {
      targetUserId,
      targetWorkspaceId,
    });

    return reply.status(200).send({
      success: true,
      data: {
        event,
      },
    });
  });
};
