import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';
import { paystackService } from '../services/paystackService.js';
import { flutterwaveService } from '../services/flutterwaveService.js';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
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
