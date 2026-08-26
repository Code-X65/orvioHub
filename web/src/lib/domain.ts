/**
 * Centralized Application Registry & Environment-Aware Domain Resolver for Orviohub Frontend
 *
 * Core Domain Rule:
 * Organizations and workspaces NEVER use subdomains.
 * Only platform services and applications use subdomains.
 */

export type Environment = 'development' | 'test' | 'staging' | 'production';

export type ApplicationKey =
  | 'marketing'
  | 'accounts'
  | 'launcher'
  | 'inventory'
  | 'taskmanagement'
  | 'api';

export interface ApplicationDefinition {
  key: ApplicationKey;
  name: string;
  subdomain: string;
  developmentSubdomain: string;
  productionUrl: string;
  developmentUrl: string;
  fallbackPort: number;
  enabled: boolean;
}

export interface HostContext {
  environment: Environment;
  application: ApplicationKey;
  hostname: string;
  port?: number;
  mode: 'subdomain' | 'port' | 'production';
}

export const ROOT_DOMAIN = 'orviohub.com';
export const DEV_ROOT_DOMAIN = 'orviohub.localhost';

export const APPLICATIONS: Record<ApplicationKey, ApplicationDefinition> = {
  marketing: {
    key: 'marketing',
    name: 'Orviohub Platform',
    subdomain: '',
    developmentSubdomain: 'orviohub.localhost',
    productionUrl: 'https://orviohub.com',
    developmentUrl: 'http://orviohub.localhost:5173',
    fallbackPort: 3000,
    enabled: true,
  },
  accounts: {
    key: 'accounts',
    name: 'Orviohub Accounts',
    subdomain: 'accounts',
    developmentSubdomain: 'accounts.orviohub.localhost',
    productionUrl: 'https://accounts.orviohub.com',
    developmentUrl: 'http://accounts.orviohub.localhost:5173',
    fallbackPort: 3001,
    enabled: true,
  },
  launcher: {
    key: 'launcher',
    name: 'Orviohub App Launcher',
    subdomain: 'app',
    developmentSubdomain: 'app.orviohub.localhost',
    productionUrl: 'https://app.orviohub.com',
    developmentUrl: 'http://app.orviohub.localhost:5173',
    fallbackPort: 3002,
    enabled: true,
  },
  inventory: {
    key: 'inventory',
    name: 'Inventory & POS',
    subdomain: 'inventory',
    developmentSubdomain: 'inventory.orviohub.localhost',
    productionUrl: 'https://inventory.orviohub.com',
    developmentUrl: 'http://inventory.orviohub.localhost:5173',
    fallbackPort: 3003,
    enabled: true,
  },
  taskmanagement: {
    key: 'taskmanagement',
    name: 'Task Management',
    subdomain: 'taskmanagement',
    developmentSubdomain: 'taskmanagement.orviohub.localhost',
    productionUrl: 'https://taskmanagement.orviohub.com',
    developmentUrl: 'http://taskmanagement.orviohub.localhost:5173',
    fallbackPort: 3004,
    enabled: true,
  },
  api: {
    key: 'api',
    name: 'Orviohub Central API',
    subdomain: 'api',
    developmentSubdomain: 'api.orviohub.localhost',
    productionUrl: 'https://api.orviohub.com',
    developmentUrl: 'http://localhost:3000',
    fallbackPort: 4000,
    enabled: true,
  },
};

export const ALLOWED_RETURN_HOSTS_PROD = [
  'orviohub.com',
  'accounts.orviohub.com',
  'app.orviohub.com',
  'inventory.orviohub.com',
  'taskmanagement.orviohub.com',
];

export const ALLOWED_RETURN_HOSTS_DEV = [
  'orviohub.localhost',
  'accounts.orviohub.localhost',
  'app.orviohub.localhost',
  'inventory.orviohub.localhost',
  'taskmanagement.orviohub.localhost',
  'localhost',
  '127.0.0.1',
  'accounts.localhost',
  'app.localhost',
  'inventory.localhost',
  'taskmanagement.localhost',
];

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

export function getCurrentEnvironment(): Environment {
  if (typeof window === 'undefined') return 'development';
  const host = window.location.hostname;
  if (host.includes('orviohub.com')) return 'production';
  return 'development';
}

/**
 * Resolves HostContext from current browser window.location or provided hostname
 */
export function resolveHostContext(rawHost?: string): HostContext {
  const host = rawHost || (typeof window !== 'undefined' ? window.location.host : 'localhost:5173');
  const env = getCurrentEnvironment();
  const hostLower = host.toLowerCase().trim();
  const [hostname, portStr] = hostLower.split(':');
  const port = portStr ? parseInt(portStr, 10) : undefined;

  // 1. Port-based fallback matching
  if (port) {
    for (const app of Object.values(APPLICATIONS)) {
      if (app.fallbackPort === port) {
        return {
          environment: env,
          application: app.key,
          hostname,
          port,
          mode: 'port',
        };
      }
    }
  }

  // 2. Production Domain Matching (*.orviohub.com or orviohub.com)
  if (hostname.endsWith(ROOT_DOMAIN)) {
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      return { environment: 'production', application: 'marketing', hostname, port, mode: 'production' };
    }
    const sub = hostname.replace(`.${ROOT_DOMAIN}`, '');
    if (sub === 'accounts') return { environment: 'production', application: 'accounts', hostname, port, mode: 'production' };
    if (sub === 'app') return { environment: 'production', application: 'launcher', hostname, port, mode: 'production' };
    if (sub === 'inventory') return { environment: 'production', application: 'inventory', hostname, port, mode: 'production' };
    if (sub === 'taskmanagement') return { environment: 'production', application: 'taskmanagement', hostname, port, mode: 'production' };
    if (sub === 'api') return { environment: 'production', application: 'api', hostname, port, mode: 'production' };

    throw new Error(`Unknown subdomain: ${hostname}`);
  }

  // 3. Development Subdomain Matching (*.orviohub.localhost or *.localhost)
  if (hostname.endsWith('orviohub.localhost') || hostname.endsWith('.localhost') || hostname === 'localhost' || hostname === '127.0.0.1') {
    if (hostname === 'orviohub.localhost' || hostname === 'localhost' || hostname === '127.0.0.1') {
      return { environment: env, application: 'marketing', hostname, port, mode: 'subdomain' };
    }

    let sub = hostname;
    if (sub.endsWith('.orviohub.localhost')) {
      sub = sub.replace('.orviohub.localhost', '');
    } else if (sub.endsWith('.localhost')) {
      sub = sub.replace('.localhost', '');
    }

    if (sub === 'accounts') return { environment: env, application: 'accounts', hostname, port, mode: 'subdomain' };
    if (sub === 'app') return { environment: env, application: 'launcher', hostname, port, mode: 'subdomain' };
    if (sub === 'inventory') return { environment: env, application: 'inventory', hostname, port, mode: 'subdomain' };
    if (sub === 'taskmanagement') return { environment: env, application: 'taskmanagement', hostname, port, mode: 'subdomain' };
    if (sub === 'api') return { environment: env, application: 'api', hostname, port, mode: 'subdomain' };

    throw new Error(`Unknown development subdomain: ${hostname}`);
  }

  return {
    environment: env,
    application: 'marketing',
    hostname,
    port,
    mode: 'subdomain',
  };
}

export function getCurrentSubdomain(): ApplicationKey {
  try {
    const ctx = resolveHostContext();
    return ctx.application;
  } catch {
    return 'marketing';
  }
}

/**
 * URL Helpers for Frontend Application
 */
export function getApplicationUrl(
  appKey: ApplicationKey,
  path = '',
  envOverride?: Environment
): string {
  const env = envOverride || getCurrentEnvironment();
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  const app = APPLICATIONS[appKey];
  if (!app) throw new Error(`Invalid application key: ${appKey}`);

  if (env === 'production') {
    return `${app.productionUrl}${cleanPath}`;
  }
  return `${app.developmentUrl}${cleanPath}`;
}

export function getAccountsUrl(path = '', envOverride?: Environment): string {
  return getApplicationUrl('accounts', path, envOverride);
}

export function getLauncherUrl(path = '', envOverride?: Environment): string {
  return getApplicationUrl('launcher', path, envOverride);
}

export function getApiUrl(path = '', envOverride?: Environment): string {
  return getApplicationUrl('api', path, envOverride);
}

export function getLoginUrl(returnTo?: string, envOverride?: Environment): string {
  const base = getAccountsUrl('/login', envOverride);
  if (!returnTo) return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getWorkspaceDashboardUrl(
  appKey: ApplicationKey,
  workspaceId?: string,
  envOverride?: Environment
): string {
  const basePath = workspaceId ? `/workspaces/${workspaceId}/dashboard` : '/dashboard';
  return getApplicationUrl(appKey, basePath, envOverride);
}

export function getInvitationUrl(token: string, envOverride?: Environment): string {
  return getAccountsUrl(`/invite/${encodeURIComponent(token)}`, envOverride);
}

export function isValidReturnUrl(returnUrl: string, envOverride?: Environment): boolean {
  if (!returnUrl) return false;
  if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) return true;

  try {
    const parsed = new URL(returnUrl);
    const host = parsed.hostname.toLowerCase();
    const env = envOverride || getCurrentEnvironment();

    if (env === 'production') {
      return ALLOWED_RETURN_HOSTS_PROD.includes(host);
    }
    return ALLOWED_RETURN_HOSTS_DEV.includes(host);
  } catch {
    return false;
  }
}

/**
 * Backward compatibility aliases for existing components
 */
export type ProductApp = ApplicationKey;
export const getAppUrl = getApplicationUrl;
export const getDisplayUrl = (appKey: ApplicationKey | string, path = ''): string => {
  const cleanAppKey = appKey === 'app' ? 'launcher' : (appKey as ApplicationKey);
  try {
    return getApplicationUrl(cleanAppKey, path);
  } catch {
    return path || '/';
  }
};

