export type ApplicationKey = "marketing" | "accounts" | "home" | "launcher" | "inventory" | "taskmanagement";
export type ApplicationDefinition = {
    key: ApplicationKey;
    name: string;
    subdomain: string;
    productionUrl: string;
    preproductionUrl?: string;
    developmentUrl: string;
    enabled: boolean;
};
export declare const DEV_ROOT = "orviohub.localhost";
export declare const PREPROD_ROOT = "preprod.orviohub.com";
export declare const PROD_ROOT = "orviohub.com";
export declare const DEV_PORT = 4000;
export declare const applications: Record<ApplicationKey, ApplicationDefinition>;
//# sourceMappingURL=applications.d.ts.map