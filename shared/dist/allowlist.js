import { applications, DEV_ROOT, DEV_PORT, PREPROD_ROOT, PROD_ROOT } from "./applications.js";
import { resolveHost } from "./host.js";
/**
 * All allowed origins for development, derived directly from the application registry.
 */
export const developmentOrigins = Array.from(new Set([
    ...Object.values(applications).map((app) => app.developmentUrl),
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
    `http://taskmanagement.${DEV_ROOT}`,
    `http://booking.${DEV_ROOT}:${DEV_PORT}`,
    `http://gym.${DEV_ROOT}:${DEV_PORT}`,
    `http://api.${DEV_ROOT}:3000`,
    `http://api.${DEV_ROOT}:4000`,
    `http://localhost:4000`,
    `http://localhost:5173`,
    `http://localhost:3000`,
    `http://127.0.0.1:4000`,
    `http://127.0.0.1:3000`,
]));
/**
 * All allowed origins for production, derived directly from the application registry.
 */
export const productionOrigins = Array.from(new Set([
    ...Object.values(applications).map((app) => app.productionUrl),
    `https://${PROD_ROOT}`,
    `https://accounts.${PROD_ROOT}`,
    `https://account.${PROD_ROOT}`,
    `https://home.${PROD_ROOT}`,
    `https://app.${PROD_ROOT}`,
    `https://inventory.${PROD_ROOT}`,
    `https://billing.${PROD_ROOT}`,
    `https://taskmanagement.${PROD_ROOT}`,
    `https://api.${PROD_ROOT}`,
]));
/**
 * All allowed origins for preproduction, derived from application registry and Vercel.
 */
export const preproductionOrigins = Array.from(new Set([
    ...Object.values(applications).map((app) => app.preproductionUrl || app.productionUrl),
    `https://${PREPROD_ROOT}`,
    `https://accounts.${PREPROD_ROOT}`,
    `https://account.${PREPROD_ROOT}`,
    `https://home.${PREPROD_ROOT}`,
    `https://app.${PREPROD_ROOT}`,
    `https://inventory.${PREPROD_ROOT}`,
    `https://billing.${PREPROD_ROOT}`,
    `https://taskmanagement.${PREPROD_ROOT}`,
    `https://api.${PREPROD_ROOT}`,
    "https://orviohub.vercel.app",
]));
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
 * Strictly verifies against registered surfaces, blocking lookalikes, arbitrary subdomains, and admin.
 */
export function isAllowedOrigin(origin, env) {
    if (!origin)
        return false;
    let url;
    try {
        url = new URL(origin);
    }
    catch {
        return false;
    }
    // Reject anything that isn't http or https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return false;
    }
    const hostname = url.hostname.toLowerCase();
    // Explicitly disallow admin from user-facing CORS
    if (hostname === "admin.orviohub.localhost" || hostname.startsWith("admin.") || hostname.includes("admin.orviohub")) {
        return false;
    }
    // 1. Check exact match in environment-specific allowlist
    const rawOriginNoSlash = origin.replace(/\/$/, "");
    const normalizedOrigin = `${url.protocol}//${url.host}`;
    const envOrigins = getAllowedOrigins(env);
    if (envOrigins.includes(rawOriginNoSlash) || envOrigins.includes(normalizedOrigin)) {
        return true;
    }
    // 2. Strict environment pattern matching
    if (env === "development" || env === "test") {
        // Local development loopback (e.g. http://localhost:3000, http://127.0.0.1:5173)
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return url.protocol === "http:";
        }
        // Subdomain on dev root (e.g. http://account.orviohub.localhost:3000)
        if (hostname === DEV_ROOT || hostname.endsWith(`.${DEV_ROOT}`)) {
            try {
                const resolved = resolveHost(url.host);
                return resolved.environment === "development";
            }
            catch {
                return false;
            }
        }
        return false;
    }
    if (env === "preproduction" || env === "staging") {
        if (url.protocol !== "https:")
            return false;
        // Vercel deployment preview: exact orviohub*.vercel.app
        if (hostname === "orviohub.vercel.app" || /^orviohub(-[a-z0-9-]+)?\.vercel\.app$/.test(hostname)) {
            return true;
        }
        if (hostname === PREPROD_ROOT || hostname.endsWith(`.${PREPROD_ROOT}`)) {
            try {
                const resolved = resolveHost(url.host);
                return resolved.environment === "preproduction";
            }
            catch {
                return false;
            }
        }
        return false;
    }
    if (env === "production") {
        if (url.protocol !== "https:")
            return false;
        if (hostname === PROD_ROOT || hostname.endsWith(`.${PROD_ROOT}`)) {
            try {
                const resolved = resolveHost(url.host);
                return resolved.environment === "production";
            }
            catch {
                return false;
            }
        }
        return false;
    }
    return false;
}
/**
 * Validates if a returnTo URL is safe and points to a registered Orviohub surface.
 */
export function isAllowedReturnTo(returnTo, env) {
    if (!returnTo)
        return false;
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
    }
    catch {
        return false;
    }
}
/**
 * Alias for isAllowedReturnTo
 */
export const isValidReturnUrl = isAllowedReturnTo;
/**
 * Dynamically derives all allowed host strings (for Vite allowedHosts, host checking, and proxies)
 */
export function getAllowedHosts(env) {
    const hosts = new Set([
        DEV_ROOT,
        `.${DEV_ROOT}`,
        "localhost",
        "127.0.0.1",
        PREPROD_ROOT,
        `.${PREPROD_ROOT}`,
        "orviohub.vercel.app",
        PROD_ROOT,
        `.${PROD_ROOT}`,
    ]);
    // Derive subdomain hosts from registered applications
    for (const app of Object.values(applications)) {
        if (app.type === "subdomain" && app.subdomain) {
            hosts.add(`${app.subdomain}.${DEV_ROOT}`);
            hosts.add(`${app.subdomain}.${PREPROD_ROOT}`);
            hosts.add(`${app.subdomain}.${PROD_ROOT}`);
        }
    }
    // Common aliases (accounts vs account)
    hosts.add(`accounts.${DEV_ROOT}`);
    hosts.add(`accounts.${PREPROD_ROOT}`);
    hosts.add(`accounts.${PROD_ROOT}`);
    hosts.add(`account.${DEV_ROOT}`);
    hosts.add(`account.${PREPROD_ROOT}`);
    hosts.add(`account.${PROD_ROOT}`);
    if (env === "development" || env === "test") {
        return Array.from(hosts).filter((h) => h.includes(DEV_ROOT) || h === "localhost" || h === "127.0.0.1");
    }
    if (env === "preproduction" || env === "staging") {
        return Array.from(hosts).filter((h) => h.includes(PREPROD_ROOT) || h.includes("vercel.app"));
    }
    if (env === "production") {
        return Array.from(hosts).filter((h) => h.includes(PROD_ROOT) && !h.includes(DEV_ROOT) && !h.includes(PREPROD_ROOT));
    }
    return Array.from(hosts);
}
//# sourceMappingURL=allowlist.js.map