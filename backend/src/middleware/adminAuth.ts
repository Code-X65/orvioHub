import type { FastifyRequest, FastifyReply } from 'fastify';
import { ERROR_CODES } from '../config/constants.js';
import { env } from '../config/env.js';
import { dataService } from '../services/dataService.js';

export type AdminRole = 'platform_owner' | 'platform_admin' | 'support_admin' | 'billing_admin' | 'read_only_admin';

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  platform_owner: ['*'],
  platform_admin: [
    'admin.dashboard.view',
    'admin.organizations.view',
    'admin.organizations.suspend',
    'admin.organizations.restore',
    'admin.organizations.archive',
    'admin.users.view',
    'admin.users.suspend',
    'admin.users.restore',
    'admin.members.view',
    'admin.members.manage_access',
    'admin.applications.view',
    'admin.applications.manage',
    'admin.branches.view',
    'admin.branches.manage',
    'admin.billing.view',
    'admin.billing.reconcile',
    'admin.billing.manage',
    'admin.entitlements.view',
    'admin.entitlements.recalculate',
    'admin.entitlements.override',
    'admin.overrides.view',
    'admin.overrides.create',
    'admin.overrides.update',
    'admin.overrides.revoke',
    'admin.overrides.approve',
    'admin.trial_extensions.create',
    'admin.manual_plan_grants.create',
    'admin.billing_corrections.create',
    'admin.entitlement_overrides.create',
    'admin.entitlement_reconciliation.run',
    'admin.override_history.view',
    'admin.onboarding.view',
    'admin.onboarding.manage',
    'admin.audit.view',
    'admin.support_notes.view',
    'admin.support_notes.create',
    'admin.exports.request',
    'admin.analytics.view',
    'admin.revenue.view',
    'admin.analytics.export',
    'admin.analytics.rebuild',
  ],
  support_admin: [
    'admin.dashboard.view',
    'admin.organizations.view',
    'admin.users.view',
    'admin.members.view',
    'admin.applications.view',
    'admin.branches.view',
    'admin.onboarding.view',
    'admin.onboarding.manage',
    'admin.entitlements.view',
    'admin.overrides.view',
    'admin.override_history.view',
    'admin.trial_extensions.create',
    'admin.support_notes.view',
    'admin.support_notes.create',
    'admin.audit.view',
    'admin.analytics.view',
  ],
  billing_admin: [
    'admin.dashboard.view',
    'admin.organizations.view',
    'admin.billing.view',
    'admin.billing.reconcile',
    'admin.billing.manage',
    'admin.entitlements.view',
    'admin.entitlements.recalculate',
    'admin.entitlements.override',
    'admin.overrides.view',
    'admin.overrides.create',
    'admin.overrides.update',
    'admin.overrides.revoke',
    'admin.overrides.approve',
    'admin.trial_extensions.create',
    'admin.manual_plan_grants.create',
    'admin.billing_corrections.create',
    'admin.entitlement_overrides.create',
    'admin.entitlement_reconciliation.run',
    'admin.override_history.view',
    'admin.support_notes.view',
    'admin.support_notes.create',
    'admin.audit.view',
    'admin.analytics.view',
    'admin.revenue.view',
    'admin.analytics.export',
    'admin.analytics.rebuild',
  ],
  read_only_admin: [
    'admin.dashboard.view',
    'admin.organizations.view',
    'admin.users.view',
    'admin.members.view',
    'admin.applications.view',
    'admin.branches.view',
    'admin.billing.view',
    'admin.entitlements.view',
    'admin.overrides.view',
    'admin.override_history.view',
    'admin.onboarding.view',
    'admin.audit.view',
    'admin.support_notes.view',
    'admin.analytics.view',
    'admin.revenue.view',
  ],
};

export function hasAdminPermission(role: string, userPermissions: string[] | undefined, requiredPermission: string): boolean {
  if (role === 'platform_owner' || role === 'superadmin' || role === 'super_admin') {
    return true;
  }

  const rolePerms = (ADMIN_ROLE_PERMISSIONS as any)[role] || [];
  if (rolePerms.includes('*') || rolePerms.includes(requiredPermission)) {
    return true;
  }

  if (userPermissions && (userPermissions.includes('*') || userPermissions.includes(requiredPermission))) {
    return true;
  }

  return false;
}

export interface AdminAuthOptions {
  permission?: string;
  sensitivity?: 'normal' | 'sensitive' | 'high_risk';
  allowReadOnly?: boolean;
}

export function requireAdmin(options: AdminAuthOptions = {}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Authenticate session
    await (request.server as any).authenticate(request, reply);
    if (reply.sent) return;

    const user = request.user as any;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' },
      });
    }

    // Check if admin by role or ENV
    const isEnvAdmin = env.ADMIN_USER_ID && user.id === env.ADMIN_USER_ID;
    const role = (user.role || (isEnvAdmin ? 'platform_owner' : 'user')).toLowerCase();
    const isPlatformAdmin =
      role === 'superadmin' ||
      role === 'super_admin' ||
      role === 'platform_owner' ||
      role === 'platform_admin' ||
      role === 'support_admin' ||
      role === 'billing_admin' ||
      role === 'read_only_admin' ||
      isEnvAdmin;

    if (!isPlatformAdmin) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Access forbidden. Administrator privileges required.',
        },
      });
    }

    // 2. Read-only admin mutation check
    const isMutation = request.method !== 'GET' && request.method !== 'HEAD';
    if (role === 'read_only_admin' && isMutation) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Read-only administrators are not permitted to perform mutations.',
        },
      });
    }

    // 3. Permission check
    if (options.permission) {
      const allowed = hasAdminPermission(role, user.permissions, options.permission);
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PERMISSION_DENIED,
            message: `Permission denied. Required permission: '${options.permission}'.`,
          },
        });
      }
    }

    // 4. Sensitivity checks
    const body = (request.body || {}) as any;
    if (options.sensitivity === 'sensitive' || options.sensitivity === 'high_risk') {
      if (!body.reason && !request.headers['x-admin-reason']) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'A mandatory administrative reason must be provided for this action.',
          },
        });
      }
    }

    if (options.sensitivity === 'high_risk') {
      const stepUpToken = request.headers['x-step-up-token'] || body.stepUpToken;
      const totpCode = request.headers['x-admin-totp'] || body.totpCode;
      if (!stepUpToken && !totpCode && !isEnvAdmin) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'STEP_UP_AUTHENTICATION_REQUIRED',
            message: 'High-risk action requires step-up re-authentication or TOTP verification.',
          },
        });
      }
    }
  };
}
