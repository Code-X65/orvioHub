import type { FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

export async function requireWorkspaceAccess(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const workspaceId =
    (request.params as any)?.workspaceId ||
    (request.params as any)?.id;

  // Non workspace-scoped endpoints (e.g. GET /api/v1/workspaces or POST /api/v1/workspaces) are bypassed
  if (!workspaceId) return;

  const userId = request.user?.id;
  if (!userId) {
    reply.status(401).send({
      success: false,
      error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
    });
    return;
  }

  const workspace = (await dataService.getWorkspaceById(workspaceId)) as any;
  if (!workspace) {
    reply.status(404).send({
      success: false,
      error: { code: ERROR_CODES.WORKSPACE_NOT_FOUND, message: 'Workspace not found.' },
    });
    return;
  }

  const hasAccess = await dataService.userBelongsToWorkspace(userId, workspaceId, workspace);
  if (!hasAccess) {
    reply.status(403).send({
      success: false,
      error: {
        code: ERROR_CODES.WORKSPACE_ACCESS_DENIED,
        message: 'Access to this workspace denied.',
      },
    });
    return;
  }
}
