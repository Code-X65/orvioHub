import { internalMutation } from "../_generated/server.js";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const createInitialAdmin = internalMutation({
  args: {
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.email || "admin@orviohub.com").trim().toLowerCase();
    const password = args.password || "OrvioAdmin2026!Secure";
    const name = args.name || "Super Admin";

    // Check if admin already exists
    const existing = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();

    if (existing) {
      return {
        message: `Admin ${email} already exists.`,
        adminId: existing._id,
      };
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const now = Date.now();

    const adminId = await ctx.db.insert("platformAdmins", {
      email,
      passwordHash,
      name,
      role: "super_admin",
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("adminAuditLogs", {
      adminId,
      action: "INITIAL_SUPER_ADMIN_INITIALIZED",
      resourceType: "platformAdmins",
      resourceId: adminId,
      details: { email, role: "super_admin", name },
      createdAt: now,
    });

    return {
      message: "Initial super admin created successfully.",
      adminId,
      email,
    };
  },
});
