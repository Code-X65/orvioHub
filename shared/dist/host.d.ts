import { type ApplicationKey } from "./applications.js";
export type Environment = "development" | "test" | "staging" | "preproduction" | "production";
export type HostContext = {
    environment: Environment;
    application: ApplicationKey;
    hostname: string;
};
export declare class UnknownHostError extends Error {
    readonly hostname: string;
    constructor(hostname: string);
}
export declare function resolveHost(rawHost: string, pathname?: string): HostContext;
//# sourceMappingURL=host.d.ts.map