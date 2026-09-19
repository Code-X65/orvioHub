import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import {
  WORKSPACE_ROLE_PERMISSIONS,
  APPLICATION_ROLE_PERMISSIONS,
} from "./workspacePermissions.js";

/**
 * Get role definitions (workspace and application levels) for a workspace.
 * If definitions don't exist yet in the DB, system defaults are returned.
 */
export const getRoleDefinitions = query({
  args: {
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);

    // 1. Workspace role definitions
    const customWsRoles = await ctx.db
      .query("workspaceRoleDefinitions")
      .withIndex("by_workspace", (q: any) =>
        q.eq("workspaceId", wsId || args.workspaceId)
      )
      .collect();

    const workspaceRoles = [
      {
        roleKey: "owner",
        name: "Owner",
        description: "Full control over workspace settings, billing, members, and applications.",
        permissions: WORKSPACE_ROLE_PERMISSIONS.owner,
        isSystemRole: true,
      },
      {
        roleKey: "admin",
        name: "Admin",
        description: "Manage members, applications, branches, and workspace settings.",
        permissions: WORKSPACE_ROLE_PERMISSIONS.admin,
        isSystemRole: true,
      },
      {
        roleKey: "member",
        name: "Member",
        description: "Standard member with access to assigned applications and branches.",
        permissions: WORKSPACE_ROLE_PERMISSIONS.member,
        isSystemRole: true,
      },
      {
        roleKey: "guest",
        name: "Guest",
        description: "Limited access to specifically assigned resources.",
        permissions: WORKSPACE_ROLE_PERMISSIONS.guest,
        isSystemRole: true,
      },
    ];

    // Merge custom roles
    for (const c of customWsRoles) {
      if (!workspaceRoles.some((r) => r.roleKey === c.roleKey)) {
        workspaceRoles.push({
          roleKey: c.roleKey,
          name: c.roleKey.charAt(0).toUpperCase() + c.roleKey.slice(1),
          description: "Custom workspace role",
          permissions: c.permissions,
          isSystemRole: c.isSystemRole,
        });
      }
    }

    // 2. Application role definitions
    const customAppRoles = await ctx.db
      .query("applicationRoleDefinitions")
      .withIndex("by_workspace_app", (q: any) =>
        q.eq("workspaceId", wsId || args.workspaceId)
      )
      .collect();

    const applicationRoles: Record<string, any[]> = {};

    for (const [appKey, roles] of Object.entries(APPLICATION_ROLE_PERMISSIONS)) {
      applicationRoles[appKey] = Object.entries(roles).map(([roleKey, perms]) => ({
        applicationKey: appKey,
        roleKey,
        name: roleKey.charAt(0).toUpperCase() + roleKey.slice(1),
        description: `${roleKey} role for ${appKey}`,
        permissions: perms,
        isSystemRole: true,
      }));
    }

    for (const c of customAppRoles) {
      if (!applicationRoles[c.applicationKey]) {
        applicationRoles[c.applicationKey] = [];
      }
      const existing = applicationRoles[c.applicationKey].find((r) => r.roleKey === c.roleKey);
      if (existing) {
        existing.permissions = c.permissions;
        existing.isSystemRole = c.isSystemRole;
      } else {
        applicationRoles[c.applicationKey].push({
          applicationKey: c.applicationKey,
          roleKey: c.roleKey,
          name: c.roleKey.charAt(0).toUpperCase() + c.roleKey.slice(1),
          description: `Custom ${c.applicationKey} role`,
          permissions: c.permissions,
          isSystemRole: c.isSystemRole,
        });
      }
    }

    return {
      workspaceRoles,
      applicationRoles,
    };
  },
});

/**
 * Seed default role definitions into the DB for a workspace
 */
export const seedDefaultRoleDefinitions = mutation({
  args: {
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    const targetWsId = wsId || args.workspaceId;
    const now = Date.now();

    // Seed workspace roles
    for (const [roleKey, permissions] of Object.entries(WORKSPACE_ROLE_PERMISSIONS)) {
      if (["OWNER", "ADMIN", "MEMBER", "GUEST"].includes(roleKey)) continue; // skip uppercase aliases
      const existing = await ctx.db
        .query("workspaceRoleDefinitions")
        .withIndex("by_workspace_role", (q: any) =>
          q.eq("workspaceId", targetWsId).eq("roleKey", roleKey)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("workspaceRoleDefinitions", {
          workspaceId: targetWsId as any,
          roleKey,
          permissions,
          isSystemRole: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Seed application roles
    for (const [appKey, roles] of Object.entries(APPLICATION_ROLE_PERMISSIONS)) {
      for (const [roleKey, permissions] of Object.entries(roles)) {
        const existing = await ctx.db
          .query("applicationRoleDefinitions")
          .withIndex("by_workspace_app_role", (q: any) =>
            q.eq("workspaceId", targetWsId).eq("applicationKey", appKey).eq("roleKey", roleKey)
          )
          .first();

        if (!existing) {
          await ctx.db.insert("applicationRoleDefinitions", {
            workspaceId: targetWsId as any,
            applicationKey: appKey,
            roleKey,
            permissions,
            isSystemRole: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return { success: true };
  },
});
