import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const getOnboardingFlow = query({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.workspaceId && args.productKey) {
      const match = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_workspace_product", (q) =>
          q.eq("workspaceId", args.workspaceId!).eq("productKey", args.productKey!)
        )
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .first();
      if (match) return match;
    }

    return await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

export const startOnboardingFlow = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
    initialStep: v.optional(v.string()),
    flowVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    if (existing && existing.status !== "completed" && existing.status !== "COMPLETED") {
      return existing;
    }

    const initialStep = args.initialStep || "account_creation";
    const flowId = await ctx.db.insert("onboardingFlows", {
      userId: args.userId,
      workspaceId: args.workspaceId,
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
      userId: args.userId,
      workspaceId: args.workspaceId,
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
    userId: v.optional(v.id("users")),
    flowId: v.optional(v.id("onboardingFlows")),
    currentStep: v.string(),
    stepData: v.optional(v.any()),
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
      if (args.userId) {
        const flowId = await ctx.db.insert("onboardingFlows", {
          userId: args.userId,
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
    userId: v.optional(v.id("users")),
    flowId: v.optional(v.id("onboardingFlows")),
    completedStepKey: v.string(),
    nextStepKey: v.optional(v.string()),
    stepData: v.optional(v.any()),
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

    await ctx.db.insert("onboardingEvents", {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      step: args.completedStepKey,
      eventType: "step_completed",
      createdAt: now,
    });

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

    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

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

