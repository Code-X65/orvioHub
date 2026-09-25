import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = ERROR_CODES.VALIDATION_ERROR
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ResolvedIdentifier {
  id: string;
  type: 'workspace' | 'organization';
  organizationId?: string;
  workspaceId?: string;
}

/**
 * Standardizes parameter resolution to a valid workspaceId.
 * Prioritizes workspaceId, falling back to organizationId with explicit primary workspace resolution.
 */
export async function resolveIdentifier(
  workspaceId?: string,
  organizationId?: string,
  user?: any
): Promise<ResolvedIdentifier> {
  // 1. Primary: workspaceId
  if (workspaceId) {
    try {
      const workspace = await (dataService as any).getWorkspaceById?.(workspaceId) || await (dataService as any).getWorkspace?.(workspaceId);
      if (workspace) {
        // Validate user access if user object provided and not admin
        if (user && !user.isAdmin && user.id) {
          try {
            const hasAccess = typeof (dataService as any).verifyUserWorkspaceAccess === 'function'
              ? await (dataService as any).verifyUserWorkspaceAccess(user.id, workspace.id || workspace._id || workspaceId)
              : true;
            if (!hasAccess && user.workspaceId !== workspaceId) {
              const orgId = workspace.organizationId || workspace.orgId;
              if (orgId) {
                const memberships = await dataService.getUserMemberships(user.id);
                const isMember = memberships.some((m: any) => (m.organizationId === orgId || m.membership?.organizationId === orgId));
                if (!isMember) {
                  throw new AppError('Forbidden: Access to workspace denied', 403, ERROR_CODES.FORBIDDEN);
                }
              }
            }
          } catch (accessErr: any) {
            if (accessErr instanceof AppError) throw accessErr;
          }
        }

        return {
          id: workspace.id || workspace._id || workspaceId,
          type: 'workspace',
          workspaceId: workspace.id || workspace._id || workspaceId,
          organizationId: workspace.organizationId || workspace.orgId,
        };
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      return { id: workspaceId, type: 'workspace', workspaceId };
    }
  }

  // 2. Fallback: organizationId -> resolve to primary workspace
  if (organizationId) {
    try {
      const workspaces = await dataService.getOrganizationWorkspaces(organizationId);
      if (workspaces && workspaces.length > 0) {
        const primaryWs = workspaces.find((w: any) => w.isPrimary) || workspaces[0];
        const resolvedWsId = primaryWs._id || primaryWs.id;
        return {
          id: resolvedWsId,
          type: 'workspace',
          workspaceId: resolvedWsId,
          organizationId,
        };
      }
    } catch {}

    return {
      id: organizationId,
      type: 'organization',
      organizationId,
    };
  }

  throw new AppError('No valid workspace or organization identifier provided', 400, ERROR_CODES.VALIDATION_ERROR);
}
