import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES, AVAILABLE_MODULES } from '../config/constants.js';

const selectModulesSchema = z.object({
  organizationId: z.string().optional(),
  modules: z.array(z.string()).min(1, 'Please select at least one module'),
});

const initializeWorkspaceSchema = z.object({
  organizationId: z.string().optional(),
  branchName: z.string().optional(),
  branchCode: z.string().optional(),
});

const skipStepSchema = z.object({
  step: z.string().min(1, 'Step name is required'),
});

export const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  // All onboarding routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/v1/onboarding (Get active onboarding flow & data)
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Get active user onboarding flow',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const flow = await dataService.getOnboardingFlow(request.user.id);
      const status = await dataService.getOnboardingStatus(request.user.id);
      return reply.send({
        success: true,
        data: {
          flow: flow || {
            status: 'pending',
            currentStep: 'account_creation',
            completedSteps: [],
            skippedSteps: [],
            stepData: {},
          },
          status,
        },
      });
    }
  );

  // POST /api/v1/onboarding/start
  fastify.post(
    '/start',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Start or initialize onboarding flow',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
            initialStep: { type: 'string' },
            flowVersion: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as {
        workspaceId?: string;
        productKey?: string;
        initialStep?: string;
        flowVersion?: string;
      };

      const flow = await dataService.startOnboardingFlow(
        request.user.id,
        body.workspaceId,
        body.productKey,
        body.initialStep || 'profile_setup',
        body.flowVersion
      );

      return reply.send({
        success: true,
        data: { flow },
      });
    }
  );

  // PATCH /api/v1/onboarding/progress
  fastify.patch(
    '/progress',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Update onboarding step progress and form data cache',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['step'],
          properties: {
            step: { type: 'string' },
            data: { type: 'object' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { step: string; data?: any; flowId?: string };
      const res = await dataService.updateOnboardingProgress(
        request.user.id,
        body.step,
        body.data,
        body.flowId
      );

      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/onboarding/complete-step
  fastify.post(
    '/complete-step',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Mark an onboarding step as completed',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['step'],
          properties: {
            step: { type: 'string' },
            nextStep: { type: 'string' },
            data: { type: 'object' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { step: string; nextStep?: string; data?: any; flowId?: string };
      const res = await dataService.completeOnboardingStep(
        request.user.id,
        body.step,
        body.nextStep,
        body.data,
        body.flowId
      );

      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/onboarding/skip-step
  fastify.post(
    '/skip-step',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Mark an optional onboarding step as skipped',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['step'],
          properties: {
            step: { type: 'string' },
            nextStep: { type: 'string' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { step: string; nextStep?: string; flowId?: string };
      const res = await dataService.skipOnboardingStep(
        request.user.id,
        body.step,
        body.nextStep,
        body.flowId
      );

      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/onboarding/skip-permanently
  fastify.post(
    '/skip-permanently',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Permanently skip user onboarding',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const res = await dataService.skipOnboardingPermanently(request.user.id);
      return reply.send({
        success: true,
        data: res,
        message: 'Onboarding permanently skipped. You can create an organization anytime from settings.',
      });
    }
  );

  // POST /api/v1/onboarding/reset
  fastify.post(
    '/reset',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Reset onboarding flow to restart from beginning',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const res = await dataService.resetOnboardingFlow(request.user.id);
      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // GET /api/v1/onboarding/status
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Get current user onboarding state and step',
        description: 'Primary state machine query used by the frontend to resume onboarding at the exact required step.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  currentStep: { type: 'string' },
                  completedSteps: { type: 'array', items: { type: 'string' } },
                  canSkipCurrentStep: { type: 'boolean' },
                  organization: { type: 'object', nullable: true, additionalProperties: true },
                  membership: { type: 'object', nullable: true, additionalProperties: true },
                  workspace: { type: 'object', nullable: true, additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const status = await dataService.getOnboardingStatus(request.user.id);
      return reply.send({
        success: true,
        data: status,
      });
    }
  );

  // POST /api/v1/onboarding/modules
  fastify.post(
    '/modules',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Select modules to enable for the organization',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['modules'],
          properties: {
            organizationId: { type: 'string' },
            modules: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = selectModulesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Please select at least one module.',
          },
        });
      }

      // Infer organizationId from active onboarding progress if not explicitly passed
      const status = await dataService.getOnboardingStatus(request.user.id);
      const targetOrgId = parsed.data.organizationId || status.organization?.id;

      if (!targetOrgId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
            message: 'Please create an organization first before selecting modules.',
          },
        });
      }

      try {
        const result = await dataService.selectModules(
          targetOrgId,
          request.user.id,
          parsed.data.modules
        );

        return reply.send({
          success: true,
          data: {
            organizationId: result.organizationId,
            enabledModules: result.enabledModules,
            onboarding: {
              currentStep: 'WORKSPACE_INITIALIZATION',
              status: 'IN_PROGRESS',
            },
          },
        });
      } catch (err: any) {
        if (err.code === 'INVALID_MODULE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_MODULE,
              message: 'One or more selected modules are not available.',
            },
          });
        }
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

  // POST /api/v1/onboarding/workspace
  fastify.post(
    '/workspace',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Initialize workspace defaults for enabled modules',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = initializeWorkspaceSchema.safeParse(request.body || {});
      const status = await dataService.getOnboardingStatus(request.user.id);
      const targetOrgId = parsed.data?.organizationId || status.organization?.id;

      if (!targetOrgId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
            message: 'Organization not found for active onboarding session.',
          },
        });
      }

      try {
        const result = await dataService.initializeWorkspace(targetOrgId, request.user.id);

        return reply.send({
          success: true,
          data: {
            workspace: {
              status: result.status,
              initializedModules: result.initializedModules,
            },
            onboarding: {
              currentStep: 'WORKSPACE_READY',
            },
          },
          message: 'Your workspace is ready.',
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

  // POST /api/v1/onboarding/skip
  fastify.post(
    '/skip',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Skip an optional onboarding step',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['step'],
          properties: {
            step: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = skipStepSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Step identifier is required.',
          },
        });
      }

      try {
        const result = await dataService.skipStep(request.user.id, parsed.data.step);
        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.code === 'INVALID_ONBOARDING_STEP') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_ONBOARDING_STEP,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/onboarding/share-link
  fastify.post(
    '/share-link',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Generate a shareable invite link for teammates',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const status = await dataService.getOnboardingStatus(request.user.id);
      const targetOrgId = status.organization?.id;
      if (!targetOrgId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_NOT_FOUND,
            message: 'Organization not found for active onboarding session.',
          },
        });
      }

      const body = (request.body as { role?: 'ADMIN' | 'MANAGER' | 'MEMBER' }) || {};
      const result = await dataService.generateShareableInviteLink(
        targetOrgId,
        request.user.id,
        body.role || 'MEMBER'
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // POST /api/v1/onboarding/complete
  fastify.post(
    '/complete',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Server-side validated onboarding completion',
        description: 'Validates that all mandatory steps (email verification, org creation, module selection, workspace ready) are satisfied.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            finalData: { type: 'object' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = (request.body || {}) as { finalData?: any; flowId?: string };
        await dataService.completeOnboardingFlow(request.user.id, body.finalData, body.flowId).catch(() => {});
        const result = await dataService.completeOnboarding(request.user.id);
        return reply.send({
          success: true,
          data: result,
          message: 'Onboarding completed successfully. Welcome to orvioHub!',
        });
      } catch (err: any) {
        if (err.code === 'ONBOARDING_INCOMPLETE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.ONBOARDING_INCOMPLETE,
              message: err.message,
              details: err.details,
            },
          });
        }
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.EMAIL_NOT_VERIFIED,
              message: err.message,
            },
          });
        }
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

  // Dynamic Product-Scoped Onboarding Endpoints
  // GET /api/v1/onboarding/flow/:productKey
  fastify.get(
    '/flow/:productKey',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Get dynamic onboarding flow for a product',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      const workspaceId = (request.headers['x-workspace-id'] as string) || (request.query as any)?.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'x-workspace-id header or workspaceId query parameter required.',
          },
        });
      }

      const flow = await dataService.getOnboardingFlow(request.user.id, workspaceId, productKey);
      return reply.send({
        success: true,
        data: { flow },
      });
    }
  );

  // POST /api/v1/onboarding/flow/:productKey/start
  fastify.post(
    '/flow/:productKey/start',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Start dynamic onboarding flow for a product',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['workspaceId', 'initialStep'],
          properties: {
            workspaceId: { type: 'string' },
            initialStep: { type: 'string' },
            flowVersion: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      const body = request.body as { workspaceId: string; initialStep: string; flowVersion?: string };

      const flow = await dataService.startOnboardingFlow(
        request.user.id,
        body.workspaceId,
        productKey,
        body.initialStep,
        body.flowVersion
      );

      return reply.send({
        success: true,
        data: { flow },
      });
    }
  );

  // POST /api/v1/onboarding/flow/:productKey/complete-step
  fastify.post(
    '/flow/:productKey/complete-step',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Advance a dynamic onboarding step',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['flowId', 'completedStepKey', 'nextStepKey'],
          properties: {
            flowId: { type: 'string' },
            completedStepKey: { type: 'string' },
            nextStepKey: { type: 'string' },
            stepData: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        flowId: string;
        completedStepKey: string;
        nextStepKey: string;
        stepData?: any;
      };

      const result = await dataService.completeOnboardingStep(
        body.flowId,
        body.completedStepKey,
        body.nextStepKey,
        body.stepData
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
};
