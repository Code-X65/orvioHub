import crypto from 'node:crypto';

interface CacheEntry {
  suffixes: Map<string, number>;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 1000;
const prefixCache = new Map<string, CacheEntry>();

/**
 * Checks whether a given password has been exposed in a public data breach
 * using the HaveIBeenPwned (HIBP) k-Anonymity API (v3 with padding).
 *
 * Adheres to strict k-anonymity:
 * Only the first 5 characters of the SHA-1 hash are transmitted.
 * The full password or full hash is NEVER sent over the network.
 *
 * Implements a fail-open policy:
 * If the HIBP service times out (> 3000ms) or is unreachable, the check
 * logs a warning and allows the request so users are never locked out of
 * account operations due to third-party network outages.
 */
export async function checkBreachedPassword(
  password: string,
  timeoutMs = 3000
): Promise<{ isBreached: boolean; count: number; checked: boolean }> {
  if (!password || password.length === 0) {
    return { isBreached: false, count: 0, checked: false };
  }

  // 1. Calculate uppercase SHA-1 hash
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const now = Date.now();

  // 2. Check local in-memory cache
  const cached = prefixCache.get(prefix);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    const count = cached.suffixes.get(suffix) || 0;
    return {
      isBreached: count > 0,
      count,
      checked: true,
    };
  }

  // 3. Query HIBP Range API with timeout and fail-open policy
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true', // Prevents response length side-channel attacks
        'User-Agent': 'OrvioHub-AccountSecurity/1.0',
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timer);
    });

    if (!response.ok) {
      console.warn(`[BreachedPassword] HIBP API responded with HTTP ${response.status}. Failing open.`);
      return { isBreached: false, count: 0, checked: false };
    }

    const text = await response.text();
    const suffixes = new Map<string, number>();

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [hashSuffix, rawCount] = trimmed.split(':');
      if (hashSuffix && rawCount) {
        suffixes.set(hashSuffix.toUpperCase(), parseInt(rawCount, 10) || 0);
      }
    }

    // Maintain cache size bound
    if (prefixCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = prefixCache.keys().next().value;
      if (oldestKey) prefixCache.delete(oldestKey);
    }

    prefixCache.set(prefix, {
      suffixes,
      timestamp: now,
    });

    const count = suffixes.get(suffix) || 0;
    return {
      isBreached: count > 0,
      count,
      checked: true,
    };
  } catch (err: any) {
    // Fail-open on timeout or network errors
    console.warn(`[BreachedPassword] HIBP verification failed (${err?.message || err}). Failing open.`);
    return { isBreached: false, count: 0, checked: false };
  }
}

export function clearBreachedPasswordCache(): void {
  prefixCache.clear();
}
