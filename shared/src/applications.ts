export type ApplicationKey =
  | "marketing"
  | "accounts"
  | "home"
  | "launcher"
  | "inventory"
  | "pos"
  | "booking"
  | "gym"
  | "billing"
  | "taskmanagement"
  | "task_management";

export type ApplicationStatus = "available" | "coming_soon" | "disabled";

export type ApplicationDefinition = {
  key: ApplicationKey;
  name: string;
  subdomain: string; // "" for the root marketing domain
  productionUrl: string;
  preproductionUrl?: string;
  developmentUrl: string;
  enabled: boolean;
  status: ApplicationStatus;
  isVisibleToUsers: boolean;
  isActivatable: boolean;
};

export const DEV_ROOT = "orviohub.localhost";
export const PREPROD_ROOT = "preprod.orviohub.com";
export const PROD_ROOT = "orviohub.com";
export const DEV_PORT = 3000;

function getEnvVar(key: string): string | undefined {
  const globalObj = globalThis as any;
  if (typeof globalObj.process !== "undefined" && globalObj.process?.env && globalObj.process.env[key]) {
    return globalObj.process.env[key];
  }
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta?.env) {
      // @ts-ignore
      return import.meta.env[`VITE_${key}`] || import.meta.env[key];
    }
  } catch {}
  return undefined;
}

export function resolveDevUrl(subdomain: string, fallbackPath = ""): string {
  const host = subdomain ? `${subdomain}.${DEV_ROOT}` : DEV_ROOT;
  const path = fallbackPath ? (fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`) : "";
  // Check explicit environment variables
  if (subdomain === "" && getEnvVar("BASE_URL_MARKETING")) {
    return `${getEnvVar("BASE_URL_MARKETING")!.replace(/\/$/, "")}${path}`;
  }
  if ((subdomain === "account" || subdomain === "accounts") && getEnvVar("BASE_URL_ACCOUNT")) {
    return `${getEnvVar("BASE_URL_ACCOUNT")!.replace(/\/$/, "")}${path}`;
  }
  if ((subdomain === "home" || subdomain === "app") && getEnvVar("BASE_URL_HOME")) {
    return `${getEnvVar("BASE_URL_HOME")!.replace(/\/$/, "")}${path}`;
  }
  if ((subdomain === "inventory" || subdomain === "pos") && getEnvVar("BASE_URL_INVENTORY")) {
    return `${getEnvVar("BASE_URL_INVENTORY")!.replace(/\/$/, "")}${path}`;
  }

  // Preserve runtime browser port if in browser
  let port = DEV_PORT;
  const globalObj = globalThis as any;
  if (typeof globalObj.window !== "undefined" && globalObj.window.location?.port) {
    const p = parseInt(globalObj.window.location.port, 10);
    if (!isNaN(p)) port = p;
  }
  return `http://${host}:${port}${path}`;
}

export const applications: Record<ApplicationKey, ApplicationDefinition> = {
  marketing: {
    key: "marketing",
    name: "Orviohub",
    subdomain: "",
    productionUrl: "https://orviohub.com",
    preproductionUrl: "https://preprod.orviohub.com",
    developmentUrl: resolveDevUrl(""),
    enabled: true,
    status: "available",
    isVisibleToUsers: true,
    isActivatable: false,
  },
  accounts: {
    key: "accounts",
    name: "Orviohub Accounts",
    subdomain: "account",
    productionUrl: "https://accounts.orviohub.com",
    preproductionUrl: "https://accounts.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("account"),
    enabled: true,
    status: "available",
    isVisibleToUsers: true,
    isActivatable: false,
  },
  home: {
    key: "home",
    name: "Orviohub Home",
    subdomain: "home",
    productionUrl: "https://home.orviohub.com",
    preproductionUrl: "https://home.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("home"),
    enabled: true,
    status: "available",
    isVisibleToUsers: true,
    isActivatable: false,
  },
  launcher: {
    key: "launcher",
    name: "Orviohub App Launcher",
    subdomain: "app",
    productionUrl: "https://app.orviohub.com",
    preproductionUrl: "https://app.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("home"),
    enabled: true,
    status: "available",
    isVisibleToUsers: true,
    isActivatable: false,
  },
  inventory: {
    key: "inventory",
    name: "Inventory",
    subdomain: "inventory",
    productionUrl: "https://inventory.orviohub.com",
    preproductionUrl: "https://inventory.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("inventory"),
    enabled: true,
    status: "available",
    isVisibleToUsers: true,
    isActivatable: true,
  },
  pos: {
    key: "pos",
    name: "Point of Sale",
    subdomain: "inventory",
    productionUrl: "https://inventory.orviohub.com/pos",
    preproductionUrl: "https://inventory.preprod.orviohub.com/pos",
    developmentUrl: resolveDevUrl("inventory", "/pos"),
    enabled: false,
    status: "coming_soon",
    isVisibleToUsers: false,
    isActivatable: false,
  },
  booking: {
    key: "booking",
    name: "Booking & Appointments",
    subdomain: "home",
    productionUrl: "https://home.orviohub.com/apps/booking",
    preproductionUrl: "https://home.preprod.orviohub.com/apps/booking",
    developmentUrl: resolveDevUrl("home", "/apps/booking"),
    enabled: false,
    status: "coming_soon",
    isVisibleToUsers: false,
    isActivatable: false,
  },
  gym: {
    key: "gym",
    name: "Gym Management",
    subdomain: "home",
    productionUrl: "https://home.orviohub.com/apps/gym",
    preproductionUrl: "https://home.preprod.orviohub.com/apps/gym",
    developmentUrl: resolveDevUrl("home", "/apps/gym"),
    enabled: false,
    status: "coming_soon",
    isVisibleToUsers: false,
    isActivatable: false,
  },
  billing: {
    key: "billing",
    name: "Billing & Subscriptions",
    subdomain: "billing",
    productionUrl: "https://billing.orviohub.com",
    preproductionUrl: "https://billing.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("billing"),
    enabled: true,
    status: "available",
    isVisibleToUsers: true,
    isActivatable: false,
  },
  taskmanagement: {
    key: "taskmanagement",
    name: "Task Management",
    subdomain: "taskmanagement",
    productionUrl: "https://taskmanagement.orviohub.com",
    preproductionUrl: "https://taskmanagement.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("taskmanagement"),
    enabled: false,
    status: "coming_soon",
    isVisibleToUsers: false,
    isActivatable: false,
  },
  task_management: {
    key: "task_management",
    name: "Task Management",
    subdomain: "taskmanagement",
    productionUrl: "https://taskmanagement.orviohub.com",
    preproductionUrl: "https://taskmanagement.preprod.orviohub.com",
    developmentUrl: resolveDevUrl("taskmanagement"),
    enabled: false,
    status: "coming_soon",
    isVisibleToUsers: false,
    isActivatable: false,
  },
};
