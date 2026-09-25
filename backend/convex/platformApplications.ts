import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminPermission } from "./adminAuth.js";

export const DEFAULT_PLATFORM_APPS = [
  {
    key: "inventory",
    name: "Inventory",
    status: "active" as const,
    isCore: true,
    planRequirements: ["free_trial", "free", "standard", "premium", "enterprise"],
    subdomain: "inventory",
    description: "Full inventory management: stock tracking, purchases, sales POS, and reports.",
    badge: "Flagship",
    displayOrder: 1,
  },
  {
    key: "pos",
    name: "POS Terminal",
    status: "coming_soon" as const,
    isCore: false,
    planRequirements: ["standard", "premium", "enterprise"],
    subdomain: "pos",
    description: "Point-of-sale terminal with receipts, cash management, and shift reports.",
    displayOrder: 2,
  },
  {
    key: "booking",
    name: "Booking & Appointments",
    status: "coming_soon" as const,
    isCore: false,
    planRequirements: ["standard", "premium", "enterprise"],
    subdomain: "booking",
    description: "Appointment and reservation management with automated reminders.",
    badge: "Coming Soon",
    displayOrder: 3,
  },
  {
    key: "gym",
    name: "Gym Management",
    status: "coming_soon" as const,
    isCore: false,
    planRequirements: ["standard", "premium", "enterprise"],
    subdomain: "gym",
    description: "Membership management, class scheduling, and trainer assignment.",
    badge: "Coming Soon",
    displayOrder: 4,
  },
  {
    key: "taskmanagement",
    name: "Task Management",
    status: "coming_soon" as const,
    isCore: false,
    planRequirements: ["standard", "premium", "enterprise"],
    subdomain: "taskmanagement",
    description: "Team task tracking, assignments, and workflow boards.",
    badge: "Coming Soon",
    displayOrder: 5,
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Catalog entries are configuration, not an unbounded feed. Cap reads so a
    // malformed import cannot turn the public launcher endpoint into a scan.
    const apps = await ctx.db.query("platform_applications").take(100);
    if (apps.length > 0) {
      return apps.sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
    }
    // Return default apps if not seeded yet
    const now = Date.now();
    return DEFAULT_PLATFORM_APPS.map((a) => ({
      _id: `default_${a.key}` as any,
      ...a,
      createdAt: now,
      updatedAt: now,
    }));
  },
});

export const seedDefaults = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.sessionToken, "admin.applications.manage");
    const existing = await ctx.db.query("platform_applications").collect();
    const existingKeys = new Set(existing.map((e) => e.key.toLowerCase()));
    const now = Date.now();

    for (const def of DEFAULT_PLATFORM_APPS) {
      if (!existingKeys.has(def.key.toLowerCase())) {
        await ctx.db.insert("platform_applications", {
          ...def,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return true;
  },
});

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const normalizedKey = args.key.toLowerCase().trim();
    const app = await ctx.db
      .query("platform_applications")
      .withIndex("by_key", (q) => q.eq("key", normalizedKey))
      .first();

    if (app) return app;

    // Fallback to default apps if table not yet seeded
    const def = DEFAULT_PLATFORM_APPS.find((d) => d.key.toLowerCase() === normalizedKey);
    if (def) {
      const now = Date.now();
      return {
        _id: `default_${def.key}` as any,
        ...def,
        createdAt: now,
        updatedAt: now,
      };
    }

    return null;
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    key: v.string(),
    name: v.string(),
    status: v.union(
      v.literal("coming_soon"),
      v.literal("active"),
      v.literal("maintenance"),
      v.literal("deprecated")
    ),
    isCore: v.boolean(),
    planRequirements: v.array(v.string()),
    subdomain: v.string(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    badge: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.sessionToken, "admin.applications.manage");
    const key = args.key.toLowerCase().trim();
    const existing = await ctx.db
      .query("platform_applications")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      throw new Error(`Platform application with key "${key}" already exists.`);
    }

    const now = Date.now();
    const id = await ctx.db.insert("platform_applications", {
      key,
      name: args.name,
      status: args.status,
      isCore: args.isCore,
      planRequirements: args.planRequirements,
      subdomain: args.subdomain,
      icon: args.icon,
      description: args.description,
      badge: args.badge,
      displayOrder: args.displayOrder ?? 10,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    key: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal("coming_soon"),
          v.literal("active"),
          v.literal("maintenance"),
          v.literal("deprecated")
        )
      ),
      isCore: v.optional(v.boolean()),
      planRequirements: v.optional(v.array(v.string())),
      subdomain: v.optional(v.string()),
      icon: v.optional(v.string()),
      description: v.optional(v.string()),
      badge: v.optional(v.string()),
      displayOrder: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.sessionToken, "admin.applications.manage");
    const key = args.key.toLowerCase().trim();
    let app = await ctx.db
      .query("platform_applications")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    const now = Date.now();
    if (!app) {
      // If it exists in defaults, seed it first
      const def = DEFAULT_PLATFORM_APPS.find((d) => d.key.toLowerCase() === key);
      if (def) {
        const id = await ctx.db.insert("platform_applications", {
          ...def,
          ...args.updates,
          createdAt: now,
          updatedAt: now,
        });
        return id;
      }
      throw new Error(`Platform application with key "${key}" not found.`);
    }

    await ctx.db.patch(app._id, {
      ...args.updates,
      updatedAt: now,
    });

    return app._id;
  },
});

export const remove = mutation({
  args: { sessionToken: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.sessionToken, "admin.applications.manage");
    const key = args.key.toLowerCase().trim();
    const app = await ctx.db
      .query("platform_applications")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!app) {
      throw new Error(`Platform application with key "${key}" not found.`);
    }

    if (app.isCore) {
      throw new Error(`Cannot delete core platform application "${app.name}".`);
    }

    await ctx.db.delete(app._id);
    return true;
  },
});
