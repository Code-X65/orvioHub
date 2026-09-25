export const KNOWN_PLAN_KEYS = ["free_trial", "standard", "premium", "enterprise", "free"];
export const DEV_ROOT = "orviohub.localhost";
export const PREPROD_ROOT = "preprod.orviohub.com";
export const PROD_ROOT = "orviohub.com";
export const DEV_PORT = 3000;
function getEnvVar(key) {
    const globalObj = globalThis;
    if (typeof globalObj.process !== "undefined" && globalObj.process?.env && globalObj.process.env[key]) {
        return globalObj.process.env[key];
    }
    try {
        // @ts-ignore
        if (typeof import.meta !== "undefined" && import.meta?.env) {
            // @ts-ignore
            return import.meta.env[`VITE_${key}`] || import.meta.env[key];
        }
    }
    catch { }
    return undefined;
}
export function resolveDevUrl(subdomain, fallbackPath = "") {
    const host = subdomain ? `${subdomain}.${DEV_ROOT}` : DEV_ROOT;
    const path = fallbackPath ? (fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`) : "";
    // Check explicit environment variables
    if (subdomain === "" && getEnvVar("BASE_URL_MARKETING")) {
        return `${getEnvVar("BASE_URL_MARKETING").replace(/\/$/, "")}${path}`;
    }
    if ((subdomain === "account" || subdomain === "accounts") && getEnvVar("BASE_URL_ACCOUNT")) {
        return `${getEnvVar("BASE_URL_ACCOUNT").replace(/\/$/, "")}${path}`;
    }
    if ((subdomain === "home" || subdomain === "app") && getEnvVar("BASE_URL_HOME")) {
        return `${getEnvVar("BASE_URL_HOME").replace(/\/$/, "")}${path}`;
    }
    if ((subdomain === "inventory" || subdomain === "pos") && getEnvVar("BASE_URL_INVENTORY")) {
        return `${getEnvVar("BASE_URL_INVENTORY").replace(/\/$/, "")}${path}`;
    }
    // Preserve runtime browser port if in browser
    let port = DEV_PORT;
    const globalObj = globalThis;
    if (typeof globalObj.window !== "undefined" && globalObj.window.location?.port) {
        const p = parseInt(globalObj.window.location.port, 10);
        if (!isNaN(p))
            port = p;
    }
    return `http://${host}:${port}${path}`;
}
export const applications = {
    marketing: {
        key: "marketing",
        name: "Orviohub",
        type: "subdomain",
        subdomain: "",
        productionUrl: "https://orviohub.com",
        preproductionUrl: "https://preprod.orviohub.com",
        developmentUrl: resolveDevUrl(""),
        enabled: true,
        status: "available",
        availability: "available",
        isVisibleToUsers: true,
        isActivatable: false,
        description: "Public marketing website and enterprise product portal.",
        iconName: "Globe",
        planRequirements: [],
        displayOrder: 100,
    },
    accounts: {
        key: "accounts",
        name: "Orviohub Accounts",
        type: "subdomain",
        subdomain: "account",
        productionUrl: "https://accounts.orviohub.com",
        preproductionUrl: "https://accounts.preprod.orviohub.com",
        developmentUrl: resolveDevUrl("account"),
        enabled: true,
        status: "available",
        availability: "available",
        isVisibleToUsers: true,
        isActivatable: false,
        description: "Identity, authentication, and user profile management.",
        iconName: "Shield",
        planRequirements: [],
        displayOrder: 101,
    },
    home: {
        key: "home",
        name: "Orviohub Home",
        type: "subdomain",
        subdomain: "home",
        productionUrl: "https://home.orviohub.com",
        preproductionUrl: "https://home.preprod.orviohub.com",
        developmentUrl: resolveDevUrl("home"),
        enabled: true,
        status: "available",
        availability: "available",
        isVisibleToUsers: true,
        isActivatable: false,
        description: "Unified organization workspace and administration dashboard.",
        iconName: "LayoutGrid",
        planRequirements: [],
        displayOrder: 102,
    },
    launcher: {
        key: "launcher",
        name: "Orviohub App Launcher",
        type: "subdomain",
        subdomain: "app",
        productionUrl: "https://app.orviohub.com",
        preproductionUrl: "https://app.preprod.orviohub.com",
        developmentUrl: resolveDevUrl("app"),
        enabled: true,
        status: "available",
        availability: "available",
        isVisibleToUsers: true,
        isActivatable: false,
        description: "Enterprise application switcher and discovery portal.",
        iconName: "Rocket",
        planRequirements: [],
        displayOrder: 103,
    },
    inventory: {
        key: "inventory",
        name: "Inventory",
        type: "subdomain",
        subdomain: "inventory",
        productionUrl: "https://inventory.orviohub.com",
        preproductionUrl: "https://inventory.preprod.orviohub.com",
        developmentUrl: resolveDevUrl("inventory"),
        enabled: true,
        status: "available",
        availability: "available",
        isVisibleToUsers: true,
        isActivatable: true,
        description: "Full inventory management: stock tracking, purchases, sales POS, and reports.",
        badge: "Flagship",
        planRequirements: ["free_trial", "standard", "premium", "enterprise"],
        iconName: "Boxes",
        displayOrder: 1,
    },
    pos: {
        key: "pos",
        name: "Point of Sale",
        type: "path",
        subdomain: "inventory",
        path: "/pos",
        productionUrl: "https://inventory.orviohub.com/pos",
        preproductionUrl: "https://inventory.preprod.orviohub.com/pos",
        developmentUrl: resolveDevUrl("inventory", "/pos"),
        enabled: false,
        status: "coming_soon",
        availability: "coming_soon",
        isVisibleToUsers: false,
        isActivatable: false,
        description: "Point-of-sale terminal with receipts, cash management, and shift reports.",
        planRequirements: ["standard", "premium", "enterprise"],
        iconName: "ShoppingCart",
        displayOrder: 2,
    },
    booking: {
        key: "booking",
        name: "Booking & Appointments",
        type: "path",
        subdomain: "home",
        path: "/apps/booking",
        productionUrl: "https://home.orviohub.com/apps/booking",
        preproductionUrl: "https://home.preprod.orviohub.com/apps/booking",
        developmentUrl: resolveDevUrl("home", "/apps/booking"),
        enabled: false,
        status: "coming_soon",
        availability: "coming_soon",
        isVisibleToUsers: false,
        isActivatable: false,
        description: "Appointment and reservation management with automated reminders.",
        planRequirements: ["standard", "premium", "enterprise"],
        iconName: "Calendar",
        displayOrder: 3,
    },
    gym: {
        key: "gym",
        name: "Gym Management",
        type: "path",
        subdomain: "home",
        path: "/apps/gym",
        productionUrl: "https://home.orviohub.com/apps/gym",
        preproductionUrl: "https://home.preprod.orviohub.com/apps/gym",
        developmentUrl: resolveDevUrl("home", "/apps/gym"),
        enabled: false,
        status: "coming_soon",
        availability: "coming_soon",
        isVisibleToUsers: false,
        isActivatable: false,
        description: "Membership management, class scheduling, and trainer assignment.",
        planRequirements: ["standard", "premium", "enterprise"],
        iconName: "Dumbbell",
        displayOrder: 4,
    },
    billing: {
        key: "billing",
        name: "Billing & Subscriptions",
        type: "subdomain",
        subdomain: "billing",
        productionUrl: "https://billing.orviohub.com",
        preproductionUrl: "https://billing.preprod.orviohub.com",
        developmentUrl: resolveDevUrl("billing"),
        enabled: true,
        status: "available",
        availability: "available",
        isVisibleToUsers: true,
        isActivatable: false,
        description: "Subscription billing, invoicing, and payment management.",
        planRequirements: ["standard", "premium", "enterprise"],
        iconName: "CreditCard",
        displayOrder: 5,
    },
    taskmanagement: {
        key: "taskmanagement",
        name: "Task Management",
        type: "subdomain",
        subdomain: "taskmanagement",
        productionUrl: "https://taskmanagement.orviohub.com",
        preproductionUrl: "https://taskmanagement.preprod.orviohub.com",
        developmentUrl: resolveDevUrl("taskmanagement"),
        enabled: false,
        status: "coming_soon",
        availability: "coming_soon",
        isVisibleToUsers: false,
        isActivatable: false,
        description: "Team task tracking, assignments, and workflow boards.",
        planRequirements: ["standard", "premium", "enterprise"],
        iconName: "ClipboardList",
        displayOrder: 6,
    },
};
/**
 * Serialized JSON representation of the canonical applications configuration.
 * Consumed across client and build-time tooling to guarantee single-source integrity.
 */
export const applicationsJson = JSON.stringify(applications, null, 2);
/**
 * Ordered list of all user-facing application keys.
 */
export const USER_FACING_APP_KEYS = [
    "inventory",
    "pos",
    "booking",
    "gym",
    "billing",
    "taskmanagement",
];
/**
 * Retrieves an application definition by key (case-insensitive).
 */
export function getApplication(key) {
    return applications[key.toLowerCase()];
}
//# sourceMappingURL=applications.js.map