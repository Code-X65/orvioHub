/**
 * Cross-Subdomain Storage Helper
 * Keeps active workspace, active branch, and session pointers synchronized
 * across subdomains (.orviohub.localhost and .orviohub.com) using wildcard cookies + localStorage.
 */

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

  // 1. Check localStorage first for instant local hit
  try {
    const localVal = localStorage.getItem(key);
    if (localVal) return localVal;
  } catch {}

  // 2. Fall back to reading from document.cookie (cross-subdomain synced)
  try {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
      const [k, ...vParts] = cookie.split('=');
      if (decodeURIComponent(k.trim()) === key) {
        const value = decodeURIComponent(vParts.join('='));
        // Cache back to this origin's localStorage for speed
        try {
          localStorage.setItem(key, value);
        } catch {}
        return value;
      }
    }
  } catch {}

  return null;
}

export function setCrossSubdomainItem(key: string, value: string, maxAgeDays = 30): void {
  if (typeof window === 'undefined') return;

  // 1. Write to localStorage
  try {
    localStorage.setItem(key, value);
  } catch {}

  // 2. Write to wildcard document.cookie for cross-subdomain sharing
  try {
    const domain = getRootCookieDomain();
    const domainAttr = domain ? `; domain=${domain}` : '';
    const maxAgeSecs = maxAgeDays * 24 * 60 * 60;
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/${domainAttr}; max-age=${maxAgeSecs}; SameSite=Lax${isSecure}`;
  } catch {}
}

export function removeCrossSubdomainItem(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {}

  try {
    const domain = getRootCookieDomain();
    const domainAttr = domain ? `; domain=${domain}` : '';
    document.cookie = `${encodeURIComponent(key)}=; path=/${domainAttr}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    // Also clear host-only cookie
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  } catch {}
}
