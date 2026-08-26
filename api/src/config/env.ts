import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  CONVEX_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().default('OrvioHub'),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default('OrvioHub'),
  TERMII_BASE_URL: z.string().default('https://api.ng.termii.com'),
  SENTRY_DSN: z.string().optional(),
  BETTERSTACK_LOGTAIL_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().default('orvio-hub-super-secret-key-change-in-production-min32chars'),
  APP_URL: z.string().default('http://localhost:5173'),
  INVITATION_EXPIRY_DAYS: z.coerce.number().default(7),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_REDIRECT_URI: z.string().optional(),
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && !env.CONVEX_URL) {
  throw new Error('CONVEX_URL is required in production.');
}

if (env.NODE_ENV === 'production' && (!env.BREVO_API_KEY && !env.RESEND_API_KEY)) {
  throw new Error('BREVO_API_KEY (or RESEND_API_KEY) and EMAIL_FROM are required in production.');
}
