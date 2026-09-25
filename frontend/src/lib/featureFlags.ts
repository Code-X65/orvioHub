/**
 * Orviohub Feature Flag & Graceful Degradation Engine
 * Controls runtime toggles, experimental rollouts, and endpoint kill-switches.
 */

export interface FeatureFlagConfig {
  [key: string]: boolean;
}

const DEFAULT_FLAGS: FeatureFlagConfig = {
  'enable-api-telemetry': true,
  'enable-circuit-breaker': true,
  'enable-client-error-logging': true,
  'enable-swr-cache': true,
};

const STORAGE_KEY = 'orvio_feature_flags_override';

class FeatureFlagRegistry {
  private flags: Map<string, boolean> = new Map();

  constructor() {
    // Initialize with defaults
    for (const [key, val] of Object.entries(DEFAULT_FLAGS)) {
      this.flags.set(key, val);
    }
    this.loadOverrides();
  }

  private loadOverrides() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const overrides = JSON.parse(raw);
        for (const [k, v] of Object.entries(overrides)) {
          if (typeof v === 'boolean') {
            this.flags.set(k, v);
          }
        }
      }
    } catch {}
  }

  public isEnabled(flagKey: string, defaultValue = false): boolean {
    if (this.flags.has(flagKey)) {
      return this.flags.get(flagKey)!;
    }
    return defaultValue;
  }

  public setFlag(flagKey: string, value: boolean) {
    this.flags.set(flagKey, value);
    if (typeof localStorage !== 'undefined') {
      try {
        const current: Record<string, boolean> = {};
        for (const [k, v] of this.flags.entries()) {
          current[k] = v;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {}
    }
  }

  public getAllFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [k, v] of this.flags.entries()) {
      result[k] = v;
    }
    return result;
  }

  public reset() {
    this.flags.clear();
    for (const [key, val] of Object.entries(DEFAULT_FLAGS)) {
      this.flags.set(key, val);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const featureFlags = new FeatureFlagRegistry();
