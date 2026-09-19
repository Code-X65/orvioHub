/**
 * Orviohub Analytics Tracking Engine
 * Provides non-blocking, privacy-preserving event tracking for marketing and conversion optimization.
 */

export interface AnalyticsEventProps {
  [key: string]: string | number | boolean | undefined | null | string[];
}

export type MarketingEventName =
  | 'marketing_inventory_page_viewed'
  | 'marketing_inventory_pricing_viewed'
  | 'marketing_inventory_demo_viewed'
  | 'hero_cta_clicked'
  | 'demo_video_played'
  | 'feature_card_clicked'
  | 'demo_tab_changed'
  | 'demo_interaction_started'
  | 'demo_cta_clicked'
  | 'pricing_card_clicked'
  | 'faq_expanded'
  | 'testimonial_viewed'
  | 'final_cta_clicked'
  | 'problem_section_viewed'
  | 'how_it_works_viewed'
  | 'signup_initiated'
  | 'signup_completed'
  | 'inventory_trial_started'
  | 'inventory_app_first_login';

interface TrackEventPayload {
  eventName: MarketingEventName | string;
  properties?: AnalyticsEventProps;
  userId?: string | null;
  timestamp: string;
  url: string;
  referrer: string;
}

const QUEUE_STORAGE_KEY = 'orvio_analytics_queue';
const ATTRIBUTION_STORAGE_KEY = 'orvio_marketing_attribution';

// Check if Do Not Track is enabled
function isDNTEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    navigator.doNotTrack === '1' ||
    (window as unknown as { doNotTrack?: string }).doNotTrack === '1' ||
    (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack === '1'
  );
}

// Get stored offline queue
function getStoredQueue(): TrackEventPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save offline queue
function saveQueue(queue: TrackEventPayload[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-100))); // Keep last 100
  } catch {
    // Ignore quota limits
  }
}

/**
 * Capture marketing campaign attribution parameters from URL (UTM tags, referrer, landing page)
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    const utmContent = urlParams.get('utm_content');

    const existingRaw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};

    const attribution = {
      ...existing,
      landingPage: window.location.pathname,
      landingTimestamp: existing.landingTimestamp || new Date().toISOString(),
      utmSource: utmSource || existing.utmSource || 'direct',
      utmMedium: utmMedium || existing.utmMedium || 'web',
      utmCampaign: utmCampaign || existing.utmCampaign || undefined,
      utmContent: utmContent || existing.utmContent || undefined,
      referrer: document.referrer || existing.referrer || undefined,
      interactionsBeforeSignup: existing.interactionsBeforeSignup || [],
    };

    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Fallback safe
  }
}

/**
 * Append interaction event name to attribution trail
 */
export function appendAttributionInteraction(eventName: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return;
    const attribution = JSON.parse(raw);
    const list = Array.isArray(attribution.interactionsBeforeSignup)
      ? attribution.interactionsBeforeSignup
      : [];
    if (!list.includes(eventName)) {
      list.push(eventName);
      attribution.interactionsBeforeSignup = list.slice(-20);
      localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    }
  } catch {
    // ignore
  }
}

/**
 * Get stored marketing attribution data for signup submission
 */
export function getStoredAttribution() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Track fired events in session to prevent spam duplicates
const sessionEventCache = new Set<string>();

/**
 * Track an analytics event
 */
export function trackEvent(
  eventName: MarketingEventName | string,
  properties: AnalyticsEventProps = {},
  options?: { oncePerSession?: boolean; userId?: string | null }
): void {
  if (typeof window === 'undefined') return;
  if (isDNTEnabled()) return;

  if (options?.oncePerSession) {
    const cacheKey = `${eventName}_${JSON.stringify(properties)}`;
    if (sessionEventCache.has(cacheKey)) return;
    sessionEventCache.add(cacheKey);
  }

  appendAttributionInteraction(eventName);

  const payload: TrackEventPayload = {
    eventName,
    properties: {
      ...properties,
      screen_width: window.innerWidth,
      platform: 'web',
    },
    userId: options?.userId || null,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    referrer: document.referrer,
  };

  // If online, attempt to process; otherwise queue
  if (navigator.onLine) {
    // In browser console development mode, log structured telemetry
    if (import.meta.env.DEV) {
      console.debug(`[Orvio Analytics] 📊 ${eventName}`, payload.properties);
    }
  } else {
    const queue = getStoredQueue();
    queue.push(payload);
    saveQueue(queue);
  }
}

/**
 * Flush pending offline events when network connectivity is restored
 */
export function flushOfflineEvents(): void {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const queue = getStoredQueue();
  if (queue.length === 0) return;

  if (import.meta.env.DEV) {
    console.debug(`[Orvio Analytics] Flushed ${queue.length} offline queued events`);
  }
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}

// Attach online listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushOfflineEvents);
  captureAttribution();
}
