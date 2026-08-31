import { type ApplicationKey } from "./applications.js";
import type { Environment } from "./host.js";
export declare function getApplicationUrl(key: ApplicationKey, env: Environment): string;
export declare const getAccountsUrl: (e: Environment) => string;
export declare const getHomeUrl: (e: Environment) => string;
export declare const getLauncherUrl: (e: Environment) => string;
export declare const getApiUrl: (e: Environment) => "http://localhost:3000" | "https://api.orviohub.com";
export declare function getLoginUrl(returnTo: string, env: Environment): string;
export declare function getPostLoginUrl(_hasOrganizations: boolean, env: Environment): string;
export declare function getInvitationUrl(token: string, env: Environment): string;
export declare function getVerifyEmailUrl(token: string, env: Environment): string;
export declare function getResetPasswordUrl(token: string, env: Environment): string;
export declare function getConfirmEmailChangeUrl(token: string, env: Environment): string;
//# sourceMappingURL=urls.d.ts.map