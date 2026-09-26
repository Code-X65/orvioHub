import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
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
  TOTP_ENCRYPTION_KEY: z.string().min(32).optional(),
  APP_URL: z.string().default('http://orviohub.localhost:3000'),
  BASE_URL_MARKETING: z.string().default('http://orviohub.localhost:3000'),
  BASE_URL_ACCOUNT: z.string().default('http://account.orviohub.localhost:3000'),
  BASE_URL_HOME: z.string().default('http://home.orviohub.localhost:3000'),
  BASE_URL_INVENTORY: z.string().default('http://inventory.orviohub.localhost:3000'),
  COOKIE_DOMAIN: z.string().default('.orviohub.localhost'),
  INVITATION_EXPIRY_DAYS: z.coerce.number().default(7),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  ADMIN_USER_ID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_REDIRECT_URI: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().optional(),
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && !env.CONVEX_URL) {
  throw new Error('CONVEX_URL is required in production.');
}

if (env.NODE_ENV === 'production' && !env.BREVO_API_KEY && !env.RESEND_API_KEY) {
  throw new Error('BREVO_API_KEY (or RESEND_API_KEY) and EMAIL_FROM are required in production.');
}

if (env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'orvio-hub-super-secret-key-change-in-production-min32chars') {
    throw new Error(
      'JWT_SECRET must be set to a secure, random string in production (cannot use default).'
    );
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  if (!env.TOTP_ENCRYPTION_KEY) {
    throw new Error('TOTP_ENCRYPTION_KEY must be supplied by the deployment secret manager in production.');
  }
  if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN.includes('localhost')) {
    throw new Error('COOKIE_DOMAIN cannot reference localhost in production.');
  }
  const browserUrls = {
    APP_URL: env.APP_URL,
    BASE_URL_MARKETING: env.BASE_URL_MARKETING,
    BASE_URL_ACCOUNT: env.BASE_URL_ACCOUNT,
    BASE_URL_HOME: env.BASE_URL_HOME,
    BASE_URL_INVENTORY: env.BASE_URL_INVENTORY,
  };
  for (const [name, value] of Object.entries(browserUrls)) {
    if (!value.startsWith('https://')) {
      throw new Error(`${name} must use HTTPS in production.`);
    }
  }
}

if (env.NODE_ENV === 'production' && (!env.COOKIE_DOMAIN.startsWith('.') || env.COOKIE_DOMAIN.includes('localhost'))) {
  throw new Error('COOKIE_DOMAIN must be a shared production parent domain such as .orviohub.com.');
}
