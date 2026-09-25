import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const INACTIVITY_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_ATTEMPTS_PER_IP = 5;
const MAX_FAILED_ATTEMPTS_PER_ACCOUNT = 10;
const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Canonical permission identifiers used by both the Fastify administration API
 * and the Convex administration portal. Keep roles intentionally narrow; only
 * platform owners receive the wildcard grant.
 */
export type AdminPermission = string;

const ADMIN_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  platform_owner: ["*"],
  superadmin: ["*"],
  super_admin: ["*"],
  platform_admin: [
    "admin.dashboard.view",
    "admin.organizations.view",
    "admin.applications.manage",
    "admin.organizations.suspend",
    "admin.organizations.restore",
    "admin.organizations.archive",
    "admin.users.view",
    "admin.users.update",
    "admin.users.suspend",
    "admin.users.restore",
    "admin.users.delete",
    "admin.users.search",
    "admin.users.view_onboarding",
    "admin.users.view_security_summary",
    "admin.users.view_memberships",
    "admin.users.view_billing",
    "admin.users.view_audit_logs",
    "admin.users.manage_notes",
    "admin.members.view",
    "admin.members.manage_access",
    "admin.applications.view",
    "admin.branches.view",
    "admin.onboarding.manage",
    "admin.onboarding.view",
    "admin.trial_extensions.create",
    "admin.manual_plan_grants.create",
    "admin.branches.manage",
    "admin.billing.view",
    "admin.billing.reconcile",
    "admin.billing.manage",
    "admin.entitlements.view",
    "admin.entitlements.recalculate",
    "admin.entitlements.override",
    "admin.overrides.view",
    "admin.overrides.create",
    "admin.overrides.update",
    "admin.overrides.revoke",
    "admin.overrides.approve",
    "admin.billing_corrections.create",
    "admin.entitlement_overrides.create",
    "admin.entitlement_reconciliation.run",
    "admin.override_history.view",
    "admin.audit.view",
    "admin.support_notes.view",
    "admin.support_notes.create",
    "admin.exports.request",
    "admin.analytics.view",
    "admin.revenue.view",
    "admin.analytics.export",
    "admin.analytics.rebuild",
  ],
  support_admin: [
    "admin.dashboard.view", "admin.organizations.view", "admin.users.view",
    "admin.members.view", "admin.applications.view", "admin.branches.view",
    "admin.onboarding.view", "admin.onboarding.manage", "admin.entitlements.view",
    "admin.overrides.view", "admin.override_history.view", "admin.trial_extensions.create",
    "admin.support_notes.view", "admin.support_notes.create", "admin.audit.view",
    "admin.analytics.view", "admin.users.search", "admin.users.view_onboarding",
    "admin.users.view_security_summary", "admin.users.view_memberships",
    "admin.users.view_billing", "admin.users.view_audit_logs", "admin.users.manage_notes",
  ],
  billing_admin: [
    "admin.dashboard.view", "admin.organizations.view", "admin.billing.view",
    "admin.billing.reconcile", "admin.billing.manage", "admin.entitlements.view",
    "admin.entitlements.recalculate", "admin.entitlements.override", "admin.overrides.view",
    "admin.overrides.create", "admin.overrides.update", "admin.overrides.revoke",
    "admin.overrides.approve", "admin.trial_extensions.create", "admin.manual_plan_grants.create",
    "admin.billing_corrections.create", "admin.entitlement_overrides.create",
    "admin.entitlement_reconciliation.run", "admin.override_history.view",
    "admin.support_notes.view", "admin.support_notes.create", "admin.audit.view",
    "admin.analytics.view", "admin.revenue.view", "admin.analytics.export",
    "admin.analytics.rebuild",
  ],
  read_only_admin: [
    "admin.dashboard.view", "admin.organizations.view", "admin.users.view",
    "admin.members.view", "admin.applications.view", "admin.branches.view",
    "admin.billing.view", "admin.entitlements.view", "admin.overrides.view",
    "admin.override_history.view", "admin.onboarding.view", "admin.audit.view",
    "admin.support_notes.view", "admin.analytics.view", "admin.revenue.view",
    "admin.users.search", "admin.users.view_onboarding", "admin.users.view_security_summary",
    "admin.users.view_memberships", "admin.users.view_billing", "admin.users.view_audit_logs",
  ],
};

/** Returns whether an active admin role is allowed to perform a named action. */
export function hasAdminPermission(role: string | undefined, permission: AdminPermission): boolean {
  const granted = ADMIN_ROLE_PERMISSIONS[String(role || "").toLowerCase()] || [];
  return granted.includes("*") || granted.includes(permission);
}

/** Canonical server-side authorization gate for Convex administration writes. */
export async function requireAdminPermission(
  ctx: any,
  sessionToken: string | undefined,
  permission: AdminPermission
) {
  if (!sessionToken) throw new Error("Admin authentication required.");

  const now = Date.now();
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || session.expiresAt < now) throw new Error("Invalid or expired admin session.");
  if (session.lastActiveAt && now - session.lastActiveAt > INACTIVITY_TIMEOUT_MS) {
    throw new Error("Admin session has expired due to inactivity.");
  }

  const admin = await ctx.db.get(session.adminId);
  if (!admin || !admin.isActive) throw new Error("Unauthorized admin account.");

  if (!hasAdminPermission(admin.role, permission)) {
    throw new Error(`ADMIN_PERMISSION_DENIED: ${permission}`);
  }

  return { admin, session };
}

// Password validation helper
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { isValid: false, error: "Password must be at least 12 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one special character." };
  }
  return { isValid: true };
}

// Generate secure 64-character hex token using standard Web Crypto
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Helper to log audit events
async function logAudit(
  ctx: any,
  params: {
    adminId?: any;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  await ctx.db.insert("adminAuditLogs", {
    adminId: params.adminId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    details: params.details,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: Date.now(),
  });
}

/**
 * createAdmin
 * Mutation to create a platform admin account.
 */
export const createAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.optional(v.string()),
    creatorToken: v.optional(v.string()),
    isDevBootstrap: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Invalid email address format.");
    }

    // Validate password strength
    const passwordCheck = validatePassword(args.password);
    if (!passwordCheck.isValid) {
      throw new Error(passwordCheck.error);
    }

    // Check if any admin already exists
    const existingAdmins = await ctx.db.query("platformAdmins").collect();
    let creatorAdmin = null;

    if (existingAdmins.length > 0 && !args.isDevBootstrap) {
      // If admins already exist, ensure the creator provides a valid super_admin session token
      if (!args.creatorToken) {
        throw new Error("Authentication required to create additional admins.");
      }
      const session = await ctx.db
        .query("adminSessions")
        .withIndex("by_token", (q: any) => q.eq("sessionToken", args.creatorToken))
        .first();

      if (!session || session.expiresAt < Date.now()) {
        throw new Error("Invalid or expired creator session.");
      }

      creatorAdmin = await ctx.db.get(session.adminId);
      if (!creatorAdmin || !creatorAdmin.isActive || creatorAdmin.role !== "super_admin") {
        throw new Error("Super admin privileges required to create admins.");
      }
    }

    // Check for duplicate email
    const duplicate = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
      .first();

    if (duplicate) {
      throw new Error("An admin with this email already exists.");
    }

    const now = Date.now();
    const passwordHash = bcrypt.hashSync(args.password, 12);
    const role = args.role || "super_admin";

    const adminId = await ctx.db.insert("platformAdmins", {
      email: normalizedEmail,
      passwordHash,
      name: args.name.trim(),
      role: role as any,
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      adminId: creatorAdmin ? creatorAdmin._id : adminId,
      action: "ADMIN_CREATED",
      resourceType: "platformAdmins",
      resourceId: adminId,
      details: { email: normalizedEmail, role, name: args.name },
    });

    return {
      adminId,
      email: normalizedEmail,
      name: args.name,
      role,
    };
  },
});

/**
 * login
 * Authenticates admin credentials, enforces rate limits and lockout, and generates a session.
 */
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedEmail = args.email.trim().toLowerCase();
    const clientIp = args.ipAddress || "0.0.0.0";

    // 1. IP Rate Limiting: 5 attempts per minute
    const oneMinuteAgo = now - RATE_LIMIT_WINDOW_MS;
    const recentIpAttempts = await ctx.db
      .query("adminLoginAttempts")
      .withIndex("by_ip", (q: any) => q.eq("ipAddress", clientIp))
      .filter((q: any) => q.gte(q.field("createdAt"), oneMinuteAgo))
      .collect();

    if (recentIpAttempts.length >= MAX_LOGIN_ATTEMPTS_PER_IP) {
      await logAudit(ctx, {
        action: "LOGIN_RATE_LIMITED",
        details: { ipAddress: clientIp, email: normalizedEmail },
        ipAddress: clientIp,
        userAgent: args.userAgent,
      });
      throw new Error("Too many login attempts from this IP address. Please wait a minute.");
    }

    // Record login attempt for IP
    await ctx.db.insert("adminLoginAttempts", {
      ipAddress: clientIp,
      createdAt: now,
    });

    // 2. Find admin by email
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
      .first();

    if (!admin) {
      await logAudit(ctx, {
        action: "LOGIN_FAILED_UNKNOWN_EMAIL",
        details: { email: normalizedEmail },
        ipAddress: clientIp,
        userAgent: args.userAgent,
      });
      throw new Error("Invalid email or password.");
    }

    // 3. Check Account Lockout
    if (admin.lockedUntil && admin.lockedUntil > now) {
      const minutesRemaining = Math.ceil((admin.lockedUntil - now) / (60 * 1000));
      await logAudit(ctx, {
        adminId: admin._id,
        action: "LOGIN_ATTEMPT_LOCKED_ACCOUNT",
        details: { minutesRemaining },
        ipAddress: clientIp,
        userAgent: args.userAgent,
      });
      throw new Error(
        `Account is temporarily locked due to excessive failed attempts. Please retry in ${minutesRemaining} minute(s).`
      );
    }

    // 4. Check if account is active
    if (!admin.isActive) {
      await logAudit(ctx, {
        adminId: admin._id,
        action: "LOGIN_FAILED_ACCOUNT_SUSPENDED",
        ipAddress: clientIp,
        userAgent: args.userAgent,
      });
      throw new Error("This admin account has been deactivated. Please contact support.");
    }

    // 5. Verify password
    const isPasswordValid = bcrypt.compareSync(args.password, admin.passwordHash);
    if (!isPasswordValid) {
      const failedAttempts = (admin.failedLoginAttempts || 0) + 1;
      let lockedUntil = undefined;

      if (failedAttempts >= MAX_FAILED_ATTEMPTS_PER_ACCOUNT) {
        lockedUntil = now + ACCOUNT_LOCKOUT_DURATION_MS;
      }

      await ctx.db.patch(admin._id, {
        failedLoginAttempts: failedAttempts,
        lockedUntil,
        updatedAt: now,
      });

      await logAudit(ctx, {
        adminId: admin._id,
        action: lockedUntil ? "ACCOUNT_LOCKED_FAILED_ATTEMPTS" : "LOGIN_FAILED_INVALID_PASSWORD",
        details: { failedAttempts, lockedUntil },
        ipAddress: clientIp,
        userAgent: args.userAgent,
      });

      if (lockedUntil) {
        throw new Error(
          "Account locked due to 10 consecutive failed attempts. Please try again after 15 minutes."
        );
      }

      throw new Error("Invalid email or password.");
    }

    // 6. Login Success: Reset failed attempts, create session
    const sessionToken = generateSecureToken();
    const expiresAt = now + SESSION_EXPIRY_MS;

    await ctx.db.patch(admin._id, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      lastLoginAt: now,
      lastLoginIp: clientIp,
      updatedAt: now,
    });

    const sessionId = await ctx.db.insert("adminSessions", {
      adminId: admin._id,
      sessionToken,
      ipAddress: clientIp,
      userAgent: args.userAgent,
      expiresAt,
      createdAt: now,
      lastActiveAt: now,
    });

    await logAudit(ctx, {
      adminId: admin._id,
      action: "LOGIN_SUCCESS",
      resourceType: "adminSessions",
      resourceId: sessionId,
      ipAddress: clientIp,
      userAgent: args.userAgent,
    });

    return {
      token: sessionToken,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        avatar: admin.avatar || admin.avatarUrl,
        avatarUrl: admin.avatarUrl || admin.avatar,
        lastLoginAt: now,
      },
      expiresAt,
    };
  },
});

/**
 * validateSession
 * Validates session token and active status.
 */
export const validateSession = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;

    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session) return null;

    // Check 24-hour absolute expiration
    if (session.expiresAt < now) return null;

    // Check 8-hour inactivity timeout
    if (session.lastActiveAt && now - session.lastActiveAt > INACTIVITY_TIMEOUT_MS) {
      return null;
    }

    const admin = await ctx.db.get(session.adminId);
    if (!admin || !admin.isActive) return null;

    return {
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        avatar: admin.avatar || admin.avatarUrl,
        avatarUrl: admin.avatarUrl || admin.avatar,
        lastLoginAt: admin.lastLoginAt,
      },
      expiresAt: session.expiresAt,
      lastActiveAt: session.lastActiveAt,
    };
  },
});

/**
 * touchSession
 * Updates lastActiveAt for the current session.
 */
export const touchSession = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) return false;
    if (session.lastActiveAt && now - session.lastActiveAt > INACTIVITY_TIMEOUT_MS) {
      return false;
    }

    await ctx.db.patch(session._id, {
      lastActiveAt: now,
    });
    return true;
  },
});

/**
 * getAdminBySession
 * Query returning authenticated admin details.
 */
export const getAdminBySession = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;

    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) return null;
    if (session.lastActiveAt && now - session.lastActiveAt > INACTIVITY_TIMEOUT_MS) {
      return null;
    }

    const admin = await ctx.db.get(session.adminId);
    if (!admin || !admin.isActive) return null;

    return {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
      createdAt: admin.createdAt,
    };
  },
});

/**
 * refreshSession
 * Rotates session token and extends expiry by 24 hours.
 */
export const refreshSession = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) {
      throw new Error("Invalid or expired session.");
    }

    const admin = await ctx.db.get(session.adminId);
    if (!admin || !admin.isActive) {
      throw new Error("Admin account is inactive.");
    }

    const newToken = generateSecureToken();
    const newExpiresAt = now + SESSION_EXPIRY_MS;

    await ctx.db.patch(session._id, {
      sessionToken: newToken,
      expiresAt: newExpiresAt,
      lastActiveAt: now,
    });

    await logAudit(ctx, {
      adminId: admin._id,
      action: "SESSION_REFRESHED",
      resourceType: "adminSessions",
      resourceId: session._id,
    });

    return {
      token: newToken,
      expiresAt: newExpiresAt,
    };
  },
});

/**
 * logout
 * Revokes session and records audit log.
 */
export const logout = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (session) {
      await logAudit(ctx, {
        adminId: session.adminId,
        action: "LOGOUT",
        resourceType: "adminSessions",
        resourceId: session._id,
      });
      await ctx.db.delete(session._id);
    }
    return { success: true };
  },
});

/**
 * listAdmins
 * Returns all platform admins (Super Admin only).
 */
export const listAdmins = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) {
      throw new Error("Unauthorized.");
    }

    const currentAdmin = await ctx.db.get(session.adminId);
    if (!currentAdmin || !currentAdmin.isActive) {
      throw new Error("Unauthorized.");
    }

    const admins = await ctx.db.query("platformAdmins").order("desc").collect();
    return admins.map((a: any) => ({
      id: a._id,
      email: a.email,
      name: a.name,
      role: a.role,
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt,
      lastLoginIp: a.lastLoginIp,
      createdAt: a.createdAt,
    }));
  },
});

/**
 * suspendAdmin
 * Toggles suspension/active status of an admin account.
 */
export const suspendAdmin = mutation({
  args: {
    sessionToken: v.string(),
    targetAdminId: v.id("platformAdmins"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) {
      throw new Error("Unauthorized.");
    }

    const currentAdmin = await ctx.db.get(session.adminId);
    if (!currentAdmin || !currentAdmin.isActive || currentAdmin.role !== "super_admin") {
      throw new Error("Super admin privileges required.");
    }

    if (currentAdmin._id === args.targetAdminId && !args.isActive) {
      throw new Error("You cannot suspend your own super admin account.");
    }

    const targetAdmin = await ctx.db.get(args.targetAdminId);
    if (!targetAdmin) {
      throw new Error("Admin not found.");
    }

    await ctx.db.patch(args.targetAdminId, {
      isActive: args.isActive,
      updatedAt: now,
    });

    // If deactivated, revoke all active sessions for that admin
    if (!args.isActive) {
      const activeSessions = await ctx.db
        .query("adminSessions")
        .withIndex("by_admin", (q: any) => q.eq("adminId", args.targetAdminId))
        .collect();

      for (const s of activeSessions) {
        await ctx.db.delete(s._id);
      }
    }

    await logAudit(ctx, {
      adminId: currentAdmin._id,
      action: args.isActive ? "ADMIN_REACTIVATED" : "ADMIN_SUSPENDED",
      resourceType: "platformAdmins",
      resourceId: args.targetAdminId,
      details: { targetEmail: targetAdmin.email },
    });

    return { success: true };
  },
});

/**
 * getAuditLogs
 * Returns recent platform admin audit logs.
 */
export const getAuditLogs = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) {
      throw new Error("Unauthorized.");
    }

    const currentAdmin = await ctx.db.get(session.adminId);
    if (!currentAdmin || !currentAdmin.isActive) {
      throw new Error("Unauthorized.");
    }

    const limit = args.limit || 50;
    const logs = await ctx.db
      .query("adminAuditLogs")
      .withIndex("by_created")
      .order("desc")
      .take(limit);

    return logs;
  },
});

/**
 * verifyAdminPassword
 * Step-up authentication check before high-risk administrative operations.
 */
export const verifyAdminPassword = mutation({
  args: {
    sessionToken: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) {
      throw new Error("Invalid or expired session.");
    }

    const admin = await ctx.db.get(session.adminId);
    if (!admin || !admin.isActive) {
      throw new Error("Admin account is inactive or unauthorized.");
    }

    const isMatch = bcrypt.compareSync(args.password, admin.passwordHash);
    if (!isMatch) {
      await logAudit(ctx, {
        adminId: admin._id,
        action: "HIGH_RISK_STEP_UP_FAILED",
        resourceType: "platformAdmins",
        resourceId: admin._id,
      });
      throw new Error("Invalid administrator password.");
    }

    await logAudit(ctx, {
      adminId: admin._id,
      action: "HIGH_RISK_STEP_UP_VERIFIED",
      resourceType: "platformAdmins",
      resourceId: admin._id,
    });

    return { verified: true, adminId: admin._id };
  },
});

/**
 * issueHighRiskStepUpToken
 * Issues a single-use token with 5-minute TTL after password verification.
 */
export const issueHighRiskStepUpToken = mutation({
  args: {
    sessionToken: v.string(),
    password: v.string(),
    targetAction: v.string(), // "delete_organization" | "transfer_ownership" | "adjust_subscription" | "limit_override"
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q: any) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session || session.expiresAt < now) {
      throw new Error("Invalid or expired session.");
    }

    const admin = await ctx.db.get(session.adminId);
    if (!admin || !admin.isActive) {
      throw new Error("Admin account is inactive or unauthorized.");
    }

    const isMatch = bcrypt.compareSync(args.password, admin.passwordHash);
    if (!isMatch) {
      await logAudit(ctx, {
        adminId: admin._id,
        action: "HIGH_RISK_TOKEN_REQUEST_REJECTED",
        resourceType: args.targetAction,
        resourceId: args.targetId,
      });
      throw new Error("Invalid administrator password.");
    }

    const token = generateSecureToken();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes

    await ctx.db.insert("adminStepUpTokens", {
      adminId: admin._id,
      tokenHash: token,
      targetAction: args.targetAction,
      targetId: args.targetId,
      expiresAt,
      createdAt: now,
    });

    await logAudit(ctx, {
      adminId: admin._id,
      action: "HIGH_RISK_TOKEN_ISSUED",
      resourceType: args.targetAction,
      resourceId: args.targetId,
      details: { expiresAt },
    });

    return {
      stepUpToken: token,
      expiresAt,
    };
  },
});

/**
 * Helper to verify and immediately consume a single-use step-up token
 */
export async function verifyAndConsumeStepUpToken(
  ctx: any,
  adminId: any,
  token: string,
  targetAction: string,
  targetId: string
) {
  const now = Date.now();
  const tokenDoc = await ctx.db
    .query("adminStepUpTokens")
    .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", token))
    .first();

  if (!tokenDoc) {
    throw new Error("STEP_UP_TOKEN_REQUIRED: A valid step-up verification token is required for this high-risk action.");
  }

  if (tokenDoc.adminId !== adminId) {
    throw new Error("STEP_UP_TOKEN_INVALID: Token does not belong to the authenticated administrator.");
  }

  if (tokenDoc.expiresAt < now) {
    await ctx.db.delete(tokenDoc._id);
    throw new Error("STEP_UP_TOKEN_EXPIRED: Step-up verification token has expired. Please re-authenticate.");
  }

  if (tokenDoc.targetAction !== targetAction || tokenDoc.targetId !== targetId) {
    await ctx.db.delete(tokenDoc._id);
    throw new Error("STEP_UP_TOKEN_MISMATCH: Step-up token was issued for a different action or target entity.");
  }

  // Single-use: immediately delete
  await ctx.db.delete(tokenDoc._id);
  return true;
}
