import { type Environment } from "./host.js";
/**
 * All allowed origins for development, derived directly from the application registry.
 */
export declare const developmentOrigins: string[];
/**
 * All allowed origins for production, derived directly from the application registry.
 */
export declare const productionOrigins: string[];
/**
 * All allowed origins for preproduction, derived from application registry and Vercel.
 */
export declare const preproductionOrigins: string[];
/**
 * Get the list of allowed origins based on environment.
 */
export declare function getAllowedOrigins(env: Environment): string[];
/**
 * Validates if an origin is permitted by CORS.
 * Strictly verifies against registered surfaces, blocking lookalikes, arbitrary subdomains, and admin.
 */
export declare function isAllowedOrigin(origin: string, env: Environment): boolean;
/**
 * Validates if a returnTo URL is safe and points to a registered Orviohub surface.
 */
export declare function isAllowedReturnTo(returnTo: string, env?: Environment): boolean;
/**
 * Alias for isAllowedReturnTo
 */
export declare const isValidReturnUrl: typeof isAllowedReturnTo;
/**
 * Dynamically derives all allowed host strings (for Vite allowedHosts, host checking, and proxies)
 */
export declare function getAllowedHosts(env?: Environment): string[];
//# sourceMappingURL=allowlist.d.ts.map