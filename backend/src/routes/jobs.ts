import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { jobService } from '../services/jobService.js';

const CreateJobSchema = z.object({
  type: z.string().min(1),
  steps: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ).min(1),
  workspaceId: z.string().optional(),
});

const UpdateJobProgressSchema = z.object({
  stepIndex: z.number().int().min(0),
  status: z.enum(['in_progress', 'completed', 'failed']),
  message: z.string().optional(),
});

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/jobs/:jobId
   * Retrieve current progress, step status, and result of an async operation
   */
  fastify.get('/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobService.getJob(jobId);

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found or has expired`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        job,
      },
    });
  });

  /**
   * POST /api/v1/jobs
   * Initialize a new tracked long-running operation
   */
  fastify.post('/jobs', async (request, reply) => {
    const parseResult = CreateJobSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid job definition',
          fields: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const userId = (request as any).user?.id || (request as any).user?._id;
    const job = jobService.createJob({
      ...parseResult.data,
      userId,
    });

    return reply.status(201).send({
      success: true,
      data: {
        job,
      },
    });
  });

  /**
   * PATCH /api/v1/jobs/:jobId/progress
   * Update step status and progress of a running job
   */
  fastify.patch('/jobs/:jobId/progress', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const parseResult = UpdateJobProgressSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid progress update body',
        },
      });
    }

    const { stepIndex, status, message } = parseResult.data;
    const updated = jobService.updateJobProgress(jobId, stepIndex, status, message);

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        job: updated,
      },
    });
  });

  /**
   * POST /api/v1/jobs/:jobId/complete
   */
  fastify.post('/jobs/:jobId/complete', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const result = (request.body as any)?.result;
    const completed = jobService.completeJob(jobId, result);

    if (!completed) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        job: completed,
      },
    });
  });
};
