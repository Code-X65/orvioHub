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

  // GET /api/v1/onboarding/personal (Get personal onboarding status & profile)
  fastify.get(
    '/personal',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Get current user personal onboarding status and answers',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const data = await dataService.getPersonalOnboardingProfile(request.user.id);
      return reply.send({
        success: true,
        data,
      });
    }
  );

  // POST /api/v1/onboarding/personal/progress (Save draft step & answers for continuity & superadmin tracking)
  fastify.post(
    '/personal/progress',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Save personal onboarding step progress and draft answers',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentStep'],
          properties: {
            currentStep: { type: 'number' },
            useCases: { type: 'array', items: { type: 'string' } },
            use_cases: { type: 'array', items: { type: 'string' } },
            acquisitionSource: { type: 'string' },
            acquisition_source: { type: 'string' },
            acquisitionSourceOther: { type: 'string' },
            acquisition_source_other: { type: 'string' },
            role: { type: 'string' },
            managesBusiness: { type: 'boolean' },
            manages_business: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const currentStep = Number(body.currentStep) || 1;
      const useCases = body.useCases || body.use_cases;
      const acquisitionSource = body.acquisitionSource || body.acquisition_source;
      const acquisitionSourceOther = body.acquisitionSourceOther || body.acquisition_source_other;
      const role = body.role;
      const managesBusiness = body.managesBusiness !== undefined ? body.managesBusiness : body.manages_business;

      const result = await dataService.savePersonalOnboardingProgress(request.user.id, {
        currentStep,
        useCases: useCases ? (Array.isArray(useCases) ? useCases : [String(useCases)]) : undefined,
        acquisitionSource: acquisitionSource ? String(acquisitionSource) : undefined,
        acquisitionSourceOther: acquisitionSourceOther ? String(acquisitionSourceOther).trim() : undefined,
        role: role ? String(role) : undefined,
        managesBusiness: managesBusiness !== undefined ? Boolean(managesBusiness) : undefined,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // POST /api/v1/onboarding/personal (Submit personal onboarding answers)
  fastify.post(
    '/personal',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Submit personal onboarding answers and complete personal setup',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            useCases: { type: 'array', items: { type: 'string' } },
            use_cases: { type: 'array', items: { type: 'string' } },
            acquisitionSource: { type: 'string' },
            acquisition_source: { type: 'string' },
            acquisitionSourceOther: { type: 'string' },
            acquisition_source_other: { type: 'string' },
            role: { type: 'string' },
            managesBusiness: { type: 'boolean' },
            manages_business: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const useCases = body.useCases || body.use_cases || ['exploring'];
      const acquisitionSource = body.acquisitionSource || body.acquisition_source || 'direct';
      const acquisitionSourceOther = body.acquisitionSourceOther || body.acquisition_source_other;
      const role = body.role;
      const managesBusiness = body.managesBusiness !== undefined ? body.managesBusiness : body.manages_business;

      const result = await dataService.savePersonalOnboarding(request.user.id, {
        useCases: Array.isArray(useCases) ? useCases : [String(useCases)],
        acquisitionSource: String(acquisitionSource),
        acquisitionSourceOther: acquisitionSourceOther ? String(acquisitionSourceOther).trim() : undefined,
        role: role ? String(role) : undefined,
        managesBusiness: managesBusiness !== undefined ? Boolean(managesBusiness) : undefined,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Personal onboarding completed successfully.',
      });
    }
  );

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

  // GET /api/v1/onboarding/share-link
  fastify.get(
    '/share-link',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Get active shareable invite link for teammates',
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

      const link = await dataService.getActiveShareableInviteLink(targetOrgId, request.user.id);
      return reply.send({
        success: true,
        data: link,
      });
    }
  );

  // POST /api/v1/onboarding/share-link
  fastify.post(
    '/share-link',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Generate or regenerate a shareable invite link for teammates',
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

      const body = (request.body as { role?: any; expiresInDays?: number; regenerate?: boolean }) || {};
      const result = await dataService.generateShareableInviteLink(
        targetOrgId,
        request.user.id,
        body.role || 'MEMBER',
        body.expiresInDays
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // DELETE /api/v1/onboarding/share-link
  fastify.delete(
    '/share-link',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Revoke active shareable invite link for teammates',
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

      await dataService.revokeShareableInviteLinks(targetOrgId, request.user.id);
      return reply.send({
        success: true,
        message: 'Shareable invite link revoked successfully.',
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
          nullable: true,
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

  // ==========================================
  // INVENTORY ONBOARDING & FIRST SALE TUTORIAL
  // ==========================================

  const resolveTargetWorkspaceId = async (request: any, explicitId?: string): Promise<string | null> => {
    if (explicitId) return explicitId;
    const headerWs = request.headers['x-workspace-id'] as string;
    if (headerWs) return headerWs;
    const queryWs = (request.query as any)?.workspaceId;
    if (queryWs) return queryWs;
    const bodyWs = (request.body as any)?.workspaceId;
    if (bodyWs) return bodyWs;
    const status = await dataService.getOnboardingStatus(request.user.id).catch(() => null);
    if (status?.workspace?.id) return status.workspace.id;
    if (status?.organization?.id) {
      const wsList = await (dataService as any).getOrganizationWorkspaces(status.organization.id).catch(() => []);
      if (wsList && wsList.length > 0) {
        return wsList[0].id || wsList[0]._id;
      }
    }
    return null;
  };

  // GET /api/v1/onboarding/inventory/status
  fastify.get(
    '/inventory/status',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Get inventory onboarding state and progress',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const workspaceId = await resolveTargetWorkspaceId(request);
      const flow = workspaceId
        ? await dataService.getInventoryOnboardingFlow(request.user.id, workspaceId)
        : null;

      const completedSteps = flow?.completedSteps || [];
      const skippedSteps = flow?.skippedSteps || [];
      const isFirstSaleCompleted = completedSteps.includes('first_sale_tutorial');
      const isFirstSaleSkipped = skippedSteps.includes('first_sale_tutorial');
      const statusNormalized = (flow?.status || '').toLowerCase();
      const canResume = flow?.currentStep === 'first_sale_tutorial' && (statusNormalized === 'in_progress' || statusNormalized === 'not_started');
      const isComplete = statusNormalized === 'completed' || (isFirstSaleCompleted || isFirstSaleSkipped);

      return reply.send({
        success: true,
        data: {
          flow: flow || {
            status: 'not_started',
            currentStep: 'product_setup',
            completedSteps: [],
            skippedSteps: [],
            stepData: {},
          },
          currentStep: flow?.currentStep || 'product_setup',
          completedSteps,
          skippedSteps,
          canResume,
          isComplete,
          stepData: flow?.stepData || {},
        },
      });
    }
  );

  // POST /api/v1/onboarding/inventory/start
  fastify.post(
    '/inventory/start',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Start or initialize inventory onboarding flow',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            initialStep: { type: 'string' },
            flowVersion: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as { workspaceId?: string; initialStep?: string; flowVersion?: string };
      const workspaceId = await resolveTargetWorkspaceId(request, body.workspaceId);

      const initialStep = body.initialStep || 'product_setup';
      const flow = await dataService.startInventoryOnboardingFlow(
        request.user.id,
        workspaceId || 'workspace_local',
        initialStep
      );

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: workspaceId || undefined,
        productKey: 'inventory',
        eventType: 'onboarding.inventory_started',
        metadata: {
          initialStep,
          flowVersion: body.flowVersion || '1.0',
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }).catch(() => {});

      if (initialStep === 'first_sale_tutorial') {
        await dataService.logAudit({
          actorUserId: request.user.id,
          workspaceId: workspaceId || undefined,
          productKey: 'inventory',
          eventType: 'onboarding.first_sale_started',
          entityType: 'sale',
          metadata: { tutorial: true, currentStep: 'first_sale_tutorial' },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        data: { flow },
      });
    }
  );

  // POST /api/v1/onboarding/inventory/progress
  fastify.post(
    '/inventory/progress',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Update inventory onboarding step progress and draft state',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentStep'],
          properties: {
            currentStep: { type: 'string' },
            stepData: { type: 'object' },
            workspaceId: { type: 'string' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { currentStep: string; stepData?: any; workspaceId?: string; flowId?: string };
      const workspaceId = await resolveTargetWorkspaceId(request, body.workspaceId);

      const res = await dataService.updateInventoryOnboardingProgress(
        request.user.id,
        workspaceId || 'workspace_local',
        body.currentStep,
        body.stepData,
        body.flowId
      );

      if (body.currentStep === 'first_sale_tutorial') {
        await dataService.logAudit({
          actorUserId: request.user.id,
          workspaceId: workspaceId || undefined,
          productKey: 'inventory',
          eventType: 'onboarding.first_sale_started',
          entityType: 'sale',
          metadata: {
            tutorial: true,
            currentStep: 'first_sale_tutorial',
            ...(body.stepData || {}),
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/onboarding/inventory/complete-step
  fastify.post(
    '/inventory/complete-step',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Mark an inventory onboarding step as completed',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['step'],
          properties: {
            step: { type: 'string' },
            nextStep: { type: 'string' },
            metadata: { type: 'object' },
            workspaceId: { type: 'string' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        step: string;
        nextStep?: string;
        metadata?: any;
        workspaceId?: string;
        flowId?: string;
      };
      const workspaceId = await resolveTargetWorkspaceId(request, body.workspaceId);

      const nextStep = body.nextStep || (body.step === 'first_sale_tutorial' ? 'completed' : body.step);
      const res = await dataService.completeInventoryOnboardingStep(
        request.user.id,
        workspaceId || 'workspace_local',
        body.step,
        nextStep,
        body.metadata,
        body.flowId
      );

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: workspaceId || undefined,
        productKey: 'inventory',
        eventType: body.step === 'first_sale_tutorial' ? 'onboarding.first_sale_completed' : 'onboarding.step_completed',
        entityType: body.step === 'first_sale_tutorial' ? 'sale' : 'step',
        entityId: body.metadata?.saleId || (body.step === 'first_sale_tutorial' ? 'tutorial_sale' : body.step),
        metadata: {
          step: body.step,
          tutorial: body.step === 'first_sale_tutorial',
          paymentMethod: body.metadata?.paymentMethod,
          productCount: body.metadata?.productCount,
          saleId: body.metadata?.saleId,
          totalAmount: body.metadata?.totalAmount,
          ...(body.metadata || {}),
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }).catch(() => {});

      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/onboarding/inventory/skip-step
  fastify.post(
    '/inventory/skip-step',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Mark an inventory onboarding step as skipped',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['step'],
          properties: {
            step: { type: 'string' },
            nextStep: { type: 'string' },
            workspaceId: { type: 'string' },
            flowId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        step: string;
        nextStep?: string;
        workspaceId?: string;
        flowId?: string;
      };
      const workspaceId = await resolveTargetWorkspaceId(request, body.workspaceId);

      const res = await dataService.skipInventoryOnboardingStep(
        request.user.id,
        workspaceId || 'workspace_local',
        body.step,
        body.nextStep || 'completed',
        body.flowId
      );

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: workspaceId || undefined,
        productKey: 'inventory',
        eventType: 'onboarding.step_skipped',
        metadata: {
          step: body.step,
          skipped: true,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }).catch(() => {});

      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/onboarding/inventory/complete
  fastify.post(
    '/inventory/complete',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Validate and finalize inventory onboarding',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as { workspaceId?: string; branchId?: string };
      const workspaceId = await resolveTargetWorkspaceId(request, body.workspaceId);

      // Acceptance Criteria:
      // User cannot mark Inventory onboarding as complete until first_sale_tutorial is completed (or explicitly skipped).
      const flow = workspaceId
        ? await dataService.getInventoryOnboardingFlow(request.user.id, workspaceId).catch(() => null)
        : null;

      if (flow) {
        const completed = flow.completedSteps || [];
        const skipped = flow.skippedSteps || [];
        const isTutorialSatisfied =
          completed.includes('first_sale_tutorial') || skipped.includes('first_sale_tutorial');

        if (!isTutorialSatisfied) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'STEP_INCOMPLETE',
              message: 'User cannot mark Inventory onboarding as complete until first_sale_tutorial is completed (or explicitly skipped).',
              step: 'first_sale_tutorial',
            },
          });
        }
      }

      if (workspaceId) {
        await dataService.completeInventoryOnboarding(workspaceId, body.branchId, request.user.id, true).catch(() => {});
      }

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: workspaceId || undefined,
        productKey: 'inventory',
        eventType: 'inventory.onboarding_completed',
        metadata: {
          branchId: body.branchId,
          completedAt: Date.now(),
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }).catch(() => {});

      return reply.send({
        success: true,
        data: { completed: true },
        message: 'Inventory onboarding completed successfully!',
      });
    }
  );

  // POST /api/v1/onboarding/inventory/first-sale-failed
  fastify.post(
    '/inventory/first-sale-failed',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Log audit event for failed first sale tutorial attempt',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            error: { type: 'string' },
            details: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as { workspaceId?: string; error?: string; details?: any };
      const workspaceId = await resolveTargetWorkspaceId(request, body.workspaceId);

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: workspaceId || undefined,
        productKey: 'inventory',
        eventType: 'onboarding.first_sale_failed',
        entityType: 'sale',
        metadata: {
          tutorial: true,
          error: body.error || 'Sale creation failed during tutorial',
          details: body.details,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }).catch(() => {});

      return reply.send({
        success: true,
        data: { logged: true },
        message: 'Failure event recorded',
      });
    }
  );
};
