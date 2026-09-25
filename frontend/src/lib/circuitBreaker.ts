/**
 * Orviohub Per-Endpoint Circuit Breaker Pattern
 * Protects against cascading failures, network storms, and UI lockups
 * when specific backend services or endpoints experience downtime.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Consecutive 5xx/network errors before tripping
  cooldownPeriodMs?: number; // Duration to wait before attempting half-open probe
}

export interface CircuitStatus {
  endpointKey: string;
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  nextAllowedRetryTime: number;
}

export class CircuitBreakerError extends Error {
  public code = 'CIRCUIT_BREAKER_OPEN';
  public status = 503;
  public endpoint: string;
  public nextRetryInMs: number;

  constructor(endpoint: string, nextRetryInMs: number) {
    super(
      `Endpoint "${endpoint}" is temporarily unavailable due to repeated service failures. Please try again in ${Math.ceil(
        nextRetryInMs / 1000
      )} seconds.`
    );
    this.name = 'CircuitBreakerError';
    this.endpoint = endpoint;
    this.nextRetryInMs = nextRetryInMs;
  }
}

class CircuitBreakerRegistry {
  private circuits = new Map<
    string,
    {
      state: CircuitState;
      consecutiveFailures: number;
      lastFailureTime: number;
      halfOpenInFlight: boolean;
    }
  >();

  private failureThreshold: number;
  private cooldownPeriodMs: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.cooldownPeriodMs = config.cooldownPeriodMs ?? 30000;
  }

  /**
   * Normalizes URL endpoints to group dynamic ID routes together.
   * e.g. "/api/v1/workspaces/ws_abc/branches" -> "/api/v1/workspaces/:id/branches"
   */
  public normalizeEndpoint(endpoint: string): string {
    const clean = endpoint.split('?')[0];
    return clean.replace(/\/[a-zA-Z0-9_-]{16,}(?=\/|$)/g, '/:id');
  }

  public checkExecution(endpoint: string): {
    allowed: boolean;
    state: CircuitState;
    nextRetryInMs: number;
  } {
    const key = this.normalizeEndpoint(endpoint);
    const circuit = this.circuits.get(key);

    if (!circuit || circuit.state === 'CLOSED') {
      return { allowed: true, state: 'CLOSED', nextRetryInMs: 0 };
    }

    const now = Date.now();
    const elapsed = now - circuit.lastFailureTime;

    if (circuit.state === 'OPEN') {
      if (elapsed >= this.cooldownPeriodMs) {
        // Switch to HALF_OPEN to probe recovery
        circuit.state = 'HALF_OPEN';
        circuit.halfOpenInFlight = true;
        return { allowed: true, state: 'HALF_OPEN', nextRetryInMs: 0 };
      }

      const nextRetryInMs = Math.max(0, this.cooldownPeriodMs - elapsed);
      return { allowed: false, state: 'OPEN', nextRetryInMs };
    }

    // HALF_OPEN
    return { allowed: true, state: 'HALF_OPEN', nextRetryInMs: 0 };
  }

  public recordSuccess(endpoint: string) {
    const key = this.normalizeEndpoint(endpoint);
    const circuit = this.circuits.get(key);
    if (!circuit) return;

    // Reset circuit on any success
    circuit.state = 'CLOSED';
    circuit.consecutiveFailures = 0;
    circuit.halfOpenInFlight = false;
  }

  public recordFailure(endpoint: string, status?: number) {
    // Only 5xx server errors, timeouts, or network crashes (status 0 / 408 / >= 500) trip the breaker.
    // 4xx errors (400, 401, 403, 404, 409, 422) are valid client flows and do not trip the circuit breaker.
    const isServerError = !status || status === 0 || status === 408 || status >= 500;
    if (!isServerError) {
      return;
    }

    const key = this.normalizeEndpoint(endpoint);
    let circuit = this.circuits.get(key);

    if (!circuit) {
      circuit = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: Date.now(),
        halfOpenInFlight: false,
      };
      this.circuits.set(key, circuit);
    }

    circuit.consecutiveFailures++;
    circuit.lastFailureTime = Date.now();
    circuit.halfOpenInFlight = false;

    if (circuit.consecutiveFailures >= this.failureThreshold) {
      circuit.state = 'OPEN';
    }
  }

  public getStatus(endpoint: string): CircuitStatus {
    const key = this.normalizeEndpoint(endpoint);
    const circuit = this.circuits.get(key);
    if (!circuit) {
      return {
        endpointKey: key,
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: 0,
        nextAllowedRetryTime: 0,
      };
    }

    return {
      endpointKey: key,
      state: circuit.state,
      failures: circuit.consecutiveFailures,
      lastFailureTime: circuit.lastFailureTime,
      nextAllowedRetryTime:
        circuit.state === 'OPEN' ? circuit.lastFailureTime + this.cooldownPeriodMs : 0,
    };
  }

  public reset(endpoint?: string) {
    if (endpoint) {
      const key = this.normalizeEndpoint(endpoint);
      this.circuits.delete(key);
    } else {
      this.circuits.clear();
    }
  }

  public getAllCircuits(): CircuitStatus[] {
    return Array.from(this.circuits.keys()).map((key) => this.getStatus(key));
  }
}

export const circuitBreaker = new CircuitBreakerRegistry();
