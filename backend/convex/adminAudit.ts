import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

// Helper to authenticate admin
async function verifyAdminSession(ctx: any, sessionToken?: string) {
  if (!sessionToken) throw new Error("Admin authentication required.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session.");
  }
  const admin = await ctx.db.get(session.adminId);
  if (!admin || !admin.isActive) {
    throw new Error("Unauthorized admin account.");
  }
  return { admin, session };
}

/**
 * getAdminAuditLogs
 * Paginated admin audit logs with filtering by action, resourceType, IP, and search
 */
export const getAdminAuditLogs = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    actionFilter: v.optional(v.string()),
    resourceTypeFilter: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    let logs = await ctx.db.query("adminAuditLogs").order("desc").collect();

    // 1. Action Filter
    if (args.actionFilter && args.actionFilter !== "all") {
      const q = args.actionFilter.toUpperCase();
      logs = logs.filter((l: any) => (l.action || "").toUpperCase().includes(q));
    }

    // 2. Resource Filter
    if (args.resourceTypeFilter && args.resourceTypeFilter !== "all") {
      const q = args.resourceTypeFilter.toLowerCase();
      logs = logs.filter((l: any) => (l.resourceType || "").toLowerCase() === q);
    }

    // 3. Search Filter
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      logs = logs.filter((l: any) => {
        const action = (l.action || "").toLowerCase();
        const resType = (l.resourceType || "").toLowerCase();
        const ip = (l.ipAddress || "").toLowerCase();
        const detailsStr = l.details ? JSON.stringify(l.details).toLowerCase() : "";
        return action.includes(q) || resType.includes(q) || ip.includes(q) || detailsStr.includes(q);
      });
    }

    const totalCount = logs.length;
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const paginated = logs.slice(offset, offset + pageSize);

    const items = [];
    for (const l of paginated) {
      let adminEmail = "System";
      if (l.adminId) {
        const adm = await ctx.db.get(l.adminId);
        if (adm) adminEmail = adm.email;
      }

      items.push({
        id: l._id,
        adminId: l.adminId,
        adminEmail,
        action: l.action,
        resourceType: l.resourceType || "platform",
        resourceId: l.resourceId,
        details: l.details,
        ipAddress: l.ipAddress || "system",
        userAgent: l.userAgent,
        createdAt: l.createdAt,
      });
    }

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  },
});

/**
 * getSecurityEvents
 * Returns security-critical events (rate-limiting, lockouts, failed logins, suspicious access)
 */
export const getSecurityEvents = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const allLogs = await ctx.db.query("adminAuditLogs").order("desc").collect();

    const securityKeywords = [
      "LOCKED",
      "SUSPENDED",
      "FAILED",
      "RATE_LIMITED",
      "REVOKED",
      "DELETED",
    ];

    const securityLogs = allLogs.filter((l: any) =>
      securityKeywords.some((kw) => (l.action || "").includes(kw))
    );

    return securityLogs.slice(0, 50).map((l: any) => ({
      id: l._id,
      action: l.action,
      resourceType: l.resourceType || "auth",
      details: l.details,
      ipAddress: l.ipAddress || "system",
      createdAt: l.createdAt,
    }));
  },
});

/**
 * exportAuditLogs
 * Generates audit export data
 */
export const exportAuditLogs = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const logs = await ctx.db.query("adminAuditLogs").order("desc").take(500);

    const rows = logs.map((l: any) => ({
      id: l._id,
      action: l.action,
      resourceType: l.resourceType || "platform",
      resourceId: l.resourceId || "",
      ipAddress: l.ipAddress || "system",
      details: l.details ? JSON.stringify(l.details) : "",
      timestamp: new Date(l.createdAt).toISOString(),
    }));

    await ctx.db.insert("adminAuditLogs", {
      adminId: admin._id,
      action: "AUDIT_LOGS_EXPORTED",
      resourceType: "adminAuditLogs",
      details: { exportCount: rows.length },
      createdAt: Date.now(),
    });

    return {
      rowCount: rows.length,
      data: rows,
      exportedAt: Date.now(),
    };
  },
});
