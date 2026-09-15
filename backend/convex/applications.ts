import { query, mutation } from "./_generated/server.js";
import { Id } from "./_generated/dataModel.js";
import { v } from "convex/values";

/**
 * Helper to resolve organization whether given an organization ID or workspace ID
 */
export async function resolveOrganization(
  ctx: { db: any },
  rawId: string
): Promise<{
  org: any;
  orgId: Id<"organizations"> | null;
  workspace?: any;
  workspaceId?: Id<"workspaces"> | null;
}> {
  // 1. Direct organizations ID
  const directOrgId = ctx.db.normalizeId("organizations", rawId);
  if (directOrgId) {
    const org = await ctx.db.get(directOrgId);
    if (org) {
      let ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", directOrgId))
        .first();
      if (!ws && org.ownerId) {
        ws = await ctx.db
          .query("workspaces")
          .withIndex("by_owner", (q: any) => q.eq("ownerId", org.ownerId))
          .first();
      }
      return { org, orgId: directOrgId, workspace: ws || null, workspaceId: ws?._id || null };
    }
  }

  // 2. Workspaces ID
  const wsId = ctx.db.normalizeId("workspaces", rawId);
  if (wsId) {
    const ws = await ctx.db.get(wsId);
    if (ws) {
      if (ws.organizationId) {
        const org = await ctx.db.get(ws.organizationId);
        if (org) {
          return { org, orgId: ws.organizationId, workspace: ws, workspaceId: ws._id };
        }
      }
      if (ws.ownerId) {
        const org = await ctx.db
          .query("organizations")
          .withIndex("by_ownerId", (q: any) => q.eq("ownerId", ws.ownerId))
          .first();
        if (org) {
          return { org, orgId: org._id, workspace: ws, workspaceId: ws._id };
        }
      }
      return { org: null, orgId: null, workspace: ws, workspaceId: ws._id };
    }
  }

  return { org: null, orgId: null, workspace: null, workspaceId: null };
}

/**
 * Mutation: Seed standard applications if not present
 */
export const seedApplications = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const defaultApps = [
      {
        key: "inventory",
        name: "Inventory",
        description: "Manage products, stock, sales, branches, and reports.",
        status: "available" as const,
        isVisibleToUsers: true,
        isActivatable: true,
        route: "inventory.orviohub.localhost",
        enabled: true,
      },
      {
        key: "task_management",
        name: "Task Management",
        description: "Agile sprints, interactive kanban boards & team deliverables.",
        status: "coming_soon" as const,
        isVisibleToUsers: false,
        isActivatable: false,
        enabled: false,
      },
      {
        key: "crm",
        name: "CRM",
        description: "Customer CRM & Pipeline",
        status: "coming_soon" as const,
        isVisibleToUsers: false,
        isActivatable: false,
        enabled: false,
      },
      {
        key: "gym",
        name: "Gym Management",
        description: "Gym & Fitness Membership",
        status: "coming_soon" as const,
        isVisibleToUsers: false,
        isActivatable: false,
        enabled: false,
      },
      {
        key: "booking",
        name: "Booking",
        description: "Appointments & Scheduling",
        status: "coming_soon" as const,
        isVisibleToUsers: false,
        isActivatable: false,
        enabled: false,
      },
    ];

    const results = [];
    for (const appDef of defaultApps) {
      const existing = await ctx.db
        .query("applications")
        .withIndex("by_key", (q: any) => q.eq("key", appDef.key))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("applications", {
          ...appDef,
          createdAt: now,
          updatedAt: now,
        });
        results.push({ id, ...appDef, created: true });
      } else {
        // Upgrade existing records with lifecycle status if missing
        await ctx.db.patch(existing._id, {
          status: appDef.status,
          isVisibleToUsers: appDef.isVisibleToUsers,
          isActivatable: appDef.isActivatable,
          route: appDef.route,
          enabled: appDef.enabled,
          updatedAt: now,
        });
        results.push({ id: existing._id, ...existing, created: false });
      }
    }
    return results;
  },
});

/**
 * Query: Get all available applications visible to regular users
 */
export const getAvailableApplications = query({
  args: {},
  handler: async (ctx) => {
    const apps = await ctx.db.query("applications").collect();
    if (apps.length === 0) {
      return [
        {
          key: "inventory",
          name: "Inventory",
          status: "available",
          isVisibleToUsers: true,
          isActivatable: true,
          route: "inventory.orviohub.localhost",
          enabled: true,
        },
      ];
    }
    return apps.filter(
      (app: any) =>
        app.isVisibleToUsers === true || (app.key === "inventory" && app.status !== "disabled")
    );
  },
});

/**
 * Query: Get applications with organization activation status (user-facing, Inventory only)
 */
export const getOrgApplications = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) return [];

    let allApps = await ctx.db.query("applications").collect();
    if (allApps.length === 0) {
      return [
        {
          key: "inventory",
          name: "Inventory",
          isActivated: false,
          status: "inactive",
          isVisibleToUsers: true,
          isActivatable: true,
        },
      ];
    }

    const orgApps = await ctx.db
      .query("orgApplications")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .collect();

    const orgAppMap = new Map(orgApps.map((oa: any) => [oa.applicationId, oa]));

    const orgSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .first();

    const currentPlanKey = orgSub?.planKey || "free_trial";

    return allApps
      .filter((app: any) => app.isVisibleToUsers === true || (app.key === "inventory" && app.status !== "disabled"))
      .map((app: any) => {
        const orgApp = orgAppMap.get(app._id);
        const isActivated =
          !!orgApp &&
          orgApp.enabled !== false &&
          (orgApp.status === "active" || orgApp.status === "trial" || orgApp.status === "trialing");

        const key = app.key || "inventory";
        const defaultNames: Record<string, string> = {
          inventory: "Inventory",
          pos: "POS",
          booking: "Booking",
          gym: "Gym Management",
          taskmanagement: "Task Management",
          task_management: "Task Management",
        };
        const name = app.name || defaultNames[key] || (key.charAt(0).toUpperCase() + key.slice(1));

        return {
          applicationId: app._id,
          key,
          name,
          isActivated,
          status: orgApp?.status || "inactive",
          planId: orgApp?.planId || currentPlanKey,
          billingCycle: orgApp?.billingCycle || orgSub?.billingInterval || "monthly",
          trialEndsAt: orgApp?.trialEndsAt || orgSub?.trialEndsAt,
          activatedAt: orgApp?.activatedAt,
        };
      });
  },
});

/**
 * Mutation: Activate an application for an organization (US-APP1)
 */
export const activateApplication = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.string(), // "inventory", "pos", etc.
    userId: v.optional(v.id("users")),
    planKey: v.optional(v.string()),
    billingCycle: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    paymentGateway: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    // Guard: Only allow Inventory in MVP (or explicitly activatable applications)
    const normKey = args.applicationKey.toLowerCase();
    if (normKey !== "inventory") {
      throw new Error("APPLICATION_NOT_AVAILABLE");
    }

    // 1. Validate user membership & role if userId provided
    if (args.userId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", orgId).eq("userId", args.userId!)
        )
        .first();

      if (!membership || membership.status !== "ACTIVE") {
        throw new Error("ORGANIZATION_ACCESS_DENIED");
      }

      const allowedRoles = ["OWNER", "ADMIN", "MANAGER"];
      if (!allowedRoles.includes(membership.role)) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }
    }

    const now = Date.now();

    // 2. Load org subscription
    const orgSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .first();

    // Rule 3: No app without org subscription
    if (!orgSub) {
      throw new Error(
        "An active subscription is required before activating applications. Please subscribe first."
      );
    }

    const activeStatuses = ["active", "trial", "trialing"];
    if (!activeStatuses.includes(orgSub.status)) {
      throw new Error(
        "Your organization subscription is not active. Please renew or update your subscription."
      );
    }

    const currentPlanKey = (orgSub.planKey || "free_trial").toLowerCase();
    const isFreeTrialOrg = currentPlanKey === "free_trial" || currentPlanKey === "free";

    // 3. Resolve or create application record
    let app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", args.applicationKey))
      .first();

    if (!app) {
      const appId = await ctx.db.insert("applications", {
        key: args.applicationKey,
        name: args.applicationKey.charAt(0).toUpperCase() + args.applicationKey.slice(1),
        status: "available",
        isVisibleToUsers: true,
        isActivatable: true,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
      app = await ctx.db.get(appId);
    }

    // 4. Enforce plan limits for Free Trial
    if (isFreeTrialOrg) {
      // Check allowed apps on Free Trial
      if (args.applicationKey.toLowerCase() !== "inventory") {
        throw new Error("This application is not available on Free Trial. Upgrade to Standard.");
      }

      // Check max 1 app limit
      const existingOrgApps = await ctx.db
        .query("orgApplications")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
        .collect();

      const activeOtherApps = existingOrgApps.filter(
        (a: any) =>
          a.applicationId !== app!._id &&
          a.enabled !== false &&
          (a.status === "active" || a.status === "trial" || a.status === "trialing")
      );

      if (activeOtherApps.length >= 1) {
        throw new Error(
          "Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more."
        );
      }
    }

    // 5. Upsert orgApplications row
    const existingOrgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app!._id)
      )
      .first();

    let orgApplicationId: Id<"orgApplications">;

    if (existingOrgApp) {
      orgApplicationId = existingOrgApp._id;
      await ctx.db.patch(existingOrgApp._id, {
        enabled: true,
        status: "active",
        planId: currentPlanKey,
        activatedAt: existingOrgApp.activatedAt || now,
        activatedBy: args.userId || existingOrgApp.activatedBy,
        updatedAt: now,
      });
    } else {
      orgApplicationId = await ctx.db.insert("orgApplications", {
        organizationId: orgId,
        applicationId: app!._id,
        enabled: true,
        status: "active",
        planId: currentPlanKey,
        billingCycle: orgSub.billingInterval || "monthly",
        activatedAt: now,
        activatedBy: args.userId,
        config: { initialSetup: true },
        createdAt: now,
        updatedAt: now,
      });
    }

    // 6. Sync workspaceProducts if workspace is attached
    if (workspace) {
      const existingWsProd = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace_product", (q: any) =>
          q.eq("workspaceId", workspace._id).eq("productKey", args.applicationKey)
        )
        .first();

      if (existingWsProd) {
        await ctx.db.patch(existingWsProd._id, {
          status: "active",
          planId: currentPlanKey,
        });
      } else {
        await ctx.db.insert("workspaceProducts", {
          workspaceId: workspace._id,
          productKey: args.applicationKey,
          status: "active",
          planId: currentPlanKey,
          activatedBy: args.userId || org.ownerId,
          activatedAt: now,
        });
      }
    }

    // 7. Record Audit Log: workspace.product_activated
    try {
      if (workspace) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: workspace._id,
          actorUserId: args.userId || org.ownerId,
          eventType: "workspace.product_activated",
          entityType: "application",
          entityId: app!._id,
          severity: "info",
          metadata: {
            organizationId: orgId,
            applicationKey: args.applicationKey,
            applicationId: app!._id,
            planKey: currentPlanKey,
          },
          createdAt: now,
        });
      }

      await ctx.db.insert("auditLogs", {
        actorUserId: (args.userId || org.ownerId) as any,
        organizationId: orgId,
        action: "workspace.product_activated",
        eventType: "workspace.product_activated",
        resource: "application",
        entityType: "application",
        entityId: app!._id,
        severity: "info",
        metadata: {
          applicationKey: args.applicationKey,
          appName: app!.name,
          organizationName: org.name,
          planKey: currentPlanKey,
        },
        timestamp: now,
        createdAt: now,
      });
    } catch {
      // Non-blocking audit failure
    }

    // 8. In-app notification
    try {
      const recipientId = args.userId || org.ownerId;
      if (recipientId) {
        await ctx.db.insert("notifications", {
          userId: recipientId,
          type: "app_activated",
          title: "Application Activated",
          body: `${app!.name} activated for ${org.name}`,
          status: "UNREAD",
          severity: "INFO",
          channel: "IN_APP",
          data: {
            organizationId: orgId,
            applicationKey: args.applicationKey,
          },
          createdAt: now,
        });
      }
    } catch {
      // Non-blocking notification failure
    }

    return {
      success: true,
      orgApplicationId,
      applicationId: app!._id,
      applicationKey: args.applicationKey,
      status: "active",
      planId: currentPlanKey,
    };
  },
});

/**
 * Query: Check if application is active for org
 */
export const isApplicationActiveForOrg = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return { isActive: false, status: "inactive", applicationKey: args.applicationKey };

    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", args.applicationKey))
      .first();

    if (!app) return { isActive: false, status: "not_found", applicationKey: args.applicationKey };

    const orgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app._id)
      )
      .first();

    const isActive =
      !!orgApp &&
      orgApp.enabled !== false &&
      (orgApp.status === "active" || orgApp.status === "trial" || orgApp.status === "trialing");

    return {
      isActive,
      status: orgApp?.status || "inactive",
      applicationKey: args.applicationKey,
      applicationId: app._id,
      planId: orgApp?.planId,
      trialEndsAt: orgApp?.trialEndsAt,
      activatedAt: orgApp?.activatedAt,
    };
  },
});

/**
 * Mutation: Deactivate an application for an organization (US-APP2)
 */
export const deactivateApplication = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    // 1. Validate user permissions if userId provided
    if (args.userId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", orgId).eq("userId", args.userId!)
        )
        .first();

      if (!membership || membership.status !== "ACTIVE") {
        throw new Error("ORGANIZATION_ACCESS_DENIED");
      }

      const allowedRoles = ["OWNER", "ADMIN", "MANAGER"];
      if (!allowedRoles.includes(membership.role)) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }
    }

    // 2. Resolve application record
    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", args.applicationKey))
      .first();

    if (!app) {
      throw new Error("APPLICATION_NOT_FOUND");
    }

    // 3. Find existing orgApplications record
    const orgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app._id)
      )
      .first();

    if (!orgApp) {
      throw new Error("APPLICATION_NOT_ACTIVATED");
    }

    const now = Date.now();

    // 4. Patch orgApplications to inactive
    await ctx.db.patch(orgApp._id, {
      enabled: false,
      status: "inactive",
      updatedAt: now,
    });

    // 5. Sync workspaceProducts if workspace exists
    if (workspace) {
      const existingWsProd = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace_product", (q: any) =>
          q.eq("workspaceId", workspace._id).eq("productKey", args.applicationKey)
        )
        .first();

      if (existingWsProd) {
        await ctx.db.patch(existingWsProd._id, {
          status: "inactive",
        });
      }
    }

    // 6. Audit logs
    try {
      if (workspace) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: workspace._id,
          actorUserId: args.userId || org.ownerId,
          eventType: "workspace.product_deactivated",
          entityType: "application",
          entityId: app._id,
          severity: "info",
          metadata: {
            organizationId: orgId,
            applicationKey: args.applicationKey,
            applicationId: app._id,
          },
          createdAt: now,
        });
      }

      await ctx.db.insert("auditLogs", {
        actorUserId: (args.userId || org.ownerId) as any,
        organizationId: orgId,
        action: "workspace.product_deactivated",
        eventType: "workspace.product_deactivated",
        resource: "application",
        entityType: "application",
        entityId: app._id,
        severity: "info",
        metadata: {
          applicationKey: args.applicationKey,
          appName: app.name,
          organizationName: org.name,
        },
        timestamp: now,
        createdAt: now,
      });
    } catch {}

    // 7. Notification
    try {
      const recipientId = args.userId || org.ownerId;
      if (recipientId) {
        await ctx.db.insert("notifications", {
          userId: recipientId,
          type: "app_deactivated",
          title: "Application Deactivated",
          body: `${app.name} was deactivated for ${org.name}`,
          status: "UNREAD",
          severity: "INFO",
          channel: "IN_APP",
          data: {
            organizationId: orgId,
            applicationKey: args.applicationKey,
          },
          createdAt: now,
        });
      }
    } catch {}

    return {
      success: true,
      orgApplicationId: orgApp._id,
      applicationId: app._id,
      applicationKey: args.applicationKey,
      status: "inactive",
    };
  },
});

