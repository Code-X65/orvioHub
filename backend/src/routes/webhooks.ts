import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { paystackService } from '../services/paystackService.js';
import { flutterwaveService } from '../services/flutterwaveService.js';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  const endpointSchema = z.object({ url: z.string().url().refine((value) => /^https:\/\//.test(value), 'Webhook URL must use HTTPS'), eventTypes: z.array(z.string()).min(1).max(30) });
  const requireWebhookAdmin = async (request: any, reply: any) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    const { workspaceId } = request.params as { workspaceId: string };
    const membership: any = await dataService.getWorkspaceMembership(workspaceId, request.user.id);
    if (!membership || !['owner', 'admin'].includes(String(membership.role || '').toLowerCase())) {
      return reply.status(403).send({ success: false, error: { code: 'permission_denied', message: 'Only workspace owners and admins can manage webhooks.' } });
    }
  };

  fastify.get('/workspaces/:workspaceId/webhooks', { preHandler: requireWebhookAdmin }, async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const endpoints: any[] = await dataService.listWebhookEndpoints(workspaceId) as any[];
    return { success: true, data: { endpoints: endpoints.map(({ secret, ...endpoint }) => endpoint) } };
  });

  fastify.post('/workspaces/:workspaceId/webhooks', { preHandler: requireWebhookAdmin }, async (request, reply) => {
    const parsed = endpointSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'validation_error', message: 'Invalid webhook endpoint.' } });
    const { workspaceId } = request.params as { workspaceId: string };
    const secret = crypto.randomBytes(32).toString('hex');
    const endpointId = await dataService.createWebhookEndpoint({ workspaceId, userId: request.user.id, secret, ...parsed.data });
    return reply.status(201).send({ success: true, data: { endpointId, secret } });
  });

  fastify.delete('/workspaces/:workspaceId/webhooks/:endpointId', { preHandler: requireWebhookAdmin }, async (request, reply) => {
    const { workspaceId, endpointId } = request.params as { workspaceId: string; endpointId: string };
    await dataService.removeWebhookEndpoint(workspaceId, endpointId);
    return reply.status(204).send();
  });

  // POST /api/v1/webhooks/paystack
  fastify.post(
    '/webhooks/paystack',
    {
      config: {
        rawBody: true,
      },
      schema: {
        tags: ['Webhooks'],
        summary: 'Paystack asynchronous webhook for charge notifications',
      },
    },
    async (request, reply) => {
      const signature = request.headers['x-paystack-signature'] as string;
      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});

      if (signature && !paystackService.verifyWebhookSignature(rawBody, signature)) {
        return reply.status(401).send({ message: 'Invalid Paystack signature' });
      }

      const payload = (request.body || {}) as any;
      const event = payload.event;
      const data = payload.data;

      if (event === 'charge.success' && data?.reference) {
        try {
          await dataService.markSuccessfulTransaction({
            gatewayReference: data.reference,
            gateway: 'paystack',
            metadata: {
              channel: data.channel,
              paidAt: data.paid_at,
              fees: data.fees,
              rawEvent: event,
            },
          });
        } catch (err: any) {
          fastify.log.error(err, `Error processing Paystack webhook for ref ${data.reference}`);
        }
      }

      return reply.status(200).send({ status: 'success' });
    }
  );

  // POST /api/v1/webhooks/flutterwave
  fastify.post(
    '/webhooks/flutterwave',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Flutterwave asynchronous webhook for payment notifications',
      },
    },
    async (request, reply) => {
      const secretHash = request.headers['verif-hash'] as string;

      if (secretHash && !flutterwaveService.verifyWebhookHash(secretHash)) {
        return reply.status(401).send({ message: 'Invalid Flutterwave secret hash' });
      }

      const payload = (request.body || {}) as any;
      const event = payload.event;
      const data = payload.data;

      if ((event === 'charge.completed' || payload['event.type'] === 'CARD_TRANSACTION') && data?.status === 'successful') {
        const txRef = data.tx_ref;
        if (txRef) {
          try {
            await dataService.markSuccessfulTransaction({
              gatewayReference: txRef,
              gateway: 'flutterwave',
              metadata: {
                flwRef: data.flw_ref,
                paymentType: data.payment_type,
                rawEvent: event,
              },
            });
          } catch (err: any) {
            fastify.log.error(err, `Error processing Flutterwave webhook for txRef ${txRef}`);
          }
        }
      }

      return reply.status(200).send({ status: 'success' });
    }
  );
};
