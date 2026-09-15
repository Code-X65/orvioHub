import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

async function verifyAdminSession(ctx: any, sessionToken?: string) {
  if (!sessionToken) throw new Error("Admin authentication required.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session.");
  }
  const admin = await ctx.db.get(session.adminId);
  if (!admin || !admin.isActive) {
    throw new Error("Unauthorized admin account.");
  }
  return { admin, session };
}

async function resolveWorkspace(ctx: any, id: any) {
  let ws: any = null;
  try {
    ws = await (ctx.db as any).get(id);
  } catch {}
  if (!ws) {
    try {
      ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", id))
        .first();
    } catch {}
  }
  return ws;
}

async function logAudit(ctx: any, adminId: any, action: string, resourceId?: string, details?: any) {
  await ctx.db.insert("adminAuditLogs", {
    adminId,
    action,
    resourceType: "organization_deletions",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * listPendingOrganizationDeletions
 * Queries all organizations/workspaces currently in a pending deletion queue.
 */
export const listPendingOrganizationDeletions = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    // Query workspaces with deletionRequestedAt
    const pendingWorkspaces = await ctx.db
      .query("workspaces")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletionRequestedAt"), undefined),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .collect();

    const results = await Promise.all(
      pendingWorkspaces.map(async (ws) => {
        let owner: any = null;
        if (ws.ownerId) {
          owner = await ctx.db.get(ws.ownerId);
        }

        const scheduledAt = ws.deletionScheduledAt || (ws.deletionRequestedAt! + 30 * 86_400_000);
        const daysRemaining = Math.max(0, Math.ceil((scheduledAt - Date.now()) / (1000 * 60 * 60 * 24)));

        return {
          id: ws._id,
          name: ws.name,
          slug: ws.slug,
          ownerName: owner?.name || "Unknown",
          ownerEmail: owner?.email || "",
          deletionRequestedAt: ws.deletionRequestedAt!,
          deletionScheduledAt: scheduledAt,
          daysRemaining,
          reason: ws.suspensionReason || "Customer requested workspace deletion",
        };
      })
    );

    return results;
  },
});

/**
 * cancelOrganizationDeletion
 * Aborts a pending deletion request and restores the workspace to active.
 */
export const cancelOrganizationDeletion = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    sessionToken: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();
    await ctx.db.patch(ws._id, {
      deletionRequestedAt: undefined,
      deletionScheduledAt: undefined,
      status: "active",
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_DELETION_CANCELLED", ws._id, {
      workspaceName: ws.name,
      reason: args.reason || "Superadmin cancellation",
    });

    return { success: true };
  },
});

/**
 * purgeOrganizationImmediate
 * Expedites an immediate permanent purge of an organization.
 */
export const purgeOrganizationImmediate = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    sessionToken: v.optional(v.string()),
    confirmationPhrase: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    if (args.confirmationPhrase !== `purge ${ws.slug}`) {
      throw new Error(`Confirmation phrase must exactly match "purge ${ws.slug}"`);
    }

    const now = Date.now();
    await ctx.db.patch(ws._id, {
      status: "deleted",
      deletedAt: now,
      deletedBy: admin.name || "Superadmin",
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_IMMEDIATE_PURGE_EXECUTED", ws._id, {
      workspaceName: ws.name,
      slug: ws.slug,
    });

    return { success: true };
  },
});
