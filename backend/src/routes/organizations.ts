import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { ERROR_CODES, ROLES } from '../config/constants.js';
import { requireVerifiedEmail } from '../middleware/rbac.js';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  industry: z.string().min(2).optional(),
  category: z.string().optional(),
  country: z.string().min(2, 'Valid country is required').default('Nigeria'),
  timezone: z.string().min(2, 'Valid timezone is required').default('Africa/Lagos'),
  currency: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  size: z.string().optional(),
  logo: z.string().optional(),
  phone: z.string().optional(),
  businessPhone: z.string().optional(),
  address: z.string().optional(),
  receiptFooter: z.string().optional(),
  taxSettings: z.any().optional(),
  planId: z.string().optional(),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  paymentGateway: z.string().optional(),
  paymentReference: z.string().optional(),
  products: z.array(z.string()).optional(),
  primaryBranch: z
    .object({
      name: z.string(),
      code: z.string().optional(),
      country: z.string().optional(),
      state: z.string().optional(),
      stateCode: z.string().optional(),
      lga: z.string().optional(),
      city: z.string().optional(),
      street: z.string().optional(),
      blockNumber: z.string().optional(),
      area: z.string().optional(),
      landmark: z.string().optional(),
    })
    .optional(),
  invitations: z
    .array(
      z.object({
        email: z.string(),
        role: z.string(),
        branchAccess: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

const patchOrgSchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
  timezone: z.string().min(2).optional(),
  currency: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  size: z.string().optional(),
  logo: z.string().optional(),
});

const roleSchema = z
  .string()
  .transform((val) => val.toUpperCase().trim())
  .pipe(
    z.enum([
      'OWNER',
      'ADMIN',
      'MANAGER',
      'SALES_ATTENDANT',
      'STOCK_MANAGER',
      'ACCOUNTANT',
      'MEMBER',
      'VIEWER',
    ])
  );

const singleInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: roleSchema,
  branchAccess: z.array(z.string()).optional(),
});

const inviteTeamSchema = z.union([
  z.object({
    invitations: z.array(singleInviteSchema).min(1, 'At least one invitation is required'),
  }),
  singleInviteSchema,
]);

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
          organizations: memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            industry: m.organization.industry,
            country: m.organization.country,
            timezone: m.organization.timezone,
            logo: m.organization.logo,
          })),
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
          required: ['name'],
          properties: {
            name: { type: 'string' },
            industry: { type: 'string' },
            category: { type: 'string' },
            country: { type: 'string' },
            timezone: { type: 'string' },
            currency: { type: 'string' },
            website: { type: 'string' },
            size: { type: 'string' },
            logo: { type: 'string' },
            phone: { type: 'string' },
            businessPhone: { type: 'string' },
            address: { type: 'string' },
            receiptFooter: { type: 'string' },
            taxSettings: { type: 'object' },
            planId: { type: 'string' },
            billingCycle: { type: 'string' },
            paymentGateway: { type: 'string' },
            paymentReference: { type: 'string' },
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

      const effectiveIndustry = parsed.data.industry || parsed.data.category || 'General Business';
      const effectivePhone = parsed.data.businessPhone || parsed.data.phone;

      try {
        await entitlementService.requireCanCreateOrganization(request.user.id);
      } catch (limitErr: any) {
        if (limitErr.code === 'ORGANIZATION_LIMIT_REACHED' || limitErr.statusCode === 409) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ORGANIZATION_LIMIT_REACHED',
              message: limitErr.message || 'You already own 3 organizations. You can still join other organizations by invitation.',
              currentOwnedOrganizations: limitErr.currentOwnedOrganizations || 3,
              maximumOwnedOrganizations: limitErr.maximumOwnedOrganizations || 3,
            },
          });
        }
        throw limitErr;
      }

      let result;
      try {
        result = await dataService.createOrganization({
          userId: request.user.id,
          name: parsed.data.name,
          industry: effectiveIndustry,
          country: parsed.data.country,
          timezone: parsed.data.timezone,
          currency: parsed.data.currency,
          website: parsed.data.website || undefined,
          size: parsed.data.size,
          logo: parsed.data.logo,
          phone: effectivePhone,
          planId: parsed.data.planId,
          billingCycle: parsed.data.billingCycle,
          paymentGateway: parsed.data.paymentGateway,
          paymentReference: parsed.data.paymentReference,
          products: parsed.data.products,
          primaryBranch: parsed.data.primaryBranch || (parsed.data.address ? { name: `${parsed.data.name} Main Branch`, street: parsed.data.address } : undefined),
          invitations: parsed.data.invitations,
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_LIMIT_REACHED') || err.code === 'ORGANIZATION_LIMIT_REACHED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ORGANIZATION_LIMIT_REACHED',
              message: 'You already own 3 organizations. You can still join other organizations by invitation.',
              currentOwnedOrganizations: 3,
              maximumOwnedOrganizations: 3,
            },
          });
        }
        if (err.message?.includes('already have an organization on Free Trial')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FREE_TRIAL_LIMIT_EXCEEDED',
              message: err.message,
            },
          });
        }
        throw err;
      }

      if (parsed.data.planId && parsed.data.planId !== 'free_trial' && parsed.data.paymentReference) {
        const orgId = result.organization.id || (result.organization as any)._id;
        const periodDays = parsed.data.billingCycle === 'annual' ? 365 : 30;
        await dataService.updateOrganizationSubscription(
          orgId,
          parsed.data.planId as any,
          'active',
          Date.now() + periodDays * 86_400_000,
          undefined,
          false
        );
      }

      try {
        await dataService.updateProfile(request.user.id, { personalOnboardingCompleted: true } as any);
      } catch {}

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
            status: result.onboarding?.status || 'IN_PROGRESS',
            currentStep: result.onboarding?.currentStep || 'step_1',
          },
        },
      });
    }
  );

  // POST /api/v1/organizations/with-onboarding (US-1)
  fastify.post(
    '/with-onboarding',
    {
      preHandler: [requireVerifiedEmail],
      schema: {
        tags: ['Organizations'],
        summary: 'Create organization with onboarding context (US-1)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      if (!body.name || !body.phone || !body.category) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Business name, phone number, and category are required.',
          },
        });
      }

      try {
        await entitlementService.requireCanCreateOrganization(request.user.id);
      } catch (limitErr: any) {
        if (limitErr.code === 'ORGANIZATION_LIMIT_REACHED' || limitErr.statusCode === 409) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ORGANIZATION_LIMIT_REACHED',
              message: limitErr.message || 'You already own 3 organizations. You can still join other organizations by invitation.',
              currentOwnedOrganizations: limitErr.currentOwnedOrganizations || 3,
              maximumOwnedOrganizations: limitErr.maximumOwnedOrganizations || 3,
            },
          });
        }
        throw limitErr;
      }

      try {
        const result = await dataService.createOrganizationWithOnboarding({
          userId: request.user.id,
          name: body.name,
          phone: body.phone,
          category: body.category,
          currency: body.currency || 'NGN',
          street: body.street,
          city: body.city,
          state: body.state,
          country: body.country || 'Nigeria',
          address: body.address,
          industry: body.industry,
          timezone: body.timezone || 'Africa/Lagos',
          website: body.website,
          businessType: body.businessType,
          branchCountRange: body.branchCountRange,
          productCountRange: body.productCountRange,
          primaryUsers: body.primaryUsers,
        });

        try {
          await dataService.updateProfile(request.user.id, { personalOnboardingCompleted: true } as any);
        } catch {}

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_LIMIT_REACHED') || err.code === 'ORGANIZATION_LIMIT_REACHED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ORGANIZATION_LIMIT_REACHED',
              message: 'You already own 3 organizations. You can still join other organizations by invitation.',
              currentOwnedOrganizations: 3,
              maximumOwnedOrganizations: 3,
            },
          });
        }
        if (err.message?.includes('already have an organization on Free Trial')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FREE_TRIAL_LIMIT_EXCEEDED',
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/with-plan - Create organization with plan selection (Free Trial / Standard)
  fastify.post(
    '/with-plan',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Create organization with plan selection (Free Trial / Standard)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      if (!body.name || !body.phone || !body.category) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Business name, phone number, and category are required.',
          },
        });
      }

      try {
        await entitlementService.requireCanCreateOrganization(request.user.id);
      } catch (limitErr: any) {
        if (limitErr.code === 'ORGANIZATION_LIMIT_REACHED' || limitErr.statusCode === 409) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ORGANIZATION_LIMIT_REACHED',
              message: limitErr.message || 'You already own 3 organizations. You can still join other organizations by invitation.',
              currentOwnedOrganizations: limitErr.currentOwnedOrganizations || 3,
              maximumOwnedOrganizations: limitErr.maximumOwnedOrganizations || 3,
            },
          });
        }
        throw limitErr;
      }

      const planKey = body.planKey === 'standard' ? 'standard' : 'free_trial';

      try {
        const result = await dataService.createOrganizationWithPlan({
          userId: request.user.id,
          name: body.name,
          phone: body.phone,
          category: body.category,
          currency: body.currency || 'NGN',
          street: body.street,
          city: body.city,
          state: body.state,
          country: body.country || 'Nigeria',
          address: body.address,
          industry: body.industry,
          timezone: body.timezone || 'Africa/Lagos',
          website: body.website,
          businessType: body.businessType,
          branchCountRange: body.branchCountRange,
          productCountRange: body.productCountRange,
          primaryUsers: body.primaryUsers,
          planKey,
          billingInterval: body.billingInterval,
          paymentGateway: body.paymentGateway,
          paymentReference: body.paymentReference,
        });

        try {
          await dataService.updateProfile(request.user.id, { personalOnboardingCompleted: true } as any);
        } catch {}

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ORGANIZATION_LIMIT_REACHED') || err.code === 'ORGANIZATION_LIMIT_REACHED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ORGANIZATION_LIMIT_REACHED',
              message: 'You already own 3 organizations. You can still join other organizations by invitation.',
              currentOwnedOrganizations: 3,
              maximumOwnedOrganizations: 3,
            },
          });
        }
        if (err.message?.includes('already have an organization on Free Trial')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FREE_TRIAL_LIMIT_EXCEEDED',
              message: err.message,
            },
          });
        }
        throw err;
      }

    }
  );

  // GET /api/v1/organizations/my-organizations
  fastify.get(
    '/my-organizations',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get all organizations for current user with onboarding status and branch counts',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const orgs = await dataService.getMyOrganizations(request.user.id);
      return reply.send({
        success: true,
        data: orgs,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/profile
  fastify.get(
    '/:organizationId/profile',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get organization context profile answers',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const profile = await dataService.getOrganizationProfile(organizationId);
      return reply.send({
        success: true,
        data: profile,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/inventory-onboarding (US-2)
  fastify.get(
    '/:organizationId/inventory-onboarding',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Check inventory onboarding status for an organization (US-2)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const status = await dataService.getInventoryOnboardingStatus(organizationId);
      return reply.send({
        success: true,
        data: status,
      });
    }
  );

  // POST /api/v1/organizations/:organizationId/inventory-onboarding (US-2)
  fastify.post(
    '/:organizationId/inventory-onboarding',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Save inventory onboarding answers for an organization (US-2)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const body = request.body as any;

      const result = await dataService.saveInventoryOnboarding({
        organizationId,
        userId: request.user.id,
        previousTools: body.previousTools,
        painPoints: body.painPoints,
        priorityFeatures: body.priorityFeatures,
        needsMultiBranch: body.needsMultiBranch,
        teamComfortLevel: body.teamComfortLevel,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/context (US-5)
  fastify.get(
    '/:organizationId/context',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get organization, app, and active branch context (US-5)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const query = (request.query || {}) as { branchId?: string; applicationKey?: string };

      const context = await dataService.getCurrentOrgAppContext({
        organizationId,
        applicationKey: query.applicationKey || 'inventory',
        branchId: query.branchId,
        userId: request.user?.id,
      });

      if (!context) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
            message: 'Organization context could not be resolved.',
          },
        });
      }

      return reply.send({
        success: true,
        data: context,
      });
    }
  );

  // POST /api/v1/organizations/:organizationId/branches/auto-main (US-4A)
  fastify.post(
    '/:organizationId/branches/auto-main',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Auto-create or ensure Main Branch exists for organization (US-4A)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const body = (request.body || {}) as { name?: string; address?: string; phone?: string; applicationId?: string };

      try {
        const result = await dataService.autoCreateMainBranch({
          organizationId,
          applicationId: body.applicationId,
          userId: request.user?.id,
          name: body.name,
          address: body.address,
          phone: body.phone,
        });

        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message === 'APPLICATION_NOT_ACTIVATED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_ACTIVATED',
              message: 'Application is not activated for this organization. Please activate the application first.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/applications/:applicationKey/activate (US-A2)
  fastify.post(
    '/:organizationId/applications/:applicationKey/activate',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Explicitly activate an application for an organization (US-A2)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationKey } = request.params as {
        organizationId: string;
        applicationKey: string;
      };
      const body = (request.body || {}) as {
        planKey?: string;
        billingCycle?: string;
        paymentReference?: string;
        paymentGateway?: string;
      };

      if (applicationKey.toLowerCase() !== 'inventory') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'APPLICATION_NOT_AVAILABLE',
            message: 'This application is not available yet.',
          },
        });
      }

      try {
        const result = await dataService.activateApplication({
          organizationId,
          applicationKey,
          planKey: body.planKey || 'free_trial',
          billingCycle: body.billingCycle,
          paymentReference: body.paymentReference,
          paymentGateway: body.paymentGateway,
          userId: request.user?.id,
        });

        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message === 'APPLICATION_NOT_AVAILABLE') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_AVAILABLE',
              message: 'This application is not available yet.',
            },
          });
        }
        if (err.message?.includes('Free Trial organizations can only activate 1 application')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'APP_LIMIT_REACHED',
              message: err.message,
            },
          });
        }
        if (err.message?.includes('This application is not available on Free Trial')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'APP_NOT_ALLOWED_ON_PLAN',
              message: err.message,
            },
          });
        }
        if (err.message?.includes('subscription is required') || err.message?.includes('subscription is not active')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'SUBSCRIPTION_REQUIRED',
              message: err.message,
            },
          });
        }
        if (err.message === 'ORGANIZATION_ACCESS_DENIED' || err.message === 'INSUFFICIENT_PERMISSIONS') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners, Admins, or Managers can activate applications.',
            },
          });
        }
        if (err.message === 'ORGANIZATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
              message: 'Organization not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/applications/:applicationKey/deactivate
  fastify.post(
    '/:organizationId/applications/:applicationKey/deactivate',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Deactivate an application for an organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationKey } = request.params as {
        organizationId: string;
        applicationKey: string;
      };

      try {
        const result = await dataService.deactivateApplication({
          organizationId,
          applicationKey,
          userId: request.user?.id,
        });

        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message === 'ORGANIZATION_ACCESS_DENIED' || err.message === 'INSUFFICIENT_PERMISSIONS') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners, Admins, or Managers can deactivate applications.',
            },
          });
        }
        if (err.message === 'ORGANIZATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
              message: 'Organization not found.',
            },
          });
        }
        if (err.message === 'APPLICATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_FOUND',
              message: `Application "${applicationKey}" was not found.`,
            },
          });
        }
        if (err.message === 'APPLICATION_NOT_ACTIVATED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_ACTIVATED',
              message: `Application "${applicationKey}" is not currently activated for this organization.`,
            },
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/v1/organizations/:organizationId/applications/:applicationKey (Alias for deactivation)
  fastify.delete(
    '/:organizationId/applications/:applicationKey',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Deactivate / uninstall an application for an organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationKey } = request.params as {
        organizationId: string;
        applicationKey: string;
      };

      try {
        const result = await dataService.deactivateApplication({
          organizationId,
          applicationKey,
          userId: request.user?.id,
        });

        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message === 'ORGANIZATION_ACCESS_DENIED' || err.message === 'INSUFFICIENT_PERMISSIONS') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only Organization Owners, Admins, or Managers can deactivate applications.',
            },
          });
        }
        if (err.message === 'ORGANIZATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
              message: 'Organization not found.',
            },
          });
        }
        if (err.message === 'APPLICATION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_FOUND',
              message: `Application "${applicationKey}" was not found.`,
            },
          });
        }
        if (err.message === 'APPLICATION_NOT_ACTIVATED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_ACTIVATED',
              message: `Application "${applicationKey}" is not currently activated for this organization.`,
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/organizations/:organizationId/applications (US-A4)
  fastify.get(
    '/:organizationId/applications',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get all applications and their activation statuses for an organization (US-A4)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const apps = await dataService.getOrganizationApps(organizationId);

      return reply.send({
        success: true,
        data: apps,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/applications/:applicationKey/status (US-A4)
  fastify.get(
    '/:organizationId/applications/:applicationKey/status',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get application activation and plan status for an organization (US-A4)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationKey } = request.params as {
        organizationId: string;
        applicationKey: string;
      };

      const status = await dataService.isApplicationActiveForOrg(organizationId, applicationKey);

      return reply.send({
        success: true,
        data: status,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/my-permissions (P3: Granular RBAC)
  fastify.get(
    '/:organizationId/my-permissions',
    {
      schema: {
        tags: ['Organizations', 'RBAC'],
        summary: 'Get caller permissions across applications and branches for this organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const permissions = await dataService.getUserAppPermissions(
        organizationId,
        request.user.id
      );

      return reply.send({
        success: true,
        data: permissions,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/applications/:applicationKey/access (P3: Granular RBAC)
  fastify.get(
    '/:organizationId/applications/:applicationKey/access',
    {
      schema: {
        tags: ['Organizations', 'RBAC'],
        summary: 'Check if user has access to a specific application in this organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationKey } = request.params as {
        organizationId: string;
        applicationKey: string;
      };

      const access = await dataService.checkUserAppAccess(
        organizationId,
        request.user.id,
        applicationKey
      );

      return reply.send({
        success: true,
        data: access,
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/usage/summary (P4: Organization Entitlements)
  fastify.get(
    '/:organizationId/usage/summary',
    {
      schema: {
        tags: ['Organizations', 'Billing'],
        summary: 'Get organization usage summary against plan quotas',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const summary = await entitlementService.getOrganizationUsageSummary(
        organizationId,
        request.user?.id
      );

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // PATCH /api/v1/organizations/:organizationId/members/:memberId/permissions (P3: Granular RBAC)
  fastify.patch(
    '/:organizationId/members/:memberId/permissions',
    {
      schema: {
        tags: ['Organizations', 'RBAC'],
        summary: 'Update member allowed applications and branches',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, memberId } = request.params as {
        organizationId: string;
        memberId: string;
      };
      const body = (request.body || {}) as {
        allowedApplications?: string[];
        allowedBranches?: string[];
        primaryBranchId?: string;
      };

      try {
        await dataService.updateMemberAppPermissions({
          organizationId,
          callerUserId: request.user.id,
          targetUserId: memberId,
          allowedApplications: body.allowedApplications,
          allowedBranches: body.allowedBranches,
          primaryBranchId: body.primaryBranchId,
        });

        return reply.send({
          success: true,
          message: 'Member permissions updated successfully.',
        });
      } catch (err: any) {
        if (err.message === 'INSUFFICIENT_PERMISSIONS') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only organization owners or administrators can update member permissions.',
            },
          });
        }
        if (err.message === 'MEMBER_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'MEMBER_NOT_FOUND',
              message: 'Target organization member was not found.',
            },
          });
        }
        throw err;
      }
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

  // GET /api/v1/organizations/:id/subscription
  fastify.get(
    '/:id/subscription',
    {
      schema: {
        tags: ['Organizations', 'Billing'],
        summary: 'Get organization active subscription and plan details',
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

      try {
        const subscription = await dataService.getOrganizationSubscription(id);
        const plan = await dataService.getPlanByKey(subscription.planKey || 'free_trial');

        return reply.send({
          success: true,
          data: {
            subscription,
            plan,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch organization subscription.',
          },
        });
      }
    }
  );

  // GET /api/v1/organizations/:id/payments
  fastify.get(
    '/:id/payments',
    {
      schema: {
        tags: ['Organizations', 'Billing'],
        summary: 'Get organization payment history',
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

      try {
        const payments = await dataService.getOrganizationPayments(id);
        return reply.send({
          success: true,
          data: {
            organizationId: id,
            payments,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch organization payments.',
          },
        });
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
      let wsId = id;
      try {
        const orgWorkspaces = await dataService.getOrganizationWorkspaces(id);
        const primaryWs = orgWorkspaces.find((w: any) => w.isDefault) || orgWorkspaces[0];
        if (primaryWs) {
          wsId = primaryWs._id || primaryWs.id;
        }
      } catch {}

      const entitlement = await entitlementService.checkMemberInvitationEntitlement(wsId, request.user.id);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PLAN_LIMIT_REACHED,
            message: entitlement.error,
            current: entitlement.current,
            limit: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
          },
        });
      }

      try {
        const payloadList = 'invitations' in parsed.data ? parsed.data.invitations : [parsed.data];
        const result = await dataService.createInvitations(
          id,
          request.user.id,
          payloadList as any
        );

        const mappedInvites = result.map((i) => ({
          id: i.id || i._id,
          email: i.email,
          role: i.role,
          token: i.token,
          inviteToken: i.token,
        }));

        return reply.status(201).send({
          success: true,
          data: {
            invitations: mappedInvites,
            invitation: mappedInvites[0],
            token: mappedInvites[0]?.token,
            inviteToken: mappedInvites[0]?.token,
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

  // POST /api/v1/organizations/:id/members/invite (Convenience endpoint matching master backlog)
  fastify.post(
    '/:id/members/invite',
    {
      config: {
        rateLimit: { max: 15, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Organizations', 'Members'],
        summary: 'Invite a member to the organization (master checklist alias)',
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

      let wsId = id;
      try {
        const orgWorkspaces = await dataService.getOrganizationWorkspaces(id);
        const primaryWs = orgWorkspaces.find((w: any) => w.isDefault) || orgWorkspaces[0];
        if (primaryWs) {
          wsId = primaryWs._id || primaryWs.id;
        }
      } catch {}

      const entitlement = await entitlementService.checkMemberInvitationEntitlement(wsId, request.user.id);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PLAN_LIMIT_REACHED,
            message: entitlement.error,
            current: entitlement.current,
            limit: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
          },
        });
      }

      try {
        const payloadList = 'invitations' in parsed.data ? parsed.data.invitations : [parsed.data];
        const result = await dataService.createInvitations(
          id,
          request.user.id,
          payloadList as any
        );

        const mappedInvites = result.map((i) => ({
          id: i.id || i._id,
          email: i.email,
          role: i.role,
          token: i.token,
          inviteToken: i.token,
        }));

        return reply.status(201).send({
          success: true,
          data: {
            invitations: mappedInvites,
            invitation: mappedInvites[0],
            token: mappedInvites[0]?.token,
            inviteToken: mappedInvites[0]?.token,
          },
          message: 'Member invitation dispatched successfully.',
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

  // GET /api/v1/organizations/:id/branches
  fastify.get(
    '/:id/branches',
    {
      schema: {
        tags: ['Organizations', 'Branches'],
        summary: 'List branches for an organization',
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
      const query = (request.query || {}) as { app?: string; applicationId?: string };

      // If app or applicationId specified, fetch branches scoped to (organization, application)
      if (query.app || query.applicationId) {
        const branches = await dataService.getBranchesForApplication(id, query.applicationId, query.app);
        return reply.send({
          success: true,
          branches: branches || [],
          data: {
            organizationId: id,
            applicationId: query.applicationId,
            applicationKey: query.app,
            branches: branches || [],
          },
        });
      }

      // Try listing direct organization branches first
      let rawBranches = await dataService.listBranches({ organizationId: id });
      let branches = (rawBranches || []).map((b: any) => ({
        id: b._id || b.id,
        ...b,
      }));
      let wsId: string | undefined = undefined;

      if (!branches || branches.length === 0) {
        const workspaces = await dataService.getOrganizationWorkspaces(id);
        if (workspaces && workspaces.length > 0) {
          const primaryWs = workspaces[0];
          const resolvedWsId: string = primaryWs._id || primaryWs.id;
          wsId = resolvedWsId;
          const fallbackBranches = (await dataService.getBranches(resolvedWsId, request.user.id)) || [];
          branches = fallbackBranches.map((b: any) => ({
            id: b._id || b.id,
            ...b,
          }));
        }
      }

      return reply.send({
        success: true,
        branches: branches || [],
        data: {
          organizationId: id,
          workspaceId: wsId,
          branches: branches || [],
        },
      });
    }
  );

  // GET /api/v1/organizations/:organizationId/applications/:applicationId/branches (US-BR2)
  fastify.get(
    '/:organizationId/applications/:applicationId/branches',
    {
      schema: {
        tags: ['Organizations', 'Branches'],
        summary: 'Get branches for an organization application (US-BR2)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationId } = request.params as {
        organizationId: string;
        applicationId: string;
      };
      const branches = await dataService.getBranchesForApplication(organizationId, applicationId);
      return reply.send({
        success: true,
        data: {
          organizationId,
          applicationId,
          branches: branches || [],
        },
        branches: branches || [],
      });
    }
  );

  // POST /api/v1/organizations/:id/branches
  fastify.post(
    '/:id/branches',
    {
      schema: {
        tags: ['Organizations', 'Branches'],
        summary: 'Create a new branch in an organization',
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
          required: ['name'],
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            country: { type: 'string' },
            state: { type: 'string' },
            stateCode: { type: 'string' },
            lga: { type: 'string' },
            city: { type: 'string' },
            street: { type: 'string' },
            blockNumber: { type: 'string' },
            area: { type: 'string' },
            landmark: { type: 'string' },
            postalCode: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            isPrimary: { type: 'boolean' },
            applicationId: { type: 'string' },
            applicationKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      if (!body.name) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Branch name is required.',
          },
        });
      }

      const workspaces = await dataService.getOrganizationWorkspaces(id);
      let wsId: string | undefined = undefined;
      if (workspaces && workspaces.length > 0) {
        const primaryWs = workspaces[0];
        const resolvedWsId: string = primaryWs._id || primaryWs.id;
        wsId = resolvedWsId;
        const entitlement = await entitlementService.checkBranchCreationEntitlement(
          resolvedWsId,
          request.user.id
        );

        if (!entitlement.allowed) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'BRANCH_LIMIT_REACHED',
              message: entitlement.error || 'You have reached the maximum branches allowed by your plan.',
              current: entitlement.current,
              limit: entitlement.limit,
              planKey: entitlement.planKey,
              upgradeRequired: true,
            },
          });
        }
      }

      try {
        let branchResult: any;
        if (body.applicationId || body.applicationKey) {
          branchResult = await dataService.createBranchForApplication({
            organizationId: id,
            applicationId: body.applicationId,
            applicationKey: body.applicationKey,
            name: body.name,
            code: body.code,
            address: body.address || body.formattedAddress,
            phone: body.phone,
            isPrimary: body.isPrimary,
            callerUserId: request.user.id,
            userId: request.user.id,
          });
        } else {
          branchResult = await dataService.createBranch({
            organizationId: id,
            workspaceId: wsId,
            callerUserId: request.user.id,
            name: body.name,
            code: body.code,
            isPrimary: body.isPrimary,
            isActive: body.isActive !== undefined ? body.isActive : true,
            address: body.address,
            phone: body.phone,
            ...body,
          });
        }

        const bId =
          typeof branchResult === 'string'
            ? branchResult
            : branchResult?.branchId || branchResult?._id || branchResult?.id;

        return reply.status(201).send({
          success: true,
          message: 'Branch created successfully.',
          name: body.name,
          code: body.code,
          isPrimary: body.isPrimary,
          data: {
            branchId: bId,
            branch: {
              id: bId,
              ...body,
            },
          },
        });
      } catch (err: any) {
        if (err.message?.includes('Free Trial organizations can only have 1 branch per application')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'BRANCH_LIMIT_REACHED',
              message: err.message,
            },
          });
        }
        if (err.message === 'APPLICATION_NOT_ACTIVATED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_ACTIVATED',
              message: 'Application is not activated for this organization. Please activate the application first.',
            },
          });
        }
        if (err.message?.includes('subscription')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'SUBSCRIPTION_REQUIRED',
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/applications/:applicationId/branches (US-BR1)
  fastify.post(
    '/:organizationId/applications/:applicationId/branches',
    {
      schema: {
        tags: ['Organizations', 'Branches'],
        summary: 'Create a branch for an organization application (US-BR1)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { organizationId, applicationId } = request.params as {
        organizationId: string;
        applicationId: string;
      };
      const body = (request.body || {}) as any;

      if (!body.name) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Branch name is required.',
          },
        });
      }

      try {
        const result = await dataService.createBranchForApplication({
          organizationId,
          applicationId,
          name: body.name,
          code: body.code,
          address: body.address || body.formattedAddress,
          phone: body.phone,
          isPrimary: body.isPrimary,
          userId: request.user?.id,
          callerUserId: request.user?.id,
        });

        const bId = (result as any)?.branchId || (result as any)?._id || (result as any)?.id;
        return reply.status(201).send({
          success: true,
          message: 'Branch created successfully.',
          data: {
            branchId: bId,
            branch: (result as any)?.branch || { id: bId, ...body },
          },
        });
      } catch (err: any) {
        if (err.message?.includes('Free Trial organizations can only have 1 branch per application')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'BRANCH_LIMIT_REACHED',
              message: err.message,
            },
          });
        }
        if (err.message === 'APPLICATION_NOT_ACTIVATED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_ACTIVATED',
              message: 'Application is not activated for this organization. Please activate the application first.',
            },
          });
        }
        if (err.message?.includes('subscription')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'SUBSCRIPTION_REQUIRED',
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // PATCH /api/v1/organizations/:id/branches/:branchId
  fastify.patch(
    '/:id/branches/:branchId',
    {
      schema: {
        tags: ['Organizations', 'Branches'],
        summary: 'Update organization branch details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'branchId'],
          properties: {
            id: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { branchId } = request.params as { id: string; branchId: string };
      const body = request.body as any;

      await dataService.updateBranch(branchId, {
        callerUserId: request.user.id,
        ...body,
      });

      return reply.send({
        success: true,
        message: 'Branch updated successfully.',
        data: {
          branch: {
            id: branchId,
            ...body,
          },
        },
      });
    }
  );

  // DELETE /api/v1/organizations/:id/branches/:branchId (US-BR2)
  fastify.delete(
    '/:id/branches/:branchId',
    {
      schema: {
        tags: ['Organizations', 'Branches'],
        summary: 'Deactivate / soft-delete an organization branch (US-BR2)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'branchId'],
          properties: {
            id: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { branchId } = request.params as { id: string; branchId: string };
      try {
        await dataService.deactivateBranch(branchId, request.user.id);
        return reply.send({
          success: true,
          message: 'Branch deactivated successfully.',
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BRANCH_DEACTIVATE_FAILED',
            message: err.message || 'Failed to deactivate branch.',
          },
        });
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
        if (err.message === 'APPLICATION_NOT_ACTIVATED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'APPLICATION_NOT_ACTIVATED',
              message: 'Application is not activated for this organization. Please activate the application first.',
            },
          });
        }
        if (err.code === 'ORGANIZATION_ACCESS_DENIED' || err.message === 'ORGANIZATION_ACCESS_DENIED') {
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

      // Check Plan Limit for Workspace Creation
      const entitlement = await entitlementService.checkWorkspaceCreationEntitlement(request.user.id);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PLAN_LIMIT_REACHED,
            message: entitlement.error || `You have reached your plan limit of ${entitlement.limit} workspaces.`,
            current: entitlement.current,
            limit: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
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
      const body = request.body as { role?: string };
      const normalizedRole = body.role ? String(body.role).toUpperCase().trim() : '';

      const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER', 'SALES_ATTENDANT', 'STOCK_MANAGER', 'ACCOUNTANT', 'MEMBER', 'VIEWER'];
      if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Valid role is required (${allowedRoles.join(', ')}).`,
          },
        });
      }

      try {
        await dataService.updateMemberRole(id, request.user.id, memberId, normalizedRole as any);
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

  // POST /api/v1/organizations/:organizationId/archive
  fastify.post(
    '/:organizationId/archive',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Organizations'],
        summary: 'Archive an organization',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      try {
        await dataService.archiveOrganization(organizationId, request.user.id);
        return reply.send({
          success: true,
          message: 'Organization archived successfully.',
        });
      } catch (err: any) {
        if (err.message === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only the Organization Owner can archive this organization.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/restore
  fastify.post(
    '/:organizationId/restore',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Organizations'],
        summary: 'Restore an archived organization',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      try {
        await dataService.restoreOrganization(organizationId, request.user.id);
        return reply.send({
          success: true,
          message: 'Organization restored successfully.',
        });
      } catch (err: any) {
        if (err.message === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only the Organization Owner can restore this organization.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/organizations/:organizationId/transfer-ownership
  fastify.post(
    '/:organizationId/transfer-ownership',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Organizations'],
        summary: 'Transfer organization ownership to another user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['newOwnerId'],
          properties: {
            newOwnerId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const { newOwnerId } = request.body as { newOwnerId: string };

      try {
        await dataService.transferOrganizationOwnership(organizationId, request.user.id, newOwnerId);
        return reply.send({
          success: true,
          message: 'Organization ownership transferred successfully.',
        });
      } catch (err: any) {
        if (err.message === 'TARGET_USER_ORGANIZATION_LIMIT_REACHED') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'TARGET_USER_ORGANIZATION_LIMIT_REACHED',
              message: 'Target user already owns the maximum allowed number of organizations.',
            },
          });
        }
        if (err.message === 'ORGANIZATION_ACCESS_DENIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
              message: 'Only the current Organization Owner can transfer ownership.',
            },
          });
        }
        throw err;
      }
    }
  );
};
