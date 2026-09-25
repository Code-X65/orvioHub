import { convex } from "./convex";
import { anyApi } from "convex/server";

export interface PlatformApplication {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  status: "active" | "coming_soon" | "maintenance" | "deprecated";
  isCore: boolean;
  planRequirements: string[];
  subdomain: string;
  icon?: string;
  description?: string;
  badge?: string;
  displayOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export const adminApplicationsApi = {
  async listApplications(): Promise<PlatformApplication[]> {
    try {
      const apps = await convex.query(anyApi.platformApplications.list, {});
      if (apps && apps.length > 0) {
        return apps;
      }
    } catch {
      // Fallback
    }

    return [
      {
        key: "inventory",
        name: "Inventory",
        status: "active",
        isCore: true,
        planRequirements: ["free_trial", "standard", "premium", "enterprise"],
        subdomain: "inventory",
        description: "Full inventory management: stock tracking, purchases, sales POS, and reports.",
        badge: "Flagship",
      },
      {
        key: "pos",
        name: "POS Terminal",
        status: "coming_soon",
        isCore: false,
        planRequirements: ["standard", "premium", "enterprise"],
        subdomain: "inventory",
        description: "Point-of-sale terminal with receipts, cash management, and shift reports.",
        badge: "Coming Soon",
      },
      {
        key: "booking",
        name: "Booking & Appointments",
        status: "coming_soon",
        isCore: false,
        planRequirements: ["standard", "premium", "enterprise"],
        subdomain: "home",
        description: "Appointment and reservation management with automated reminders.",
        badge: "Coming Soon",
      },
      {
        key: "gym",
        name: "Gym Management",
        status: "coming_soon",
        isCore: false,
        planRequirements: ["standard", "premium", "enterprise"],
        subdomain: "home",
        description: "Membership management, class scheduling, and trainer assignment.",
        badge: "Coming Soon",
      },
      {
        key: "taskmanagement",
        name: "Task Management",
        status: "coming_soon",
        isCore: false,
        planRequirements: ["standard", "premium", "enterprise"],
        subdomain: "taskmanagement",
        description: "Team task tracking, assignments, and workflow boards.",
        badge: "Coming Soon",
      },
      {
        key: "billing",
        name: "Billing & Subscriptions",
        status: "active",
        isCore: true,
        planRequirements: ["standard", "premium", "enterprise"],
        subdomain: "billing",
        description: "Subscription billing, invoicing, and payment management.",
      },
      {
        key: "home",
        name: "Orviohub Home",
        status: "active",
        isCore: true,
        planRequirements: [],
        subdomain: "home",
        description: "Main application hub for managing your business.",
      },
      {
        key: "accounts",
        name: "Orviohub Accounts",
        status: "active",
        isCore: true,
        planRequirements: [],
        subdomain: "account",
        description: "User account and identity management.",
      },
      {
        key: "launcher",
        name: "Orviohub App Launcher",
        status: "active",
        isCore: true,
        planRequirements: [],
        subdomain: "app",
        description: "Application launcher and workspace selector.",
      },
      {
        key: "marketing",
        name: "Orviohub",
        status: "active",
        isCore: true,
        planRequirements: [],
        subdomain: "",
        description: "Marketing and public-facing site.",
      },
    ];
  },

  async getByKey(key: string): Promise<PlatformApplication | null> {
    try {
      return await convex.query(anyApi.platformApplications.getByKey, { key });
    } catch {
      const apps = await this.listApplications();
      return apps.find((a) => a.key.toLowerCase() === key.toLowerCase()) || null;
    }
  },

  async createApplication(sessionToken: string, data: {
    key: string;
    name: string;
    status: "active" | "coming_soon" | "maintenance" | "deprecated";
    isCore: boolean;
    planRequirements: string[];
    subdomain: string;
    description?: string;
    badge?: string;
    displayOrder?: number;
  }) {
    return await convex.mutation(anyApi.platformApplications.create, { sessionToken, ...data });
  },

  async updateApplication(
    sessionToken: string,
    key: string,
    updates: {
      name?: string;
      status?: "active" | "coming_soon" | "maintenance" | "deprecated";
      isCore?: boolean;
      planRequirements?: string[];
      subdomain?: string;
      description?: string;
      badge?: string;
      displayOrder?: number;
    }
  ) {
    return await convex.mutation(anyApi.platformApplications.update, { sessionToken, key, updates });
  },

  async deleteApplication(sessionToken: string, key: string) {
    return await convex.mutation(anyApi.platformApplications.remove, { sessionToken, key });
  },
};
