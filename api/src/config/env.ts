import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  CONVEX_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  BETTERSTACK_LOGTAIL_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
