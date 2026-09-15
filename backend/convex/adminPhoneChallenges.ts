import { query } from "./_generated/server.js";
import { v } from "convex/values";

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

// Helper to mask phone for safe admin listing
function maskPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.length <= 4) return "•••";
  const start = cleaned.slice(0, 4);
  const end = cleaned.slice(-4);
  return `${start} •••• ${end}`;
}

/**
 * getPhoneChallenges
 * Admin query for phone verification challenges and deliverability stats
 */
export const getPhoneChallenges = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
    purposeFilter: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    let challenges = await ctx.db
      .query("phoneVerificationChallenges")
      .order("desc")
      .collect();

    // 1. Status Filter
    if (args.statusFilter && args.statusFilter !== "all") {
      challenges = challenges.filter((c: any) => c.status === args.statusFilter);
    }

    // 2. Purpose Filter
    if (args.purposeFilter && args.purposeFilter !== "all") {
      challenges = challenges.filter((c: any) => c.purpose === args.purposeFilter);
    }

    // 3. Search (phone normalized or raw)
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      challenges = challenges.filter(
        (c: any) =>
          (c.phoneNormalized || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.purpose || "").toLowerCase().includes(q)
      );
    }

    const total = challenges.length;
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize || 20));
    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize;
    const paginated = challenges.slice(startIdx, startIdx + pageSize);

    // Compute metrics
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recent = challenges.filter((c: any) => c.createdAt >= last24h);
    const totalRecent = recent.length;
    const verifiedRecent = recent.filter((c: any) => c.status === "verified").length;
    const expiredRecent = recent.filter((c: any) => c.status === "expired").length;
    const pendingRecent = recent.filter((c: any) => c.status === "pending" && c.expiresAt > now).length;

    const stats = {
      totalChallenges24h: totalRecent,
      verifiedCount24h: verifiedRecent,
      expiredCount24h: expiredRecent,
      activePendingCount: pendingRecent,
      successRatePercent: totalRecent > 0 ? Math.round((verifiedRecent / totalRecent) * 100) : 100,
    };

    return {
      challenges: paginated.map((c: any) => ({
        id: c._id,
        maskedPhone: maskPhone(c.phoneNormalized || c.phone),
        phoneNormalized: c.phoneNormalized,
        purpose: c.purpose,
        status: c.status,
        attempts: c.attempts,
        maxAttempts: c.maxAttempts,
        resendCount: c.resendCount || 0,
        expiresAt: c.expiresAt,
        isExpired: c.expiresAt < now,
        verifiedAt: c.verifiedAt || null,
        createdAt: c.createdAt,
        userId: c.userId || null,
        workspaceId: c.workspaceId || null,
        branchId: c.branchId || null,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
      stats,
    };
  },
});
