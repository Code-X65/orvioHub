import { dataService, hashSessionToken } from '../dataService.js';

/**
 * Central server-side session boundary.  It intentionally returns identity
 * inputs only; organization roles and permissions remain the authorization
 * plugin's responsibility.
 */
export async function resolveBrowserSession(sessionSecret: string) {
  const session = await dataService.getSessionBySecret(sessionSecret);
  if (!session) return null;

  const now = Date.now();
  if (
    session.isRevoked ||
    session.revokedAt ||
    session.expiresAt <= now ||
    (session.absoluteExpiresAt && session.absoluteExpiresAt <= now)
  ) {
    return null;
  }

  const user = await dataService.getUserById(session.userId);
  if (!user || ['SUSPENDED', 'suspended', 'INACTIVE', 'inactive', 'DELETED', 'deleted'].includes(String(user.status))) {
    return null;
  }
  if (session.tokenVersion !== (user.tokenVersion ?? 0)) return null;

  return { session, user };
}

export async function revokeBrowserSession(sessionSecret: string, reason = 'USER_LOGOUT') {
  if (!sessionSecret) return { success: true };
  return dataService.revokeSession(sessionSecret);
}

export const sessionSecretHash = hashSessionToken;
