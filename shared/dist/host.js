import { DEV_ROOT, PROD_ROOT, applications } from "./applications.js";
export class UnknownHostError extends Error {
    hostname;
    constructor(hostname) {
        super(`Unrecognized Orviohub host: ${hostname}`);
        this.hostname = hostname;
        this.name = "UnknownHostError";
    }
}
export function resolveHost(rawHost) {
    const hostname = rawHost.toLowerCase().split(":")[0].replace(/\.$/, "");
    const isDev = hostname === DEV_ROOT || hostname.endsWith(`.${DEV_ROOT}`);
    const isProd = hostname === PROD_ROOT || hostname.endsWith(`.${PROD_ROOT}`);
    if (!isDev && !isProd)
        throw new UnknownHostError(hostname);
    const root = isDev ? DEV_ROOT : PROD_ROOT;
    const environment = isDev ? "development" : "production";
    if (hostname === root) {
        return { environment, application: "marketing", hostname };
    }
    const sub = hostname.slice(0, -(root.length + 1));
    // Reject nested or multi-label subdomains outright.
    if (sub === "" || sub.includes("."))
        throw new UnknownHostError(hostname);
    const match = Object.values(applications).find((a) => a.enabled && a.subdomain !== "" && a.subdomain === sub);
    // Never fall back to a workspace lookup or to the marketing surface.
    if (!match)
        throw new UnknownHostError(hostname);
    return { environment, application: match.key, hostname };
}
//# sourceMappingURL=host.js.map