import { applications, DEV_ROOT, DEV_PORT, PREPROD_ROOT, PROD_ROOT } from "./applications.js";
import { type Environment, resolveHost } from "./host.js";

/**
 * All allowed origins for development, derived directly from the application registry.
 */
export const developmentOrigins: string[] = [
  ...Object.values(applications)
    .filter((app) => app.enabled)
    .map((app) => app.developmentUrl),
  `http://${DEV_ROOT}:${DEV_PORT}`,
  `http://${DEV_ROOT}`,
  `http://account.${DEV_ROOT}:${DEV_PORT}`,
  `http://account.${DEV_ROOT}`,
  `http://accounts.${DEV_ROOT}:${DEV_PORT}`,
  `http://accounts.${DEV_ROOT}`,
  `http://home.${DEV_ROOT}:${DEV_PORT}`,
  `http://home.${DEV_ROOT}`,
  `http://app.${DEV_ROOT}:${DEV_PORT}`,
  `http://app.${DEV_ROOT}`,
  `http://inventory.${DEV_ROOT}:${DEV_PORT}`,
  `http://inventory.${DEV_ROOT}`,
  `http://pos.${DEV_ROOT}:${DEV_PORT}`,
  `http://pos.${DEV_ROOT}`,
  `http://billing.${DEV_ROOT}:${DEV_PORT}`,
  `http://billing.${DEV_ROOT}`,
  `http://taskmanagement.${DEV_ROOT}:${DEV_PORT}`,
  `http://api.${DEV_ROOT}:3000`,
  `http://api.${DEV_ROOT}:4000`,
  `http://localhost:4000`,
  `http://localhost:5173`,
  `http://localhost:3000`,
  `http://127.0.0.1:4000`,
  `http://127.0.0.1:3000`,
];

/**
 * All allowed origins for production, derived directly from the application registry.
 */
export const productionOrigins: string[] = [
  ...Object.values(applications)
    .filter((app) => app.enabled)
    .map((app) => app.productionUrl),
  `https://api.${PROD_ROOT}`,
];

/**
 * All allowed origins for preproduction, derived from application registry and Vercel.
 */
export const preproductionOrigins: string[] = [
  ...Object.values(applications)
    .filter((app) => app.enabled)
    .map((app) => app.preproductionUrl || app.productionUrl),
  `https://api.${PREPROD_ROOT}`,
  "https://orviohub.vercel.app",
];

/**
 * Get the list of allowed origins based on environment.
 */
export function getAllowedOrigins(env: Environment): string[] {
  if (env === "production") return productionOrigins;
  if (env === "preproduction") return preproductionOrigins;
  return developmentOrigins;
}

/**
 * Validates if an origin is permitted by CORS.
 */
export function isAllowedOrigin(origin: string, env: Environment): boolean {
  if (!origin) return false;
  // Disallow admin from user-facing surfaces
  if (origin.includes("admin.orviohub")) return false;
  if (origin.endsWith(".vercel.app") || origin.includes("vercel.app")) return true;
  if (origin.endsWith(".orviohub.com") || origin.includes("orviohub.com")) return true;
  if (origin.endsWith(".orviohub.localhost") || origin.includes("orviohub.localhost")) return true;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
  const origins = getAllowedOrigins(env);
  return origins.includes(origin);
}

/**
 * Validates if a returnTo URL is safe and points to a registered Orviohub surface.
 */
export function isAllowedReturnTo(returnTo: string, env?: Environment): boolean {
  if (!returnTo) return false;

  // Reject malicious schemes
  if (returnTo.toLowerCase().startsWith("javascript:") || returnTo.toLowerCase().startsWith("data:")) {
    return false;
  }

  // Allow relative URLs starting with / (e.g. /profile, /dashboard)
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(returnTo);
    // Explicitly reject admin
    if (parsed.hostname === "admin.orviohub.localhost" || parsed.hostname.startsWith("admin.")) {
      return false;
    }
    const hostContext = resolveHost(parsed.host, parsed.pathname);
    return env ? hostContext.environment === env : true;
  } catch {
    return false;
  }
}

/**
 * Alias for isAllowedReturnTo
 */
export const isValidReturnUrl = isAllowedReturnTo;

