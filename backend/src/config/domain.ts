/**
 * Re-exports from @orviohub/shared for backward compatibility within backend.
 * Single source of truth is in shared/src/
 */
export * from '@orviohub/shared';
export { applications as APPLICATIONS } from '@orviohub/shared';
export {
  developmentOrigins as ALLOWED_CORS_ORIGINS_DEV,
  productionOrigins as ALLOWED_CORS_ORIGINS_PROD,
} from '@orviohub/shared';
