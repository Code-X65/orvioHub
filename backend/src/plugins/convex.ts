import fp from 'fastify-plugin';
import { ConvexHttpClient } from 'convex/browser';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    convex: ConvexHttpClient | null;
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const convexClient = env.CONVEX_URL ? new ConvexHttpClient(env.CONVEX_URL) : null;
  fastify.decorate('convex', convexClient);
};

export const convexPlugin = fp(plugin, {
  name: 'convex-plugin',
});
