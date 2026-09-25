import { realtimeEventBus } from './realtimeEventBus.js';

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface JobStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  completedAt?: number;
}

export interface JobRecord<TResult = any> {
  id: string;
  type: string;
  userId?: string;
  workspaceId?: string;
  status: JobStatus;
  progressPercentage: number; // 0 to 100
  currentStepIndex: number;
  steps: JobStep[];
  result?: TResult;
  error?: {
    code?: string;
    message: string;
    details?: any;
  };
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

class JobService {
  private jobs = new Map<string, JobRecord>();
  private readonly MAX_JOBS = 500;
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes

  public createJob<TResult = any>(options: {
    type: string;
    userId?: string;
    workspaceId?: string;
    steps: { id: string; name: string }[];
  }): JobRecord<TResult> {
    this.cleanupOldJobs();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const steps: JobStep[] = options.steps.map((s) => ({
      id: s.id,
      name: s.name,
      status: 'pending',
    }));

    const record: JobRecord<TResult> = {
      id: jobId,
      type: options.type,
      userId: options.userId,
      workspaceId: options.workspaceId,
      status: 'pending',
      progressPercentage: 0,
      currentStepIndex: 0,
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobs.set(jobId, record);
    return record;
  }

  public getJob(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  public updateJobProgress(
    jobId: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string
  ): JobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    if (job.steps[stepIndex]) {
      job.steps[stepIndex].status = status;
      if (message) job.steps[stepIndex].message = message;
      if (status === 'completed') {
        job.steps[stepIndex].completedAt = Date.now();
      }
    }

    job.currentStepIndex = stepIndex;
    job.status = status === 'failed' ? 'failed' : 'in_progress';
    job.updatedAt = Date.now();

    const totalSteps = job.steps.length || 1;
    const completedCount = job.steps.filter((s) => s.status === 'completed').length;
    job.progressPercentage = Math.min(100, Math.round((completedCount / totalSteps) * 100));

    // Notify realtime bus
    realtimeEventBus.publish('job.progress', {
      jobId,
      status: job.status,
      progressPercentage: job.progressPercentage,
      currentStep: job.steps[stepIndex],
      updatedAt: job.updatedAt,
    }, {
      targetUserId: job.userId,
      targetWorkspaceId: job.workspaceId,
    });

    return job;
  }

  public completeJob<TResult = any>(jobId: string, result?: TResult): JobRecord<TResult> | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    job.steps.forEach((s) => {
      s.status = 'completed';
      if (!s.completedAt) s.completedAt = Date.now();
    });

    job.status = 'completed';
    job.progressPercentage = 100;
    job.result = result;
    job.completedAt = Date.now();
    job.updatedAt = Date.now();

    realtimeEventBus.publish('job.completed', {
      jobId,
      status: 'completed',
      progressPercentage: 100,
      result,
      completedAt: job.completedAt,
    }, {
      targetUserId: job.userId,
      targetWorkspaceId: job.workspaceId,
    });

    return job;
  }

  public failJob(jobId: string, error: { message: string; code?: string; details?: any }): JobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    if (job.steps[job.currentStepIndex]) {
      job.steps[job.currentStepIndex].status = 'failed';
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = Date.now();
    job.updatedAt = Date.now();

    realtimeEventBus.publish('job.failed', {
      jobId,
      status: 'failed',
      error,
      completedAt: job.completedAt,
    }, {
      targetUserId: job.userId,
      targetWorkspaceId: job.workspaceId,
    });

    return job;
  }

  private handlers = new Map<string, (data: any, jobMeta?: any) => Promise<any>>();
  private scheduledTimers = new Map<string, ReturnType<typeof setInterval>>();

  public registerHandler(type: string, handler: (data: any, jobMeta?: any) => Promise<any>): void {
    this.handlers.set(type, handler);
  }

  public async enqueue(
    type: string,
    data: any,
    options?: { priority?: 'low' | 'normal' | 'high'; maxRetries?: number; retryDelay?: number }
  ): Promise<string> {
    const jobId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const maxRetries = options?.maxRetries ?? 3;
    const retryDelay = options?.retryDelay ?? 3000;

    // Execute asynchronously
    setImmediate(async () => {
      const handler = this.handlers.get(type);
      if (!handler) return;

      let attempts = 0;
      while (attempts <= maxRetries) {
        attempts++;
        try {
          await handler(data, { jobId, type, attempt: attempts });
          break;
        } catch (err: any) {
          if (attempts > maxRetries) {
            console.error(`[JobService] Job ${type} (${jobId}) failed after ${maxRetries} retries:`, err);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempts));
        }
      }
    });

    return jobId;
  }

  public schedule(name: string, intervalMs: number, task: () => Promise<void>): void {
    if (this.scheduledTimers.has(name)) {
      clearInterval(this.scheduledTimers.get(name)!);
    }
    const timer = setInterval(async () => {
      try {
        await task();
      } catch (err) {
        console.error(`[JobService] Scheduled task ${name} execution error:`, err);
      }
    }, intervalMs);
    this.scheduledTimers.set(name, timer);
  }

  private cleanupOldJobs(): void {
    if (this.jobs.size <= this.MAX_JOBS) return;

    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.updatedAt > this.TTL_MS) {
        this.jobs.delete(id);
      }
    }
  }
}

export const jobService = new JobService();

