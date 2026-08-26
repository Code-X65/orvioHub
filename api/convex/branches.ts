import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const createBranch = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const branchId = await ctx.db.insert("branches", {
      workspaceId: args.workspaceId,
      name: args.name,
      code: args.code,
      address: args.address,
      phone: args.phone,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return branchId;
  },
});

export const getBranches = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const getBranchById = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.branchId);
  },
});

export const updateBranch = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("BRANCH_NOT_FOUND");

    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.code !== undefined) patch.code = args.code;
    if (args.address !== undefined) patch.address = args.address;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.branchId, patch);
    return { success: true };
  },
});
