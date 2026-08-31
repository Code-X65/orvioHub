import type { FastifyRequest, FastifyReply } from 'fastify';
import { ERROR_CODES, type Role } from '../config/constants.js';
import { dataService } from '../services/dataService.js';

export async function requireVerifiedEmail(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHENTICATED,
        message: 'Authentication required.',
      },
    });
  }

  if (!request.user.emailVerified) {
    return reply.status(403).send({
      success: false,
      error: {
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'Please verify your email before continuing.',
      },
    });
  }
}

export function extractOrgId(request: FastifyRequest): string | undefined {
  const params = request.params as Record<string, string | undefined>;
  const body = request.body as { organizationId?: string } | undefined;
  const headerOrgId = request.headers['x-organization-id'] as string | undefined;

  return (
    params.id ||
    params.orgId ||
    params.organizationId ||
    headerOrgId ||
    body?.organizationId
  );
}

export async function requireOrgMembership(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHENTICATED,
        message: 'Authentication required.',
      },
    });
  }

  const organizationId = extractOrgId(request);
  if (!organizationId) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Organization ID is required in route params or x-organization-id header.',
      },
    });
  }

  const membership = await dataService.getMembership(organizationId, request.user.id);
  if (!membership || membership.status !== 'ACTIVE') {
    return reply.status(403).send({
      success: false,
      error: {
        code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
        message: 'You are not an active member of this organization.',
      },
    });
  }

  // Attach to request for downstream handlers
  (request as any).membership = membership;
  (request as any).organizationId = organizationId;
}

export function requireOrgRole(allowedRoles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHENTICATED,
          message: 'Authentication required.',
        },
      });
    }

    const organizationId = extractOrgId(request);
    if (!organizationId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Organization ID is required.',
        },
      });
    }

    const membership = await dataService.getMembership(organizationId, request.user.id);
    if (!membership || membership.status !== 'ACTIVE' || !allowedRoles.includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
          message: 'You do not have permission to perform this action in this organization.',
        },
      });
    }

    (request as any).membership = membership;
    (request as any).organizationId = organizationId;
  };
}
