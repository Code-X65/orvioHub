import type { FastifyRequest, FastifyReply } from 'fastify';

export function extractWorkspaceId(request: FastifyRequest): string | undefined {
  const params = request.params as Record<string, string | undefined>;
  const body = request.body as { workspaceId?: string } | undefined;
  const headerWsId = request.headers['x-workspace-id'] as string | undefined;

  return (
    params.workspaceId ||
    params.id ||
    headerWsId ||
    body?.workspaceId
  );
}

export function extractBranchId(request: FastifyRequest): string | undefined {
  const params = request.params as Record<string, string | undefined>;
  const body = request.body as { branchId?: string } | undefined;
  const headerBranchId = request.headers['x-branch-id'] as string | undefined;

  return (
    params.branchId ||
    headerBranchId ||
    body?.branchId
  );
}

/**
 * Deprecated extraction helpers retained for route compatibility. Branch
 * authorization is implemented only by fastify.requireBranchAccess in the
 * authorization plugin, which also evaluates membership branchIds.
 */
