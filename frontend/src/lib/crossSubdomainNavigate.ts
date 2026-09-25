/**
 * Cross-subdomain navigation that preserves React state via sessionStorage.
 * Avoids full page reloads when navigating between subdomains.
 */
export function crossSubdomainNavigate(
  targetUrl: string,
  state?: Record<string, any>
): void {
  if (typeof window === 'undefined') return;

  // Store state in sessionStorage for the target subdomain to pick up
  try {
    const handoff = {
      state,
      returnTo: window.location.href,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('orvio_cross_subdomain_handoff', JSON.stringify(handoff));
  } catch {
    // sessionStorage unavailable — fall back to direct navigation
  }

  // If same-origin, use normal navigation
  try {
    const targetOrigin = new URL(targetUrl, window.location.origin).origin;
    if (targetOrigin === window.location.origin) {
      window.location.href = targetUrl;
      return;
    }
  } catch {}

  window.location.href = targetUrl;
}

export function consumeCrossSubdomainHandoff(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('orvio_cross_subdomain_handoff');
    if (!raw) return null;
    sessionStorage.removeItem('orvio_cross_subdomain_handoff');
    const handoff = JSON.parse(raw);
    // Only consume if handoff is recent (within 10 seconds)
    if (Date.now() - handoff.timestamp > 10_000) return null;
    return handoff.state || {};
  } catch {
    return null;
  }
}
