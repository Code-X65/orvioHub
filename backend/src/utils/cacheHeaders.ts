import type { FastifyPluginAsync, FastifyReply } from 'fastify';

/**
 * Attaches a Cache-Invalidate header to a Fastify reply for mutation responses.
 * Accepts tags or tag arrays (e.g. ['workspaces', 'workspaces:123', 'branches']).
 */
export function setCacheInvalidateHeader(
  reply: FastifyReply,
  tags: string | string[]
): FastifyReply {
  const tagList = Array.isArray(tags) ? tags : [tags];
  const cleanTags = tagList
    .map((t) => t.trim())
    .filter(Boolean);

  if (cleanTags.length > 0) {
    const existing = reply.getHeader('Cache-Invalidate');
    const combined = existing
      ? `${existing},${cleanTags.join(',')}`
      : cleanTags.join(',');
    reply.header('Cache-Invalidate', combined);
  }

  return reply;
}

/**
 * Fastify hook helper to automatically set Cache-Invalidate headers on successful mutating responses.
 */
export function attachAutomaticCacheInvalidation(
  fastify: Parameters<FastifyPluginAsync>[0],
  defaultTag: string
) {
  fastify.addHook('onSend', async (request, reply) => {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && reply.statusCode < 400) {
      const url = request.url;
      const parts = url
        .replace(/^\/api\/v\d+\//, '')
        .replace(/^\//, '')
        .split('?')[0]
        .split('/');

      const tags = new Set<string>();
      if (defaultTag) tags.add(defaultTag);

      if (parts[0]) tags.add(parts[0]);
      if (parts[1]) {
        tags.add(`${parts[0]}:${parts[1]}`);
        if (defaultTag) tags.add(`${defaultTag}:${parts[1]}`);
      }
      if (parts[2]) {
        tags.add(parts[2]);
      }

      setCacheInvalidateHeader(reply, Array.from(tags));
    }
  });
}

