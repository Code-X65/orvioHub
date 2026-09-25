export type ApplicationKey = "marketing" | "accounts" | "home" | "launcher" | "inventory" | "pos" | "booking" | "gym" | "billing" | "taskmanagement";
export type ApplicationStatus = "available" | "coming_soon" | "disabled";
export type ApplicationType = "subdomain" | "path";
export type AppAvailability = "available" | "coming_soon" | "beta";
export declare const KNOWN_PLAN_KEYS: readonly ["free_trial", "standard", "premium", "enterprise", "free"];
export type KnownPlanKey = (typeof KNOWN_PLAN_KEYS)[number];
export type ApplicationDefinition = {
    key: ApplicationKey;
    name: string;
    type: ApplicationType;
    subdomain: string;
    path?: string;
    productionUrl: string;
    preproductionUrl?: string;
    developmentUrl: string;
    enabled: boolean;
    status: ApplicationStatus;
    isVisibleToUsers: boolean;
    isActivatable: boolean;
    availability?: AppAvailability;
    description?: string;
    badge?: string;
    planRequirements?: string[];
    iconName?: string;
    displayOrder?: number;
};
export declare const DEV_ROOT = "orviohub.localhost";
export declare const PREPROD_ROOT = "preprod.orviohub.com";
export declare const PROD_ROOT = "orviohub.com";
export declare const DEV_PORT = 3000;
export declare function resolveDevUrl(subdomain: string, fallbackPath?: string): string;
export declare const applications: Record<ApplicationKey, ApplicationDefinition>;
/**
 * Serialized JSON representation of the canonical applications configuration.
 * Consumed across client and build-time tooling to guarantee single-source integrity.
 */
export declare const applicationsJson: string;
/**
 * Ordered list of all user-facing application keys.
 */
export declare const USER_FACING_APP_KEYS: ApplicationKey[];
/**
 * Retrieves an application definition by key (case-insensitive).
 */
export declare function getApplication(key: string): ApplicationDefinition | undefined;
//# sourceMappingURL=applications.d.ts.map