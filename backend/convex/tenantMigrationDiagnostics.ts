import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * Audit and diagnostic query to analyze tenant identity mapping and detect conflicts
 */
export const auditTenantIdentity = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const workspaces = await ctx.db.query("workspaces").collect();
    const branches = await ctx.db.query("branches").collect();
    const orgApps = await ctx.db.query("orgApplications").collect();
    const wsApps = await ctx.db.query("workspaceProducts").collect();
    const orgMemberships = await ctx.db.query("organizationMemberships").collect();
    const wsMemberships = await ctx.db.query("workspaceMemberships").collect();
    const subs = await ctx.db.query("subscriptions").collect();

    const conflicts: any[] = [];
    const mappings: any[] = [];

    const orgMap = new Map(orgs.map((o) => [o._id, o]));
    const wsMap = new Map(workspaces.map((w) => [w._id, w]));

    // 1. Audit Workspaces to Organizations
    for (const ws of workspaces) {
      if (ws.organizationId) {
        const org = orgMap.get(ws.organizationId);
        if (!org) {
          conflicts.push({
            type: "ORPHANED_WORKSPACE_ORG_ID",
            workspaceId: ws._id,
            referencedOrganizationId: ws.organizationId,
            message: `Workspace '${ws.name}' references non-existent organization '${ws.organizationId}'`,
          });
        } else {
          mappings.push({
            workspaceId: ws._id,
            workspaceName: ws.name,
            organizationId: org._id,
            organizationName: org.name,
            ownerId: ws.ownerId || org.ownerId,
            status: ws.status,
          });
        }
      } else {
        // Workspace without explicit organizationId (legacy direct workspace)
        mappings.push({
          workspaceId: ws._id,
          workspaceName: ws.name,
          organizationId: ws._id, // Mapped 1-to-1 in single-workspace accounts
          organizationName: ws.name,
          ownerId: ws.ownerId,
          status: ws.status,
          isImplicitMapping: true,
        });
      }
    }

    // 2. Audit Branches for Tenant Consistency
    for (const br of branches) {
      if (br.status === "deleted") continue;

      let ws = br.workspaceId ? wsMap.get(br.workspaceId) : null;
      let org = br.organizationId ? orgMap.get(br.organizationId) : null;

      if (!ws && !org) {
        conflicts.push({
          type: "ORPHANED_BRANCH",
          branchId: br._id,
          branchName: br.name,
          workspaceId: br.workspaceId,
          organizationId: br.organizationId,
          message: `Branch '${br.name}' is not attached to any existing workspace or organization`,
        });
      } else if (ws && org && ws.organizationId && ws.organizationId !== org._id) {
        conflicts.push({
          type: "BRANCH_TENANT_MISMATCH",
          branchId: br._id,
          branchName: br.name,
          branchWorkspaceId: br.workspaceId,
          branchOrgId: br.organizationId,
          workspaceOrgId: ws.organizationId,
          message: `Branch '${br.name}' has workspaceId and organizationId that point to different organizations`,
        });
      }
    }

    // 3. Audit Subscriptions for Tenant Mapping
    for (const sub of subs) {
      if (!sub.organizationId && !sub.workspaceId && !sub.userId) {
        conflicts.push({
          type: "ORPHANED_SUBSCRIPTION",
          subscriptionId: sub._id,
          planKey: sub.planKey,
          message: `Subscription has no tenant identifier (missing organizationId, workspaceId, and userId)`,
        });
      }
    }

    return {
      timestamp: Date.now(),
      summary: {
        totalOrganizations: orgs.length,
        totalWorkspaces: workspaces.length,
        totalBranches: branches.filter((b) => b.status !== "deleted").length,
        totalSubscriptions: subs.length,
        totalOrgMemberships: orgMemberships.length,
        totalWsMemberships: wsMemberships.length,
        conflictCount: conflicts.length,
      },
      conflicts,
      mappings,
    };
  },
});

/**
 * Idempotent migration helper to backfill missing organizationId fields
 */
export const repairTenantIdentityMappings = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? true;
    const now = Date.now();
    const repairs: any[] = [];

    const workspaces = await ctx.db.query("workspaces").collect();
    const branches = await ctx.db.query("branches").collect();

    // 1. Repair branches with workspaceId but missing organizationId
    for (const br of branches) {
      if (br.workspaceId && !br.organizationId) {
        const ws = await ctx.db.get(br.workspaceId);
        if (ws?.organizationId) {
          repairs.push({
            entity: "branches",
            id: br._id,
            action: "set_organizationId",
            value: ws.organizationId,
          });
          if (!isDryRun) {
            await ctx.db.patch(br._id, {
              organizationId: ws.organizationId,
              updatedAt: now,
            });
          }
        }
      }
    }

    return {
      dryRun: isDryRun,
      repairedCount: repairs.length,
      repairs,
    };
  },
});
