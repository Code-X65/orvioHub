import { convex } from "./convex";
import { anyApi } from "convex/server";
import type { PlatformAdmin, AdminAuditLog } from "../types/auth";

export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  token: string;
  admin: PlatformAdmin;
  expiresAt: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 12000, actionName = "Request"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${actionName} timed out. Please check your Convex backend connection or ensure 'npx convex dev' is running.`
        )
      );
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const adminAuthApi = {
  async login(params: LoginParams): Promise<LoginResponse> {
    return await withTimeout(convex.mutation(anyApi.adminAuth.login, params), 15000, "Login");
  },

  async validateSession(sessionToken: string): Promise<{ admin: PlatformAdmin; expiresAt: number; lastActiveAt?: number } | null> {
    if (!sessionToken) return null;
    return await withTimeout(convex.query(anyApi.adminAuth.validateSession, { sessionToken }), 10000, "Session validation");
  },

  async touchSession(sessionToken: string): Promise<boolean> {
    if (!sessionToken) return false;
    return await convex.mutation(anyApi.adminAuth.touchSession, { sessionToken });
  },

  async getAdminBySession(sessionToken: string): Promise<PlatformAdmin | null> {
    if (!sessionToken) return null;
    return await convex.query(anyApi.adminAuth.getAdminBySession, { sessionToken });
  },

  async refreshSession(sessionToken: string): Promise<{ token: string; expiresAt: number }> {
    return await withTimeout(convex.mutation(anyApi.adminAuth.refreshSession, { sessionToken }), 10000, "Session refresh");
  },

  async logout(sessionToken: string): Promise<{ success: boolean }> {
    return await withTimeout(convex.mutation(anyApi.adminAuth.logout, { sessionToken }), 10000, "Logout");
  },

  async listAdmins(sessionToken: string): Promise<PlatformAdmin[]> {
    return await withTimeout(convex.query(anyApi.adminAuth.listAdmins, { sessionToken }), 10000, "Fetch admins");
  },

  async suspendAdmin(params: { sessionToken: string; targetAdminId: any; isActive: boolean }): Promise<{ success: boolean }> {
    return await withTimeout(convex.mutation(anyApi.adminAuth.suspendAdmin, params), 10000, "Suspend admin");
  },

  async createAdmin(params: { email: string; name: string; password: string; creatorToken?: string }): Promise<any> {
    return await withTimeout(convex.mutation(anyApi.adminAuth.createAdmin, params), 15000, "Create admin");
  },

  async getAuditLogs(sessionToken: string, limit?: number): Promise<AdminAuditLog[]> {
    return await withTimeout(convex.query(anyApi.adminAuth.getAuditLogs, { sessionToken, limit }), 10000, "Fetch audit logs");
  },
};
