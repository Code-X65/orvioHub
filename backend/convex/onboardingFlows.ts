import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const getOnboardingFlow = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.string())),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const uId = ctx.db.normalizeId("users", args.userId);
    const wsId = args.workspaceId ? (ctx.db.normalizeId("workspaces", args.workspaceId) ?? undefined) : undefined;

    if (wsId && args.productKey && uId) {
      const match = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_workspace_product", (q) =>
          q.eq("workspaceId", wsId).eq("productKey", args.productKey!)
        )
        .filter((q) => q.eq(q.field("userId"), uId))
        .first();
      if (match) return match;
    }

    if (uId) {
      return await ctx.db
        .query("onboardingFlows")
        .withIndex("by_user", (q) => q.eq("userId", uId))
        .order("desc")
        .first();
    }

    return null;
  },
});

export const startOnboardingFlow = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.string())),
    productKey: v.optional(v.string()),
    initialStep: v.optional(v.string()),
    flowVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const uId = ctx.db.normalizeId("users", args.userId);
    const wsId = args.workspaceId ? (ctx.db.normalizeId("workspaces", args.workspaceId) ?? undefined) : undefined;
    if (!uId) throw new Error("USER_NOT_FOUND");

    const now = Date.now();
    const existing = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user", (q) => q.eq("userId", uId))
      .order("desc")
      .first();

    if (existing && existing.status !== "completed" && existing.status !== "COMPLETED") {
      return existing;
    }

    const initialStep = args.initialStep || "account_creation";
    const flowId = await ctx.db.insert("onboardingFlows", {
      userId: uId,
      workspaceId: wsId || undefined,
      productKey: args.productKey || "global",
      flowVersion: args.flowVersion || "1.0",
      status: "in_progress",
      currentStep: initialStep,
      completedSteps: [],
      skippedSteps: [],
      stepData: {},
      startedAt: now,
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: uId,
      workspaceId: wsId || undefined,
      productKey: args.productKey || "global",
      step: initialStep,
      eventType: "step_started",
      createdAt: now,
    });

    return await ctx.db.get(flowId);
  },
});

export const updateStepProgress = mutation({
  args: {
    userId: v.optional(v.union(v.id("users"), v.id("onboardingFlows"), v.string())),
    flowId: v.optional(v.union(v.id("onboardingFlows"), v.string())),
    currentStep: v.string(),
    stepData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let flow = null;
    if (args.flowId) {
      const fId = ctx.db.normalizeId("onboardingFlows", args.flowId);
      if (fId) flow = await ctx.db.get(fId);
    }
    if (!flow && args.userId) {
      // Check if userId is actually a flow ID
      const directFlowId = ctx.db.normalizeId("onboardingFlows", args.userId);
      if (directFlowId) {
        flow = await ctx.db.get(directFlowId);
      }
      if (!flow) {
        const uId = ctx.db.normalizeId("users", args.userId);
        if (uId) {
          flow = await ctx.db
            .query("onboardingFlows")
            .withIndex("by_user", (q) => q.eq("userId", uId))
            .order("desc")
            .first();
        }
      }
    }

    if (!flow) {
      const uId = args.userId ? ctx.db.normalizeId("users", args.userId) : null;
      if (uId) {
        const flowId = await ctx.db.insert("onboardingFlows", {
          userId: uId,
          flowVersion: "1.0",
          status: "in_progress",
          currentStep: args.currentStep,
          completedSteps: [],
          skippedSteps: [],
          stepData: args.stepData || {},
          startedAt: Date.now(),
          lastUpdatedAt: Date.now(),
        });
        return { success: true, flowId };
      }
      throw new Error("ONBOARDING_FLOW_NOT_FOUND");
    }

    const mergedData = {
      ...(flow.stepData || {}),
      ...(args.stepData || {}),
    };

    await ctx.db.patch(flow._id, {
      currentStep: args.currentStep,
      stepData: mergedData,
      lastUpdatedAt: Date.now(),
    });

    return { success: true, flowId: flow._id };
  },
});

export const completeStep = mutation({
  args: {
    userId: v.optional(v.union(v.id("users"), v.id("onboardingFlows"), v.string())),
    flowId: v.optional(v.union(v.id("onboardingFlows"), v.string())),
    completedStepKey: v.string(),
    nextStepKey: v.optional(v.string()),
    stepData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let flow = null;
    if (args.flowId) {
      const fId = ctx.db.normalizeId("onboardingFlows", args.flowId);
      if (fId) flow = await ctx.db.get(fId);
    }
    if (!flow && args.userId) {
      // Check if userId is actually a flow ID
      const directFlowId = ctx.db.normalizeId("onboardingFlows", args.userId);
      if (directFlowId) {
        flow = await ctx.db.get(directFlowId);
      }
      if (!flow) {
        const uId = ctx.db.normalizeId("users", args.userId);
        if (uId) {
          flow = await ctx.db
            .query("onboardingFlows")
            .withIndex("by_user", (q) => q.eq("userId", uId))
            .order("desc")
            .first();
        }
      }
    }

    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

    const completed = new Set(flow.completedSteps || []);
    completed.add(args.completedStepKey);

    const mergedData = {
      ...(flow.stepData || {}),
      ...(args.stepData || {}),
    };

    const nextStep = args.nextStepKey || args.completedStepKey;
    const now = Date.now();
    await ctx.db.patch(flow._id, {
      currentStep: nextStep,
      completedSteps: Array.from(completed),
      stepData: mergedData,
      lastUpdatedAt: now,
    });

    if (flow.userId) {
      await ctx.db.insert("onboardingEvents", {
        userId: flow.userId,
        workspaceId: flow.workspaceId,
        productKey: flow.productKey,
        step: args.completedStepKey,
        eventType: "step_completed",
        createdAt: now,
      });
    }

    return { success: true, nextStep };
  },
});

export const skipStep = mutation({
  args: {
    userId: v.optional(v.id("users")),
    flowId: v.optional(v.id("onboardingFlows")),
    skippedStepKey: v.string(),
    nextStepKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let flow = null;
    if (args.flowId) {
      flow = await ctx.db.get(args.flowId);
    } else if (args.userId) {
      flow = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .first();
    }

    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

    const skipped = new Set(flow.skippedSteps || []);
    skipped.add(args.skippedStepKey);

    const nextStep = args.nextStepKey || args.skippedStepKey;
    const now = Date.now();
    await ctx.db.patch(flow._id, {
      currentStep: nextStep,
      skippedSteps: Array.from(skipped),
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      step: args.skippedStepKey,
      eventType: "step_skipped",
      createdAt: now,
    });

    return { success: true, nextStep };
  },
});

export const completeFlow = mutation({
  args: {
    userId: v.optional(v.id("users")),
    flowId: v.optional(v.id("onboardingFlows")),
    finalData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let flow = null;
    if (args.flowId) {
      flow = await ctx.db.get(args.flowId);
    } else if (args.userId) {
      flow = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .first();
    }

    if (!flow) {
      // No product-level onboarding flow exists yet — this is valid when the user
      // completes org creation before any workspace product flow has been started.
      return { success: true, skipped: true };
    }

    const now = Date.now();
    const mergedData = {
      ...(flow.stepData || {}),
      ...(args.finalData || {}),
    };

    await ctx.db.patch(flow._id, {
      status: "completed",
      currentStep: "completed",
      stepData: mergedData,
      completedAt: now,
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      step: "completed",
      eventType: "flow_completed",
      createdAt: now,
    });

    return { success: true };
  },
});

export const resetFlow = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const flows = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const flow of flows) {
      await ctx.db.delete(flow._id);
    }

    return { success: true };
  },
});

