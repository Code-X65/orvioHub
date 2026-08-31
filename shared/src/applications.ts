export type ApplicationKey =
  | "marketing"
  | "accounts"
  | "home"
  | "launcher"
  | "inventory"
  | "taskmanagement";

export type ApplicationDefinition = {
  key: ApplicationKey;
  name: string;
  subdomain: string; // "" for the root marketing domain
  productionUrl: string;
  preproductionUrl?: string;
  developmentUrl: string;
  enabled: boolean;
};

export const DEV_ROOT = "orviohub.localhost";
export const PREPROD_ROOT = "preprod.orviohub.com";
export const PROD_ROOT = "orviohub.com";
export const DEV_PORT = 4000;

export const applications: Record<ApplicationKey, ApplicationDefinition> = {
  marketing: {
    key: "marketing",
    name: "Orviohub",
    subdomain: "",
    productionUrl: "https://orviohub.com",
    preproductionUrl: "https://preprod.orviohub.com",
    developmentUrl: "http://orviohub.localhost:4000",
    enabled: true,
  },
  accounts: {
    key: "accounts",
    name: "Orviohub Accounts",
    subdomain: "accounts",
    productionUrl: "https://accounts.orviohub.com",
    preproductionUrl: "https://accounts.preprod.orviohub.com",
    developmentUrl: "http://accounts.orviohub.localhost:4000",
    enabled: true,
  },
  home: {
    key: "home",
    name: "Orviohub Home",
    subdomain: "home",
    productionUrl: "https://home.orviohub.com",
    preproductionUrl: "https://home.preprod.orviohub.com",
    developmentUrl: "http://home.orviohub.localhost:4000",
    enabled: true,
  },
  launcher: {
    key: "launcher",
    name: "Orviohub App Launcher",
    subdomain: "app",
    productionUrl: "https://app.orviohub.com",
    preproductionUrl: "https://app.preprod.orviohub.com",
    developmentUrl: "http://app.orviohub.localhost:4000",
    enabled: true,
  },
  inventory: {
    key: "inventory",
    name: "Inventory",
    subdomain: "inventory",
    productionUrl: "https://inventory.orviohub.com",
    preproductionUrl: "https://inventory.preprod.orviohub.com",
    developmentUrl: "http://inventory.orviohub.localhost:4000",
    enabled: true,
  },
  taskmanagement: {
    key: "taskmanagement",
    name: "Task Management",
    subdomain: "taskmanagement",
    productionUrl: "https://taskmanagement.orviohub.com",
    preproductionUrl: "https://taskmanagement.preprod.orviohub.com",
    developmentUrl: "http://taskmanagement.orviohub.localhost:4000",
    enabled: true,
  },
};
