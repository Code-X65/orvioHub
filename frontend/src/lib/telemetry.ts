/**
 * Orviohub API Telemetry & Performance Monitoring Engine
 * Tracks API request latencies (p50, p95, p99), cache hit/miss ratios,
 * endpoint error rates, and token refresh metrics.
 */

export interface ApiRequestStartEvent {
  type: 'api.request.start';
  endpoint: string;
  method: string;
  cacheHit: boolean;
  timestamp: number;
}

export interface ApiRequestEndEvent {
  type: 'api.request.end';
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  cacheHit: boolean;
  timestamp: number;
}

export interface ApiErrorEvent {
  type: 'api.error';
  endpoint: string;
  errorCode: string;
  status?: number;
  message: string;
  timestamp: number;
}

export interface AuthRefreshEvent {
  type: 'auth.refresh';
  success: boolean;
  duration: number;
  error?: string;
  timestamp: number;
}

export type TelemetryEvent =
  | ApiRequestStartEvent
  | ApiRequestEndEvent
  | ApiErrorEvent
  | AuthRefreshEvent;

export interface LatencyMetrics {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface EndpointMetricSummary {
  endpoint: string;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  errorCount: number;
  errorRate: number;
  latency: LatencyMetrics;
}

export interface TelemetrySummary {
  totalRequests: number;
  cacheHitRatio: number;
  overallErrorRate: number;
  overallLatency: LatencyMetrics;
  authRefreshes: {
    total: number;
    successRate: number;
    meanDuration: number;
    failures: number;
  };
  topSlowEndpoints: { endpoint: string; p95: number; count: number }[];
  topFailingEndpoints: { endpoint: string; errorRate: number; totalErrors: number }[];
}

type TelemetryListener = (event: TelemetryEvent) => void;

class TelemetryCollector {
  private events: TelemetryEvent[] = [];
  private readonly maxEvents: number;
  private listeners: Set<TelemetryListener> = new Set();

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  public record(event: TelemetryEvent) {
    if (this.events.length >= this.maxEvents) {
      this.events.shift();
    }
    this.events.push(event);

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  public recordRequestStart(endpoint: string, method: string, cacheHit: boolean) {
    this.record({
      type: 'api.request.start',
      endpoint,
      method: method.toUpperCase(),
      cacheHit,
      timestamp: Date.now(),
    });
  }

  public recordRequestEnd(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    cacheHit: boolean
  ) {
    this.record({
      type: 'api.request.end',
      endpoint,
      method: method.toUpperCase(),
      duration,
      status,
      cacheHit,
      timestamp: Date.now(),
    });
  }

  public recordApiError(endpoint: string, errorCode: string, status?: number, message = '') {
    this.record({
      type: 'api.error',
      endpoint,
      errorCode,
      status,
      message,
      timestamp: Date.now(),
    });
  }

  public recordAuthRefresh(success: boolean, duration: number, error?: string) {
    this.record({
      type: 'auth.refresh',
      success,
      duration,
      error,
      timestamp: Date.now(),
    });
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private computePercentiles(values: number[]): LatencyMetrics {
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = Math.round((sum / count) * 100) / 100;

    const getP = (p: number) => {
      const idx = Math.min(Math.floor((p / 100) * count), count - 1);
      return sorted[idx];
    };

    return {
      count,
      min,
      max,
      mean,
      p50: getP(50),
      p95: getP(95),
      p99: getP(99),
    };
  }

  public getEndpointMetrics(endpointFilter?: string): EndpointMetricSummary[] {
    const endEvents = this.events.filter(
      (e): e is ApiRequestEndEvent =>
        e.type === 'api.request.end' && (!endpointFilter || e.endpoint.includes(endpointFilter))
    );

    const errorEvents = this.events.filter(
      (e): e is ApiErrorEvent =>
        e.type === 'api.error' && (!endpointFilter || e.endpoint.includes(endpointFilter))
    );

    const grouped = new Map<
      string,
      {
        durations: number[];
        cacheHits: number;
        cacheMisses: number;
        errors: number;
      }
    >();

    for (const ev of endEvents) {
      if (!grouped.has(ev.endpoint)) {
        grouped.set(ev.endpoint, { durations: [], cacheHits: 0, cacheMisses: 0, errors: 0 });
      }
      const data = grouped.get(ev.endpoint)!;
      data.durations.push(ev.duration);
      if (ev.cacheHit) {
        data.cacheHits++;
      } else {
        data.cacheMisses++;
      }
    }

    for (const err of errorEvents) {
      if (!grouped.has(err.endpoint)) {
        grouped.set(err.endpoint, { durations: [], cacheHits: 0, cacheMisses: 0, errors: 0 });
      }
      grouped.get(err.endpoint)!.errors++;
    }

    const summaries: EndpointMetricSummary[] = [];

    for (const [endpoint, data] of grouped.entries()) {
      const totalRequests = data.cacheHits + data.cacheMisses;
      const cacheHitRatio = totalRequests > 0 ? Math.round((data.cacheHits / totalRequests) * 100) / 100 : 0;
      const errorRate =
        totalRequests > 0 ? Math.round((data.errors / totalRequests) * 100) / 100 : data.errors > 0 ? 1 : 0;

      summaries.push({
        endpoint,
        totalRequests,
        cacheHits: data.cacheHits,
        cacheMisses: data.cacheMisses,
        cacheHitRatio,
        errorCount: data.errors,
        errorRate,
        latency: this.computePercentiles(data.durations),
      });
    }

    return summaries;
  }

  public getSummary(): TelemetrySummary {
    const allEndEvents = this.events.filter((e): e is ApiRequestEndEvent => e.type === 'api.request.end');
    const allErrors = this.events.filter((e): e is ApiErrorEvent => e.type === 'api.error');
    const allRefreshes = this.events.filter((e): e is AuthRefreshEvent => e.type === 'auth.refresh');

    const totalRequests = allEndEvents.length;
    const totalHits = allEndEvents.filter((e) => e.cacheHit).length;
    const cacheHitRatio = totalRequests > 0 ? Math.round((totalHits / totalRequests) * 100) / 100 : 0;
    const overallErrorRate = totalRequests > 0 ? Math.round((allErrors.length / totalRequests) * 100) / 100 : 0;

    const endpointSummaries = this.getEndpointMetrics();

    const topSlowEndpoints = [...endpointSummaries]
      .filter((s) => s.latency.count > 0)
      .sort((a, b) => b.latency.p95 - a.latency.p95)
      .slice(0, 5)
      .map((s) => ({ endpoint: s.endpoint, p95: s.latency.p95, count: s.latency.count }));

    const topFailingEndpoints = [...endpointSummaries]
      .filter((s) => s.errorCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
      .map((s) => ({ endpoint: s.endpoint, errorRate: s.errorRate, totalErrors: s.errorCount }));

    const refreshCount = allRefreshes.length;
    const successfulRefreshes = allRefreshes.filter((r) => r.success).length;
    const refreshDurationSum = allRefreshes.reduce((acc, r) => acc + r.duration, 0);

    return {
      totalRequests,
      cacheHitRatio,
      overallErrorRate,
      overallLatency: this.computePercentiles(allEndEvents.map((e) => e.duration)),
      authRefreshes: {
        total: refreshCount,
        successRate: refreshCount > 0 ? Math.round((successfulRefreshes / refreshCount) * 100) / 100 : 1,
        meanDuration: refreshCount > 0 ? Math.round(refreshDurationSum / refreshCount) : 0,
        failures: refreshCount - successfulRefreshes,
      },
      topSlowEndpoints,
      topFailingEndpoints,
    };
  }

  public getEvents(): ReadonlyArray<TelemetryEvent> {
    return this.events;
  }

  public reset() {
    this.events = [];
  }
}

export const telemetry = new TelemetryCollector();

export const navigationTiming = {
  markStart: (name: string) => {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(`${name}-start`);
    }
  },
  markEnd: (name: string) => {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
      } catch {}
    }
  },
  measureSessionValidation: (): number | null => {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return null;
    const measure = performance.getEntriesByName('session-validation');
    return measure.length > 0 ? measure[measure.length - 1].duration : null;
  },
  measureRouteTransition: (): number | null => {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return null;
    const measure = performance.getEntriesByName('route-transition');
    return measure.length > 0 ? measure[measure.length - 1].duration : null;
  },
};
