import { applications, DEV_ROOT, DEV_PORT, PREPROD_ROOT, PROD_ROOT } from "./applications.js";
import { resolveHost } from "./host.js";
/**
 * All allowed origins for development, derived directly from the application registry.
 */
export const developmentOrigins = [
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
export const productionOrigins = [
    ...Object.values(applications)
        .filter((app) => app.enabled)
        .map((app) => app.productionUrl),
    `https://api.${PROD_ROOT}`,
];
/**
 * All allowed origins for preproduction, derived from application registry and Vercel.
 */
export const preproductionOrigins = [
    ...Object.values(applications)
        .filter((app) => app.enabled)
        .map((app) => app.preproductionUrl || app.productionUrl),
    `https://api.${PREPROD_ROOT}`,
    "https://orviohub.vercel.app",
];
/**
 * Get the list of allowed origins based on environment.
 */
export function getAllowedOrigins(env) {
    if (env === "production")
        return productionOrigins;
    if (env === "preproduction")
        return preproductionOrigins;
    return developmentOrigins;
}
/**
 * Validates if an origin is permitted by CORS.
 */
export function isAllowedOrigin(origin, env) {
    if (!origin)
        return false;
    if (origin.endsWith(".vercel.app") || origin.includes("vercel.app"))
        return true;
    if (origin.endsWith(".orviohub.com") || origin.includes("orviohub.com"))
        return true;
    if (origin.includes("localhost") || origin.includes("127.0.0.1"))
        return true;
    const origins = getAllowedOrigins(env);
    return origins.includes(origin);
}
/**
 * Validates if a returnTo URL is safe and points to a registered Orviohub surface.
 */
export function isAllowedReturnTo(returnTo, env) {
    if (!returnTo)
        return false;
    // Allow relative URLs starting with / (e.g. /profile, /dashboard)
    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        return true;
    }
    try {
        const parsed = new URL(returnTo);
        const hostContext = resolveHost(parsed.host);
        return env ? hostContext.environment === env : true;
    }
    catch {
        return false;
    }
}
/**
 * Alias for isAllowedReturnTo
 */
export const isValidReturnUrl = isAllowedReturnTo;
//# sourceMappingURL=allowlist.js.map