import { describe, test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  hasAdminPermission as hasFastifyAdminPermission,
  requireAdmin,
} from "../src/middleware/adminAuth.js";
import {
  hasAdminPermission as hasConvexAdminPermission,
  requireAdminPermission,
} from "../convex/adminAuth.ts";

describe("Superadmin RBAC policy", () => {
  test("Fastify and Convex deny restricted roles the same critical actions", () => {
    const cases = [
      ["support_admin", "admin.applications.manage", false],
      ["support_admin", "admin.onboarding.manage", true],
      ["billing_admin", "admin.manual_plan_grants.create", true],
      ["billing_admin", "admin.branches.manage", false],
      ["read_only_admin", "admin.applications.manage", false],
      ["read_only_admin", "admin.applications.view", true],
      ["platform_admin", "admin.branches.manage", true],
      ["platform_owner", "admin.users.delete", true],
    ] as const;

    for (const [role, permission, expected] of cases) {
      assert.equal(
        hasFastifyAdminPermission(role, undefined, permission),
        expected,
        `Fastify policy for ${role} / ${permission}`,
      );
      assert.equal(
        hasConvexAdminPermission(role, permission),
        expected,
        `Convex policy for ${role} / ${permission}`,
      );
    }
  });

  test("Convex permission gate rejects expired, inactive, and under-privileged sessions", async () => {
    const makeContext = (session: any, admin: any) => ({
      db: {
        query: () => ({
          withIndex: () => ({ first: async () => session }),
        }),
        get: async () => admin,
      },
    });

    const activeSession = {
      adminId: "admin_1",
      expiresAt: Date.now() + 60_000,
      lastActiveAt: Date.now(),
    };

    await assert.rejects(
      requireAdminPermission(
        makeContext(activeSession, { isActive: true, role: "support_admin" }),
        "session_token",
        "admin.applications.manage",
      ),
      /ADMIN_PERMISSION_DENIED/,
    );

    await assert.rejects(
      requireAdminPermission(
        makeContext({ ...activeSession, expiresAt: Date.now() - 1 }, { isActive: true, role: "platform_admin" }),
        "session_token",
        "admin.applications.manage",
      ),
      /Invalid or expired/,
    );

    await assert.rejects(
      requireAdminPermission(
        makeContext(activeSession, { isActive: false, role: "platform_admin" }),
        "session_token",
        "admin.applications.manage",
      ),
      /Unauthorized admin account/,
    );
  });

  test("Fastify middleware blocks a restricted role before a sensitive mutation executes", async () => {
    let role = "support_admin";
    const app = Fastify();
    app.decorate("authenticate", async (request: any) => {
      request.user = { id: "admin_1", role };
    });
    app.post(
      "/applications",
      { preHandler: [requireAdmin({ permission: "admin.applications.manage", sensitivity: "sensitive" })] },
      async () => ({ mutated: true }),
    );

    try {
      const denied = await app.inject({
        method: "POST",
        url: "/applications",
        payload: { reason: "Regression test" },
      });
      assert.equal(denied.statusCode, 403);
      assert.match(denied.body, /Permission denied/);

      role = "platform_admin";
      const allowed = await app.inject({
        method: "POST",
        url: "/applications",
        payload: { reason: "Regression test" },
      });
      assert.equal(allowed.statusCode, 200);
      assert.deepEqual(allowed.json(), { mutated: true });
    } finally {
      await app.close();
    }
  });
});
