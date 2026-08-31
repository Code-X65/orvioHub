import { applications, DEV_ROOT, DEV_PORT, PROD_ROOT } from "./applications.js";
import { type Environment, resolveHost } from "./host.js";

/**
 * All allowed origins for development, derived directly from the application registry.
 */
export const developmentOrigins: string[] = [
  ...Object.values(applications)
    .filter((app) => app.enabled)
    .map((app) => app.developmentUrl),
  `http://${DEV_ROOT}:${DEV_PORT}`,
  `http://api.${DEV_ROOT}:3000`,
  `http://localhost:4000`,
  `http://localhost:5173`,
  `http://localhost:3000`,
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
 * Get the list of allowed origins based on environment.
 */
export function getAllowedOrigins(env: Environment): string[] {
  return env === "production" ? productionOrigins : developmentOrigins;
}

/**
 * Validates if an origin is permitted by CORS.
 */
export function isAllowedOrigin(origin: string, env: Environment): boolean {
  if (!origin) return false;
  const origins = getAllowedOrigins(env);
  return origins.includes(origin);
}

/**
 * Validates if a returnTo URL is safe and points to a registered Orviohub surface.
 */
export function isAllowedReturnTo(returnTo: string, env?: Environment): boolean {
  if (!returnTo) return false;

  // Allow relative URLs starting with / (e.g. /profile, /dashboard)
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(returnTo);
    const hostContext = resolveHost(parsed.host);
    return env ? hostContext.environment === env : true;
  } catch {
    return false;
  }
}

/**
 * Alias for isAllowedReturnTo
 */
export const isValidReturnUrl = isAllowedReturnTo;
