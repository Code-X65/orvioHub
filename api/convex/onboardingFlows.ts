import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const getOnboardingFlow = query({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user_workspace_product", (q) =>
        q
          .eq("userId", args.userId)
          .eq("workspaceId", args.workspaceId)
          .eq("productKey", args.productKey)
      )
      .first();
  },
});

export const startOnboardingFlow = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
    initialStep: v.string(),
    flowVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user_workspace_product", (q) =>
        q
          .eq("userId", args.userId)
          .eq("workspaceId", args.workspaceId)
          .eq("productKey", args.productKey)
      )
      .first();

    if (existing) {
      return existing;
    }

    const flowId = await ctx.db.insert("onboardingFlows", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      flowVersion: args.flowVersion || "1.0",
      status: "IN_PROGRESS",
      currentStep: args.initialStep,
      completedSteps: [],
      skippedSteps: [],
      stepData: {},
      startedAt: now,
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      step: args.initialStep,
      eventType: "FLOW_STARTED",
      createdAt: now,
    });

    return await ctx.db.get(flowId);
  },
});

export const updateStepProgress = mutation({
  args: {
    flowId: v.id("onboardingFlows"),
    currentStep: v.string(),
    stepData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.flowId);
    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

    const mergedData = {
      ...(flow.stepData || {}),
      ...(args.stepData || {}),
    };

    await ctx.db.patch(args.flowId, {
      currentStep: args.currentStep,
      stepData: mergedData,
      lastUpdatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const completeStep = mutation({
  args: {
    flowId: v.id("onboardingFlows"),
    completedStepKey: v.string(),
    nextStepKey: v.string(),
    stepData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.flowId);
    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

    const completed = new Set(flow.completedSteps || []);
    completed.add(args.completedStepKey);

    const mergedData = {
      ...(flow.stepData || {}),
      ...(args.stepData || {}),
    };

    const now = Date.now();
    await ctx.db.patch(args.flowId, {
      currentStep: args.nextStepKey,
      completedSteps: Array.from(completed),
      stepData: mergedData,
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      step: args.completedStepKey,
      eventType: "STEP_COMPLETED",
      createdAt: now,
    });

    return { success: true, nextStep: args.nextStepKey };
  },
});

export const skipStep = mutation({
  args: {
    flowId: v.id("onboardingFlows"),
    skippedStepKey: v.string(),
    nextStepKey: v.string(),
  },
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.flowId);
    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

    const skipped = new Set(flow.skippedSteps || []);
    skipped.add(args.skippedStepKey);

    const now = Date.now();
    await ctx.db.patch(args.flowId, {
      currentStep: args.nextStepKey,
      skippedSteps: Array.from(skipped),
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      step: args.skippedStepKey,
      eventType: "STEP_SKIPPED",
      createdAt: now,
    });

    return { success: true, nextStep: args.nextStepKey };
  },
});

export const completeFlow = mutation({
  args: {
    flowId: v.id("onboardingFlows"),
    finalData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.flowId);
    if (!flow) throw new Error("ONBOARDING_FLOW_NOT_FOUND");

    const now = Date.now();
    const mergedData = {
      ...(flow.stepData || {}),
      ...(args.finalData || {}),
    };

    await ctx.db.patch(args.flowId, {
      status: "COMPLETED",
      currentStep: "COMPLETED",
      stepData: mergedData,
      completedAt: now,
      lastUpdatedAt: now,
    });

    await ctx.db.insert("onboardingEvents", {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      step: "COMPLETED",
      eventType: "FLOW_COMPLETED",
      createdAt: now,
    });

    return { success: true };
  },
});
