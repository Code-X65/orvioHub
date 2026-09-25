/**
 * Cross-Subdomain Storage Helper
 * Keeps active workspace, active branch, and session pointers synchronized
 * across subdomains (.orviohub.localhost and .orviohub.com) using non-HttpOnly wildcard cookies.
 * Redundant localStorage caching has been eliminated to reduce client-side data exfiltration attack surface.
 */

// In-memory cache to avoid repeated synchronous document.cookie reads on render loops
const memoryCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds — safe for cross-subdomain cookies

/**
 * Detects whether cookies are enabled and accessible in the current browser context.
 */
export function areCookiesEnabled(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  if (navigator.cookieEnabled === false) return false;
  try {
    const testKey = '__orvio_cookie_test__';
    document.cookie = `${testKey}=1; SameSite=Lax`;
    const supported = document.cookie.includes(testKey);
    document.cookie = `${testKey}=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    return supported;
  } catch {
    return false;
  }
}

export function getRootCookieDomain(): string {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.endsWith('.orviohub.localhost') || hostname === 'orviohub.localhost') {
    return '.orviohub.localhost';
  }
  if (hostname.endsWith('.orviohub.com') || hostname === 'orviohub.com') {
    return '.orviohub.com';
  }
  return '';
}

export function getCrossSubdomainItem(key: string): string | null {
  if (typeof window === 'undefined') return null;

  const now = Date.now();
  const cached = memoryCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  // Read strictly from document.cookie (cross-subdomain synced)
  try {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
      const [k, ...vParts] = cookie.split('=');
      if (decodeURIComponent(k.trim()) === key) {
        const value = decodeURIComponent(vParts.join('='));
        memoryCache.set(key, { value, timestamp: now });
        return value;
      }
    }
  } catch {}

  return null;
}

/**
 * Batched reader for multiple cross-subdomain cookie keys in a single document.cookie traversal.
 */
export function getAllCrossSubdomainItems(keys: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const now = Date.now();
  let needsRead = false;

  for (const key of keys) {
    const cached = memoryCache.get(key);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      result[key] = cached.value;
    } else {
      needsRead = true;
      result[key] = null;
    }
  }

  if (needsRead && typeof window !== 'undefined') {
    try {
      const cookies = document.cookie ? document.cookie.split('; ') : [];
      for (const cookie of cookies) {
        const [k, ...vParts] = cookie.split('=');
        const decodedKey = decodeURIComponent(k.trim());
        if (keys.includes(decodedKey)) {
          const value = decodeURIComponent(vParts.join('='));
          memoryCache.set(decodedKey, { value, timestamp: now });
          result[decodedKey] = value;
        }
      }
    } catch {}
  }

  return result;
}

export function setCrossSubdomainItem(key: string, value: string, maxAgeDays = 30): void {
  if (typeof window === 'undefined') return;

  // Update in-memory cache instantly
  memoryCache.set(key, { value, timestamp: Date.now() });

  // Write to wildcard document.cookie non-blockingly
  const writeCookie = () => {
    try {
      const domain = getRootCookieDomain();
      const domainAttr = domain ? `; domain=${domain}` : '';
      const maxAgeSecs = maxAgeDays * 24 * 60 * 60;
      const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/${domainAttr}; max-age=${maxAgeSecs}; SameSite=Lax${isSecure}`;
    } catch {}
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(writeCookie);
  } else {
    writeCookie();
  }
}

export function removeCrossSubdomainItem(key: string): void {
  if (typeof window === 'undefined') return;

  memoryCache.delete(key);

  const clearCookie = () => {
    try {
      const domain = getRootCookieDomain();
      const domainAttr = domain ? `; domain=${domain}` : '';
      document.cookie = `${encodeURIComponent(key)}=; path=/${domainAttr}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      // Also clear host-only cookie
      document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    } catch {}
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(clearCookie);
  } else {
    clearCookie();
  }
}


