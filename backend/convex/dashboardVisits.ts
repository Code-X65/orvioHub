import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Helper to find existing visit record with fallback precedence:
 * 1. (userId, branchId, productKey) if branchId provided
 * 2. (userId, organizationId, productKey) if organizationId provided
 * 3. (userId, productKey)
 */
async function findVisitRecord(
  ctx: any,
  params: {
    userId: string;
    organizationId?: string;
    workspaceId?: string;
    branchId?: string;
    productKey: string;
  }
) {
  const { userId, organizationId, workspaceId, branchId, productKey } = params;

  if (branchId) {
    const byBranch = await ctx.db
      .query("userDashboardVisits")
      .withIndex("by_user_branch_product", (q: any) =>
        q.eq("userId", userId).eq("branchId", branchId).eq("productKey", productKey)
      )
      .first();
    if (byBranch) return byBranch;
  }

  const targetOrg = organizationId || workspaceId;
  if (targetOrg) {
    const byOrg = await ctx.db
      .query("userDashboardVisits")
      .withIndex("by_user_org_product", (q: any) =>
        q.eq("userId", userId).eq("organizationId", targetOrg).eq("productKey", productKey)
      )
      .first();
    if (byOrg) return byOrg;
  }

  return await ctx.db
    .query("userDashboardVisits")
    .withIndex("by_user_product", (q: any) =>
      q.eq("userId", userId).eq("productKey", productKey)
    )
    .first();
}

/**
 * Query visit status without mutating or marking anything as read.
 */
export const getDashboardVisitStatus = query({
  args: {
    userId: v.string(),
    organizationId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    branchId: v.optional(v.string()),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await findVisitRecord(ctx, args);

    if (!record) {
      return {
        isFirstVisit: true,
        visitCount: 0,
        firstVisitedAt: null,
      };
    }

    return {
      isFirstVisit: record.visitCount <= 1,
      visitCount: record.visitCount,
      firstVisitedAt: record.firstVisitedAt,
    };
  },
});

/**
 * Records a visit event. Atomically increments visitCount.
 */
export const recordDashboardVisit = mutation({
  args: {
    userId: v.string(),
    organizationId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    branchId: v.optional(v.string()),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await findVisitRecord(ctx, args);

    if (existing) {
      const isFirst = existing.visitCount === 0;
      await ctx.db.patch(existing._id, {
        visitCount: existing.visitCount + 1,
        lastVisitedAt: now,
        // If branch or org wasn't set on initial record, augment it
        ...(args.branchId && !existing.branchId ? { branchId: args.branchId } : {}),
        ...(args.organizationId && !existing.organizationId ? { organizationId: args.organizationId } : {}),
      });

      return {
        isFirstVisit: isFirst,
        visitCount: existing.visitCount + 1,
        firstVisitedAt: existing.firstVisitedAt,
      };
    }

    await ctx.db.insert("userDashboardVisits", {
      userId: args.userId,
      organizationId: args.organizationId || args.workspaceId,
      workspaceId: args.workspaceId || args.organizationId,
      branchId: args.branchId,
      productKey: args.productKey,
      visitCount: 1,
      firstVisitedAt: now,
      lastVisitedAt: now,
    });

    return {
      isFirstVisit: true,
      visitCount: 1,
      firstVisitedAt: now,
    };
  },
});

