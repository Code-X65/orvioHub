import type { FastifyRequest, FastifyReply } from 'fastify';
import { ERROR_CODES } from '../config/constants.js';
import { dataService } from '../services/dataService.js';

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

export async function requireBranchAccess(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHENTICATED,
        message: 'Authentication required.',
      },
    });
  }

  const workspaceId = extractWorkspaceId(request);
  if (!workspaceId) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Workspace ID is required in request parameters or x-workspace-id header.',
      },
    });
  }

  const branchId = extractBranchId(request);
  if (!branchId) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Branch ID is required in request parameters or x-branch-id header.',
      },
    });
  }

  // Verify branch exists and belongs to workspace
  const branch = await dataService.getBranchById(branchId);
  if (!branch || (branch as any).workspaceId !== workspaceId) {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or does not belong to this workspace.',
      },
    });
  }

  // Attach context
  (request as any).workspaceId = workspaceId;
  (request as any).branchId = branchId;
  (request as any).branch = branch;
}
