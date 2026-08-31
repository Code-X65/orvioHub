import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { ERROR_CODES, ROLES } from '../config/constants.js';
import { requireVerifiedEmail } from '../middleware/rbac.js';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  industry: z.string().min(2, 'Industry is required'),
  country: z.string().min(2, 'Valid country code is required').max(3, 'Country code max 3 characters'),
  timezone: z.string().min(2, 'Valid timezone is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  size: z.string().optional(),
  logo: z.string().optional(),
});

const patchOrgSchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.string().min(2).optional(),
  country: z.string().min(2).max(3).optional(),
  timezone: z.string().min(2).optional(),
  website: z.string().url().optional().or(z.literal('')),
  size: z.string().optional(),
  logo: z.string().optional(),
});

const inviteTeamSchema = z.object({
  invitations: z.array(
    z.object({
      email: z.string().email('Invalid email address'),
      role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']),
    })
  ).min(1, 'At least one invitation is required'),
});

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  // All org routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/v1/organizations
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'List current user organizations and memberships',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const memberships = await dataService.getUserMemberships(request.user.id);
      return reply.send({
        success: true,
        data: {
          memberships: memberships.map((m) => ({
            organization: {
              id: m.organization.id,
              name: m.organization.name,
              slug: m.organization.slug,
              industry: m.organization.industry,
              country: m.organization.country,
              timezone: m.organization.timezone,
              logo: m.organization.logo,
            },
            role: m.membership.role,
            status: m.membership.status,
            joinedAt: m.membership.joinedAt,
          })),
        },
      });
    }
  );

  // POST /api/v1/organizations
  fastify.post(
    '/',
    {
      preHandler: [requireVerifiedEmail],
      schema: {
        tags: ['Organizations'],
        summary: 'Create a new organization',
        description: 'Atomically creates an organization, assigns the creator as OWNER, initializes settings, and advances onboarding.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'industry', 'country', 'timezone'],
          properties: {
            name: { type: 'string' },
            industry: { type: 'string' },
            country: { type: 'string' },
            timezone: { type: 'string' },
            website: { type: 'string' },
            size: { type: 'string' },
            logo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        parsed.error.errors.forEach((err) => {
          if (err.path[0]) fields[String(err.path[0])] = err.message;
        });
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Please correct the highlighted fields.',
            fields,
          },
        });
      }

      const result = await dataService.createOrganization({
        userId: request.user.id,
        name: parsed.data.name,
        industry: parsed.data.industry,
        country: parsed.data.country,
        timezone: parsed.data.timezone,
        website: parsed.data.website || undefined,
        size: parsed.data.size,
        logo: parsed.data.logo,
      });

      return reply.status(result.isDuplicate ? 200 : 201).send({
        success: true,
        data: {
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            slug: result.organization.slug,
            industry: result.organization.industry,
            country: result.organization.country,
            timezone: result.organization.timezone,
            website: result.organization.website,
            size: result.organization.size,
          },
          membership: {
            role: result.membership.role,
            status: result.membership.status,
          },
          onboarding: {
            status: result.onboarding.status,
            currentStep: result.onboarding.currentStep,
          },
        },
      });
    }
  );

  // GET /api/v1/organizations/:id
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get organization details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Tenant isolation: verify membership
      const membership = await dataService.getMembership(id, request.user.id);
      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
            message: 'You do not have access to this organization.',
          },
        });
      }

      const org = await dataService.getOrganizationById(id);
      if (!org) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
            message: 'Organization not found.',
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          organization: org,
          membership: {
            role: membership.role,
            status: membership.status,
          },
        },
      });
    }
  );

  // PATCH /api/v1/organizations/:id
  fastify.patch(
    '/:id',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Update organization settings and configuration',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid organization configuration fields.',
          },
        });
      }

      try {
        const updated = await dataService.updateOrganization(id, request.user.id, {
          name: parsed.data.name,
          industry: parsed.data.industry,
          country: parsed.data.country,
          timezone: parsed.data.timezone,
          website: parsed.data.website || undefined,
          size: parsed.data.size,
          logo: parsed.data.logo,
        });

        return reply.send({
          success: true,
          data: {
            organization: updated,
          },
        });
      } catch (err: any) {
        if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: err.message,
            },
          });
        }
        if (err.code === 'ORGANIZATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:id/leave
  fastify.post(
    '/:id/leave',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Leave an organization',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await dataService.leaveOrganization(id, request.user.id);
        return reply.send({
          success: true,
          message: 'Successfully left the organization.',
        });
      } catch (err: any) {
        if (err.code === 'MEMBERSHIP_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND,
              message: 'You are not an active member of this organization.',
            },
          });
        }
        if (err.code === 'OWNER_CANNOT_LEAVE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'You are the sole Owner of this organization. Please transfer ownership or assign another Owner before leaving.',
            },
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/v1/organizations/:id
  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Delete organization (Owner only, requires zero other active members)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as { password?: string } | undefined) || {};

      try {
        await dataService.deleteOrganization(id, request.user.id, body.password);
        return reply.send({
          success: true,
          message: 'Organization deleted successfully.',
        });
      } catch (err: any) {
        if (err.code === 'INVALID_PASSWORD') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_CREDENTIALS,
              message: 'Incorrect password provided.',
            },
          });
        }
        if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only the organization Owner can delete this organization.',
            },
          });
        }
        if (err.code === 'CANNOT_DELETE_ORG_WITH_MEMBERS') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.FORBIDDEN,
              message: 'Cannot delete organization while other active members exist. Remove all other members or transfer ownership first.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:id/invitations
  fastify.post(
    '/:id/invitations',
    {
      config: {
        rateLimit: { max: 15, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Organizations'],
        summary: 'Invite team members to the organization',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['invitations'],
          properties: {
            invitations: {
              type: 'array',
              items: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = inviteTeamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid invitation payload format.',
          },
        });
      }

      // Check Plan Limit for Member Invitations
      const entitlement = await entitlementService.checkMemberInvitationEntitlement(id);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PLAN_LIMIT_REACHED,
            message: entitlement.error,
            current: entitlement.current,
            limit: entitlement.limit,
            planKey: entitlement.planKey,
          },
        });
      }

      try {
        const result = await dataService.createInvitations(
          id,
          request.user.id,
          parsed.data.invitations
        );

        return reply.status(201).send({
          success: true,
          data: {
            invitations: result.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role,
            })),
          },
          message: 'Invitations dispatched successfully.',
        });
      } catch (err: any) {
        if (err.code === 'INVITATION_ACCESS_DENIED' || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_ACCESS_DENIED,
              message: err.message,
            },
          });
        }
        if (err.code === 'INVITATION_ALREADY_EXISTS') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_ALREADY_EXISTS,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/organizations/:id/invitations
  fastify.get(
    '/:id/invitations',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'List organization pending invitations',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const invites = await dataService.getOrganizationInvitations(id, request.user.id);
        return reply.send({
          success: true,
          data: {
            invitations: invites.map((inv: any) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role,
              status: inv.status,
              expiresAt: inv.expiresAt,
              createdAt: inv.createdAt,
            })),
          },
        });
      } catch (err: any) {
        if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/organizations/:id/audit-logs
  fastify.get(
    '/:id/audit-logs',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Query organization audit trail logs',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            action: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { page?: any; limit?: any; action?: string };

      try {
        const result = await dataService.getOrganizationAuditLogs(id, request.user.id, {
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 20,
          action: query.action,
        });
        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_ACCESS_DENIED') || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can view audit logs.',
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/organizations/:id/audit-log (Singular alias)
  fastify.get(
    '/:id/audit-log',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Query organization audit trail logs (alias)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { page?: any; limit?: any; action?: string };

      try {
        const result = (await dataService.getOrganizationAuditLogs(id, request.user.id, {
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 20,
          action: query.action,
        })) as any;
        return reply.send({
          success: true,
          logs: result.logs,
          pagination: result.pagination,
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_ACCESS_DENIED') || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can view audit logs.',
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/organizations/:id/workspaces
  fastify.get(
    '/:id/workspaces',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'List workspaces for an organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const membership = await dataService.getMembership(id, request.user.id);
      if (!membership || membership.status !== 'ACTIVE') {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
            message: 'You are not an active member of this organization.',
          },
        });
      }

      const workspaces = await dataService.getOrganizationWorkspaces(id);
      return reply.send({
        success: true,
        data: { workspaces },
      });
    }
  );

  // POST /api/v1/organizations/:id/workspaces
  fastify.post(
    '/:id/workspaces',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Create a new workspace in an organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const membership = await dataService.getMembership(id, request.user.id);
      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
            message: 'Only Organization Owners and Admins can create workspaces.',
          },
        });
      }

      const body = request.body as { name: string; slug: string; enabledModules?: string[]; settings?: any };
      if (!body.name || !body.slug) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Workspace name and slug are required.',
          },
        });
      }

      try {
        const workspaceId = await dataService.createWorkspace({
          organizationId: id,
          name: body.name.trim(),
          slug: body.slug.trim(),
          isDefault: false,
          enabledModules: body.enabledModules || [],
          settings: body.settings,
        });

        return reply.status(201).send({
          success: true,
          data: {
            id: workspaceId,
            name: body.name,
            slug: body.slug,
            organizationId: id,
          },
        });
      } catch (err: any) {
        if (err.message?.includes('WORKSPACE_SLUG_ALREADY_EXISTS') || err.code === 'WORKSPACE_SLUG_ALREADY_EXISTS') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.WORKSPACE_SLUG_ALREADY_EXISTS,
              message: 'A workspace with this slug already exists in this organization.',
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/organizations/:id/members
  fastify.get(
    '/:id/members',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'List organization members',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const members = await dataService.getOrganizationMembers(id, request.user.id);
        return reply.send({
          success: true,
          data: { members },
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_ACCESS_DENIED') || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'You are not a member of this organization.',
            },
          });
        }
        throw err;
      }
    }
  );

  // PATCH /api/v1/organizations/:id/members/:memberId
  fastify.patch(
    '/:id/members/:memberId',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Update organization member role',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id, memberId } = request.params as { id: string; memberId: string };
      const body = request.body as { role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' };

      if (!body.role || !['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(body.role)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Valid role is required (OWNER, ADMIN, MANAGER, MEMBER).',
          },
        });
      }

      try {
        await dataService.updateMemberRole(id, request.user.id, memberId, body.role);
        return reply.send({
          success: true,
          message: 'Member role updated successfully.',
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_ACCESS_DENIED') || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can manage member roles.',
            },
          });
        }
        if (err.message?.includes('CANNOT_REMOVE_LAST_OWNER') || err.code === 'CANNOT_REMOVE_LAST_OWNER') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.CANNOT_REMOVE_LAST_OWNER,
              message: 'Cannot demote the sole remaining Owner of the organization.',
            },
          });
        }
        if (err.message?.includes('MEMBER_NOT_FOUND') || err.code === 'MEMBER_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.MEMBER_NOT_FOUND,
              message: 'Organization member not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/v1/organizations/:id/members/:memberId
  fastify.delete(
    '/:id/members/:memberId',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Remove member from organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id, memberId } = request.params as { id: string; memberId: string };
      try {
        await dataService.removeMember(id, request.user.id, memberId);
        return reply.send({
          success: true,
          message: 'Member removed successfully.',
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_ACCESS_DENIED') || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can remove members.',
            },
          });
        }
        if (err.message?.includes('CANNOT_REMOVE_LAST_OWNER') || err.code === 'CANNOT_REMOVE_LAST_OWNER') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.CANNOT_REMOVE_LAST_OWNER,
              message: 'Cannot remove the sole remaining Owner of the organization.',
            },
          });
        }
        if (err.message?.includes('MEMBER_NOT_FOUND') || err.code === 'MEMBER_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.MEMBER_NOT_FOUND,
              message: 'Organization member not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:id/modules
  fastify.post(
    '/:id/modules',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Select and activate organization modules',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { modules: string[] };

      if (!Array.isArray(body?.modules)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'modules must be an array of module IDs.',
          },
        });
      }

      try {
        const result = await dataService.selectModules(id, request.user.id, body.modules);
        return reply.send({
          success: true,
          data: result,
          message: 'Modules configured successfully.',
        });
      } catch (err: any) {
        if (err.message?.includes('INVALID_MODULE_DEPENDENCY') || err.code === 'INVALID_MODULE_DEPENDENCY') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_MODULE_DEPENDENCY,
              message: 'Module dependency requirement not satisfied (e.g., Sales requires Customers).',
            },
          });
        }
        if (err.message?.includes('INVALID_MODULE') || err.code === 'INVALID_MODULE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_MODULE,
              message: 'One or more selected modules are invalid.',
            },
          });
        }
        if (err.message?.includes('ORGANIZATION_ACCESS_DENIED') || err.code === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can configure modules.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:id/invitations/resend
  fastify.post(
    '/:id/invitations/resend',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Resend an invitation email',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = request.body as { invitationId: string };
      if (!body?.invitationId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'invitationId is required.',
          },
        });
      }

      try {
        const res = await dataService.resendInvitation(body.invitationId, request.user.id);
        return reply.send({
          success: true,
          data: res,
          message: 'Invitation resent successfully.',
        });
      } catch (err: any) {
        if (err.message === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can resend invitations.',
            },
          });
        }
        if (err.message === 'INVITATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_NOT_FOUND,
              message: 'Invitation not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/v1/organizations/:id/invitations/:invitationId
  fastify.delete(
    '/:id/invitations/:invitationId',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Cancel a pending invitation',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { invitationId } = request.params as { invitationId: string };
      try {
        await dataService.cancelInvitation(invitationId, request.user.id);
        return reply.send({
          success: true,
          message: 'Invitation cancelled successfully.',
        });
      } catch (err: any) {
        if (err.message === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners and Admins can cancel invitations.',
            },
          });
        }
        if (err.message === 'INVITATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.INVITATION_NOT_FOUND,
              message: 'Invitation not found.',
            },
          });
        }
        throw err;
      }
    }
  );
};
