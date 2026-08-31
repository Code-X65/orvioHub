import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const AVAILABLE_MODULES = [
  "customers",
  "sales",
  "inventory",
  "finance",
  "hr",
  "projects",
] as const;

export type ModuleId = (typeof AVAILABLE_MODULES)[number];

export const getAvailableModules = query({
  args: {},
  handler: async () => {
    return AVAILABLE_MODULES.map((id) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      description: `${id.charAt(0).toUpperCase() + id.slice(1)} management module`,
    }));
  },
});

export const getOrganizationModules = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationModules")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
  },
});

export const selectModules = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    modules: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verify user membership and permission
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    // 2. Validate modules against whitelist
    const invalidModules = args.modules.filter(
      (mod: string) => !AVAILABLE_MODULES.includes(mod as ModuleId)
    );
    if (invalidModules.length > 0) {
      throw new Error("INVALID_MODULE");
    }

    // Check module dependencies (e.g., sales requires customers)
    if (args.modules.includes("sales") && !args.modules.includes("customers")) {
      const existingCustomers = await ctx.db
        .query("organizationModules")
        .withIndex("by_org_and_module", (q: any) =>
          q.eq("organizationId", args.organizationId).eq("moduleId", "customers")
        )
        .first();
      if (!existingCustomers || !existingCustomers.enabled) {
        throw new Error("INVALID_MODULE_DEPENDENCY");
      }
    }

    const now = Date.now();

    // 3. Upsert organization modules idempotently
    for (const mod of args.modules) {
      const existing = await ctx.db
        .query("organizationModules")
        .withIndex("by_org_and_module", (q: any) =>
          q.eq("organizationId", args.organizationId).eq("moduleId", mod)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("organizationModules", {
          organizationId: args.organizationId,
          moduleId: mod,
          enabled: true,
          enabledAt: now,
        });
      } else if (!existing.enabled) {
        await ctx.db.patch(existing._id, { enabled: true, enabledAt: now });
      }
    }

    // Update settings
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        enabledModules: args.modules,
        updatedAt: now,
      });
    }

    // Sync enabled modules to workspaces
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    for (const ws of workspaces) {
      await ctx.db.patch(ws._id, {
        enabledModules: args.modules,
        updatedAt: now,
      });
    }

    // Update onboarding progress
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (onboarding) {
      const completedSteps = Array.from(
        new Set([...onboarding.completedSteps, "MODULE_SELECTION", "MODULES_SELECTED"])
      );
      await ctx.db.patch(onboarding._id, {
        currentStep: "WORKSPACE_INITIALIZATION",
        completedSteps,
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: args.organizationId,
      action: "module.enabled",
      resource: `organization:${args.organizationId}`,
      metadata: { modules: args.modules },
      timestamp: now,
    });

    return {
      organizationId: args.organizationId,
      enabledModules: args.modules,
    };
  },
});

export const initializeWorkspace = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Verify user membership and permission
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (!settings) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    const now = Date.now();

    // Module-specific initializations
    const moduleDefaults: Record<string, unknown> = {};
    for (const mod of settings.enabledModules) {
      switch (mod) {
        case "customers":
          moduleDefaults.customers = { defaultPipeline: "Standard", initialStage: "Lead" };
          break;
        case "sales":
          moduleDefaults.sales = { currency: "USD", taxRate: 0 };
          break;
        case "inventory":
          moduleDefaults.inventory = { defaultWarehouse: "Main Warehouse" };
          break;
        case "finance":
          moduleDefaults.finance = { fiscalYearStartMonth: 1 };
          break;
        case "hr":
          moduleDefaults.hr = { defaultDepartment: "General" };
          break;
        case "projects":
          moduleDefaults.projects = { defaultStatus: "Planning" };
          break;
      }
    }

    await ctx.db.patch(settings._id, {
      workspaceReady: true,
      workspaceInitializedAt: now,
      defaults: moduleDefaults,
      updatedAt: now,
    });

    // Update onboarding progress
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (onboarding) {
      const completedSteps = Array.from(
        new Set([
          ...onboarding.completedSteps,
          "WORKSPACE_INITIALIZATION",
          "WORKSPACE_READY",
        ])
      );
      await ctx.db.patch(onboarding._id, {
        currentStep: "TEAM_INVITATION",
        completedSteps,
        updatedAt: now,
      });
    }

    return {
      status: "READY",
      initializedModules: settings.enabledModules,
    };
  },
});
