import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getByProduct = query({
  args: { productKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productNotifyList")
      .withIndex("by_product", (q) => q.eq("productKey", args.productKey))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: {
    productKey: v.string(),
    email: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const emailNormalized = args.email.toLowerCase().trim();

    // Check if already in waitlist for this product
    const existing = await ctx.db
      .query("productNotifyList")
      .withIndex("by_email", (q) => q.eq("emailNormalized", emailNormalized))
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (existing) {
      return { alreadySubscribed: true };
    }

    const id = await ctx.db.insert("productNotifyList", {
      productKey: args.productKey,
      email: args.email.trim(),
      emailNormalized,
      userId: args.userId,
      notified: false,
      createdAt: Date.now(),
    });

    return { alreadySubscribed: false, id };
  },
});

export const notifyAllOnLaunch = mutation({
  args: { productKey: v.string() },
  handler: async (ctx, args) => {
    const notifyList = await ctx.db
      .query("productNotifyList")
      .withIndex("by_product_notified", (q) =>
        q.eq("productKey", args.productKey).eq("notified", false)
      )
      .collect();

    // Mark all as notified
    for (const item of notifyList) {
      await ctx.db.patch(item._id, { notified: true });
    }

    return {
      notifiedCount: notifyList.length,
      emails: notifyList.map((i) => i.email),
    };
  },
});
