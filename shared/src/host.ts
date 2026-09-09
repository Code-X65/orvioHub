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

export function normalizeSubdomain(sub: string): string {
  const s = sub.toLowerCase();
  if (s === "account" || s === "accounts") return "accounts";
  if (s === "app" || s === "launcher" || s === "home") return "home";
  if (s === "pos" || s === "inventory") return "inventory";
  if (s === "tasks" || s === "taskmanagement") return "taskmanagement";
  if (s === "billing") return "billing";
  return s;
}

export function resolveHost(rawHost: string, pathname = ""): HostContext {
  const hostname = rawHost.toLowerCase().split(":")[0].replace(/\.$/, "");

  const isDev = hostname === DEV_ROOT || hostname.endsWith(`.${DEV_ROOT}`) || hostname === "localhost" || hostname === "127.0.0.1";
  const isPreprod = hostname === PREPROD_ROOT || hostname.endsWith(`.${PREPROD_ROOT}`) || hostname.endsWith(".vercel.app") || hostname.includes("vercel.app");
  const isProd = hostname === PROD_ROOT || hostname.endsWith(`.${PROD_ROOT}`);

  if (!isDev && !isPreprod && !isProd) throw new UnknownHostError(hostname);

  const environment: Environment = isDev ? "development" : isPreprod ? "preproduction" : "production";

  // Single-Host (DEV_ROOT, localhost, Vercel preview) Direct Path Resolution
  if (
    hostname === DEV_ROOT ||
    hostname.endsWith(".vercel.app") ||
    hostname.includes("vercel.app") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    // Check if there is an explicit subdomain prefix (e.g. account.orviohub.localhost or accounts.orviohub.vercel.app)
    if (hostname.includes(".")) {
      const firstSub = hostname.split(".")[0];
      if (firstSub === "admin") throw new UnknownHostError(hostname);
      const normalizedFirstSub = normalizeSubdomain(firstSub);
      if (normalizedFirstSub === "accounts") return { environment, application: "accounts", hostname };
      if (normalizedFirstSub === "home") return { environment, application: "home", hostname };
      if (normalizedFirstSub === "inventory") return { environment, application: "inventory", hostname };
      if (normalizedFirstSub === "billing") return { environment, application: "billing", hostname };
      if (normalizedFirstSub === "taskmanagement") return { environment, application: "taskmanagement", hostname };
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
      cleanPath.startsWith("/accounts") ||
      cleanPath.startsWith("/account")
    ) {
      return { environment, application: "accounts", hostname };
    }

    if (cleanPath.startsWith("/onboard") || cleanPath.startsWith("/onboarding") || cleanPath.startsWith("/dashboard") || cleanPath.startsWith("/organizations") || cleanPath.startsWith("/workspaces") || cleanPath.startsWith("/app") || cleanPath.startsWith("/launcher") || cleanPath.startsWith("/home")) {
      return { environment, application: "home", hostname };
    }

    if (cleanPath.startsWith("/inventory") || cleanPath.startsWith("/pos")) {
      return { environment, application: "inventory", hostname };
    }

    if (cleanPath.startsWith("/billing")) {
      return { environment, application: "billing", hostname };
    }

    if (cleanPath.startsWith("/taskmanagement") || cleanPath.startsWith("/tasks")) {
      return { environment, application: "taskmanagement", hostname };
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

  // Explicitly reject admin.orviohub.* - separate isolated project
  if (sub === "admin") throw new UnknownHostError(hostname);

  const normalizedSub = normalizeSubdomain(sub);

  if (normalizedSub === "accounts") return { environment, application: "accounts", hostname };
  if (normalizedSub === "home") return { environment, application: "home", hostname };
  if (normalizedSub === "inventory") return { environment, application: "inventory", hostname };
  if (normalizedSub === "billing") return { environment, application: "billing", hostname };
  if (normalizedSub === "taskmanagement") return { environment, application: "taskmanagement", hostname };

  const match = Object.values(applications).find(
    (a) => a.enabled && a.subdomain !== "" && (a.subdomain === normalizedSub || a.subdomain === sub)
  );

  if (!match) throw new UnknownHostError(hostname);

  return { environment, application: match.key, hostname };
}

