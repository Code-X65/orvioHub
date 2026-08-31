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
 * Get the list of allowed origins based on environment.
 */
export declare function getAllowedOrigins(env: Environment): string[];
/**
 * Validates if an origin is permitted by CORS.
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
//# sourceMappingURL=allowlist.d.ts.map