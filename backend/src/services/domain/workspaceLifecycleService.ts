import { ConvexHttpClient } from 'convex/browser';
import { BaseRepository } from '../../repositories/baseRepository.js';
import { AuditNotificationRepository } from '../../repositories/auditNotificationRepository.js';
import { entitlementService } from '../entitlementService.js';
import { AUDIT_EVENTS, ERROR_CODES } from '../../config/constants.js';

export interface CreateWorkspaceParams {
  name: string;
  slug?: string;
  type?: string;
  typeConfig?: Record<string, any>;
  ownerId: string;
  organizationId?: string;
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  currency?: string;
  phone?: string;
  logoUrl?: string;
  initialProduct?: string;
}

export interface UpdateWorkspaceSettingsParams {
  workspaceId: string;
  name?: string;
  type?: string;
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  currency?: string;
  phone?: string;
  logoUrl?: string;
  enabledModules?: string[];
  settings?: Record<string, any>;
  userId: string;
}

/**
 * Domain Service: WorkspaceLifecycleService
 * Encapsulates workspace provisioning invariants, lifecycle state transitions,
 * quota enforcement, and default product provisioning.
 */
export class WorkspaceLifecycleService extends BaseRepository {
  constructor(
    client?: ConvexHttpClient,
    private readonly auditRepo?: AuditNotificationRepository
  ) {
    super(client);
  }

  /**
   * Provision a new workspace with plan entitlement verification
   */
  public async createWorkspace(params: CreateWorkspaceParams): Promise<{ workspaceId: string; slug: string }> {
    // 1. Quota check: Verify user is entitled to create another workspace
    const entitlement = await entitlementService.checkWorkspaceCreationEntitlement(params.ownerId);
    if (!entitlement.allowed) {
      const err: any = new Error(entitlement.error || 'Workspace limit reached for current plan.');
      err.code = ERROR_CODES.PLAN_LIMIT_REACHED;
      err.statusCode = 403;
      err.details = {
        current: entitlement.current,
        limit: entitlement.limit,
        planKey: entitlement.planKey,
      };
      throw err;
    }

    // 2. Generate canonical slug if not provided
    const baseSlug = params.slug || params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

    // 3. Create workspace via Convex mutation
    const initialProduct = (params.initialProduct || 'inventory').toLowerCase();
    const workspaceId = await this.mutate('workspaces:createWorkspace', {
      name: params.name,
      slug,
      type: params.type || 'business',
      ownerId: params.ownerId as any,
      country: params.country,
      state: params.state,
      city: params.city,
      timezone: params.timezone,
      currency: params.currency,
      phone: params.phone,
      logoUrl: params.logoUrl,
      initialProduct,
      organizationId: params.organizationId as any,
    });

    // 4. Audit Log
    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        organizationId: params.organizationId,
        workspaceId,
        actorUserId: params.ownerId,
        eventType: AUDIT_EVENTS.WORKSPACE_CREATED,
        resource: 'workspaces',
        entityId: workspaceId,
        metadata: { name: params.name, slug, initialProduct },
      }).catch(() => {});
    }

    return { workspaceId, slug };
  }

  /**
   * Update workspace configuration and emit audit logs
   */
  public async updateSettings(params: UpdateWorkspaceSettingsParams): Promise<any> {
    const existing = await this.query('workspaces:getWorkspaceById', { workspaceId: params.workspaceId as any });
    if (!existing) {
      const err: any = new Error('Workspace not found.');
      err.code = ERROR_CODES.WORKSPACE_NOT_FOUND;
      err.statusCode = 404;
      throw err;
    }

    const { workspaceId, userId, ...data } = params;
    const result = await this.mutate('workspaces:updateWorkspace', {
      workspaceId: workspaceId as any,
      ...data,
    });

    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        workspaceId,
        actorUserId: userId,
        eventType: AUDIT_EVENTS.WORKSPACE_UPDATED,
        resource: 'workspaces',
        entityId: workspaceId,
        metadata: { updatedFields: Object.keys(data) },
      }).catch(() => {});
    }

    return result;
  }

  /**
   * Safe workspace archival with safety invariants
   */
  public async archiveWorkspace(workspaceId: string, userId: string, reason?: string): Promise<any> {
    const workspace: any = await this.query('workspaces:getWorkspaceById', { workspaceId: workspaceId as any });
    if (!workspace) {
      const err: any = new Error('Workspace not found.');
      err.code = ERROR_CODES.WORKSPACE_NOT_FOUND;
      err.statusCode = 404;
      throw err;
    }

    const result = await this.mutate('workspaces:archiveWorkspace', {
      workspaceId: workspaceId as any,
      callerUserId: userId as any,
      reason,
    });

    return result;
  }

  /**
   * Restore an archived workspace
   */
  public async restoreWorkspace(workspaceId: string, userId: string): Promise<any> {
    const result = await this.mutate('workspaces:restoreWorkspace', {
      workspaceId: workspaceId as any,
      callerUserId: userId as any,
    });

    return result;
  }

  /**
   * Suspend a workspace
   */
  public async suspendWorkspace(workspaceId: string, userId: string, reason?: string, notes?: string): Promise<any> {
    const result = await this.mutate('workspaces:suspendWorkspace', {
      workspaceId: workspaceId as any,
      callerUserId: userId as any,
      reason,
      notes,
    });

    return result;
  }

  /**
   * Request workspace deletion (cooling-off period)
   */
  public async requestDeletion(workspaceId: string, userId: string, reason?: string): Promise<any> {
    const result = await this.mutate('workspaces:requestWorkspaceDeletion', {
      workspaceId: workspaceId as any,
      callerUserId: userId as any,
      reason,
    });

    return result;
  }

  /**
   * Cancel workspace deletion during cooling-off
   */
  public async cancelDeletion(workspaceId: string, userId: string): Promise<any> {
    const result = await this.mutate('workspaces:cancelWorkspaceDeletion', {
      workspaceId: workspaceId as any,
      callerUserId: userId as any,
    });

    return result;
  }

  /**
   * Transfer workspace ownership to another active member
   */
  public async transferOwnership(
    workspaceId: string,
    callerUserId: string,
    newOwnerUserId: string,
    transferPassword?: string,
    reason?: string
  ): Promise<any> {
    const result = await this.mutate('workspaces:transferWorkspaceOwnership', {
      workspaceId: workspaceId as any,
      callerUserId: callerUserId as any,
      newOwnerUserId: newOwnerUserId as any,
      transferPassword,
      reason,
    });

    return result;
  }
}

export const workspaceLifecycleService = new WorkspaceLifecycleService();

