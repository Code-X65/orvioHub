/**
 * Centralized Application Registry & Environment-Aware Domain Resolver for Orviohub
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
    developmentUrl: 'http://api.orviohub.localhost:3000',
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

export const ALLOWED_CORS_ORIGINS = [
  // Production
  'https://orviohub.com',
  'https://accounts.orviohub.com',
  'https://app.orviohub.com',
  'https://inventory.orviohub.com',
  'https://taskmanagement.orviohub.com',
  // Development Subdomains
  'http://orviohub.localhost:5173',
  'http://accounts.orviohub.localhost:5173',
  'http://app.orviohub.localhost:5173',
  'http://inventory.orviohub.localhost:5173',
  'http://taskmanagement.orviohub.localhost:5173',
  'http://orviohub.localhost:3000',
  'http://accounts.orviohub.localhost:3000',
  'http://app.orviohub.localhost:3000',
  'http://inventory.orviohub.localhost:3000',
  'http://taskmanagement.orviohub.localhost:3000',
  // Localhost aliases
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:4000',
  'http://accounts.localhost:5173',
  'http://app.localhost:5173',
  'http://inventory.localhost:5173',
  'http://taskmanagement.localhost:5173',
];

/**
 * Resolves application identity and environment from a request hostname and optional port
 */
export function resolveHostContext(
  rawHost: string,
  envOverride?: Environment
): HostContext {
  const env: Environment =
    envOverride ||
    ((process.env.NODE_ENV as Environment) === 'production'
      ? 'production'
      : (process.env.NODE_ENV as Environment) === 'test'
      ? 'test'
      : 'development');

  if (!rawHost) {
    return {
      environment: env,
      application: 'marketing',
      hostname: 'localhost',
      mode: 'subdomain',
    };
  }

  // Normalize host: lowercase and separate port
  const hostLower = rawHost.toLowerCase().trim();
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

    // Explicit rejection: unknown subdomains (including workspace-like subdomains) are rejected
    throw new Error(`Unknown or unauthorized subdomain: ${hostname}`);
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

  // Default fallback
  return {
    environment: env,
    application: 'marketing',
    hostname,
    port,
    mode: 'subdomain',
  };
}

/**
 * URL Helper Functions
 */
export function getApplicationUrl(
  appKey: ApplicationKey,
  environment: Environment = 'development',
  path = ''
): string {
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  const app = APPLICATIONS[appKey];
  if (!app) throw new Error(`Invalid application key: ${appKey}`);

  if (environment === 'production') {
    return `${app.productionUrl}${cleanPath}`;
  }
  return `${app.developmentUrl}${cleanPath}`;
}

export function getAccountsUrl(environment: Environment = 'development', path = ''): string {
  return getApplicationUrl('accounts', environment, path);
}

export function getLauncherUrl(environment: Environment = 'development', path = ''): string {
  return getApplicationUrl('launcher', environment, path);
}

export function getApiUrl(environment: Environment = 'development', path = ''): string {
  return getApplicationUrl('api', environment, path);
}

export function getLoginUrl(returnTo?: string, environment: Environment = 'development'): string {
  const base = getAccountsUrl(environment, '/login');
  if (!returnTo) return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getWorkspaceDashboardUrl(
  appKey: ApplicationKey,
  workspaceId?: string,
  environment: Environment = 'development'
): string {
  const basePath = workspaceId ? `/workspaces/${workspaceId}/dashboard` : '/dashboard';
  return getApplicationUrl(appKey, environment, basePath);
}

export function getInvitationUrl(token: string, environment: Environment = 'development'): string {
  return getAccountsUrl(environment, `/invite/${encodeURIComponent(token)}`);
}

/**
 * Strict Return-To URL validation preventing open redirects
 */
export function isValidReturnUrl(returnUrl: string, environment: Environment = 'development'): boolean {
  if (!returnUrl) return false;

  // Relative paths are always allowed on the same host
  if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(returnUrl);
    const host = parsed.hostname.toLowerCase();

    if (environment === 'production') {
      return ALLOWED_RETURN_HOSTS_PROD.includes(host);
    }
    return ALLOWED_RETURN_HOSTS_DEV.includes(host);
  } catch {
    return false;
  }
}
