import { DEV_ROOT, PREPROD_ROOT, PROD_ROOT, applications, type ApplicationKey } from "./applications.js";

export type Environment = "development" | "test" | "staging" | "preproduction" | "production";

export type HostContext = {
  environment: Environment;
  application: ApplicationKey;
  hostname: string;
};

export class UnknownHostError extends Error {
  constructor(public readonly hostname: string) {
    super(`Unrecognized Orviohub host: ${hostname}`);
    this.name = "UnknownHostError";
  }
}

export function resolveHost(rawHost: string, pathname = ""): HostContext {
  const hostname = rawHost.toLowerCase().split(":")[0].replace(/\.$/, "");

  const isDev = hostname === DEV_ROOT || hostname.endsWith(`.${DEV_ROOT}`) || hostname === "localhost" || hostname === "127.0.0.1";
  const isPreprod = hostname === PREPROD_ROOT || hostname.endsWith(`.${PREPROD_ROOT}`) || hostname.endsWith(".vercel.app") || hostname.includes("vercel.app");
  const isProd = hostname === PROD_ROOT || hostname.endsWith(`.${PROD_ROOT}`);

  if (!isDev && !isPreprod && !isProd) throw new UnknownHostError(hostname);

  const environment: Environment = isDev ? "development" : isPreprod ? "preproduction" : "production";

  // Vercel Single-Host or Direct Path Resolution
  if (hostname.endsWith(".vercel.app") || hostname.includes("vercel.app") || hostname === "localhost" || hostname === "127.0.0.1") {
    // Check if there is an explicit subdomain prefix (e.g. accounts.orviohub.vercel.app)
    const firstSub = hostname.split(".")[0];
    const matchBySub = Object.values(applications).find(
      (a) => a.enabled && a.subdomain !== "" && a.subdomain === firstSub
    );
    if (matchBySub) {
      return { environment, application: matchBySub.key, hostname };
    }

    // Infer from pathname or query for single-deployment preview
    const cleanPath = pathname.toLowerCase();
    if (
      cleanPath.startsWith("/verify-email") ||
      cleanPath.startsWith("/login") ||
      cleanPath.startsWith("/signup") ||
      cleanPath.startsWith("/forgot-password") ||
      cleanPath.startsWith("/reset-password") ||
      cleanPath.startsWith("/auth") ||
      cleanPath.startsWith("/confirm-email-change") ||
      cleanPath.startsWith("/invitations") ||
      cleanPath.startsWith("/invite") ||
      cleanPath.startsWith("/profile") ||
      cleanPath.startsWith("/accounts")
    ) {
      return { environment, application: "accounts", hostname };
    }

    if (cleanPath.startsWith("/app") || cleanPath.startsWith("/launcher") || cleanPath.startsWith("/onboarding") || cleanPath.startsWith("/welcome")) {
      return { environment, application: "launcher", hostname };
    }

    if (cleanPath.startsWith("/inventory")) {
      return { environment, application: "inventory", hostname };
    }

    if (cleanPath.startsWith("/taskmanagement") || cleanPath.startsWith("/tasks")) {
      return { environment, application: "taskmanagement", hostname };
    }

    if (cleanPath.startsWith("/dashboard") || cleanPath.startsWith("/home")) {
      return { environment, application: "home", hostname };
    }

    return { environment, application: "marketing", hostname };
  }

  const root = isDev ? DEV_ROOT : isPreprod ? PREPROD_ROOT : PROD_ROOT;

  if (hostname === root) {
    return { environment, application: "marketing", hostname };
  }

  const sub = hostname.slice(0, -(root.length + 1));

  // Reject nested or multi-label subdomains outright.
  if (sub === "" || sub.includes(".")) throw new UnknownHostError(hostname);

  const match = Object.values(applications).find(
    (a) => a.enabled && a.subdomain !== "" && a.subdomain === sub
  );

  if (!match) throw new UnknownHostError(hostname);

  return { environment, application: match.key, hostname };
}
