import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';

export const listEndpoints = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => ctx.db.query('webhookEndpoints').withIndex('by_workspace', q => q.eq('workspaceId', args.workspaceId)).collect(),
});

export const createEndpoint = mutation({
  args: { workspaceId: v.id('workspaces'), url: v.string(), secret: v.string(), eventTypes: v.array(v.string()), userId: v.id('users') },
  handler: async (ctx, args) => ctx.db.insert('webhookEndpoints', { ...args, status: 'active', createdBy: args.userId, createdAt: Date.now(), updatedAt: Date.now() }),
});

export const removeEndpoint = mutation({
  args: { endpointId: v.id('webhookEndpoints'), workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => { const endpoint = await ctx.db.get(args.endpointId); if (!endpoint || endpoint.workspaceId !== args.workspaceId) throw new Error('WEBHOOK_NOT_FOUND'); await ctx.db.delete(args.endpointId); },
});

export const recordDelivery = mutation({
  args: { endpointId: v.id('webhookEndpoints'), workspaceId: v.id('workspaces'), eventId: v.string(), eventType: v.string(), payload: v.any(), status: v.union(v.literal('pending'), v.literal('delivered'), v.literal('failed')), attemptCount: v.number(), responseStatus: v.optional(v.number()), lastError: v.optional(v.string()), deliveredAt: v.optional(v.number()) },
  handler: async (ctx, args) => ctx.db.insert('webhookDeliveries', { ...args, createdAt: Date.now() }),
});
