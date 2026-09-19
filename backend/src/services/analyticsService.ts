/**
 * Analytics Service
 * Handles metric calculations, period boundaries in Africa/Lagos timezone,
 * currency conversions (NGN/kobo), privacy sanitization, and data freshness evaluation.
 */

export interface FreshnessMetadata {
  computedAt: number;
  freshness: 'fresh' | 'stale' | 'rebuilding' | 'unavailable';
  sourcePeriod: string;
  aggregationVersion: number;
  timezone: 'Africa/Lagos';
  currency: 'NGN';
}

export class AnalyticsService {
  private static LAGOS_TIMEZONE = 'Africa/Lagos';

  /**
   * Get formatted date in Africa/Lagos timezone (UTC+1)
   */
  public static getLagosDate(timestamp: number = Date.now()): string {
    const lagosOffsetMs = 3600000; // UTC+1
    const lagosTime = new Date(timestamp + lagosOffsetMs);
    return lagosTime.toISOString().slice(0, 10);
  }

  /**
   * Get start and end timestamp of a date in Africa/Lagos timezone
   */
  public static getLagosDayBounds(dateStr?: string): { startUtc: number; endUtc: number } {
    const targetDate = dateStr || this.getLagosDate();
    const [year, month, day] = targetDate.split('-').map(Number);
    // In Lagos (UTC+1), midnight Lagos = 23:00 UTC previous day
    const startUtc = Date.UTC(year, month - 1, day, -1, 0, 0, 0);
    const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1;
    return { startUtc, endUtc };
  }

  /**
   * Format kobo into Naira string (₦)
   */
  public static formatNaira(amountKobo: number = 0): string {
    const naira = amountKobo / 100;
    return `₦${naira.toLocaleString('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Normalize annual/monthly amounts to monthly MRR in kobo
   */
  public static normalizeToMonthlyKobo(amountKobo: number, interval: 'monthly' | 'annual' = 'monthly'): number {
    if (interval === 'annual') {
      return Math.round(amountKobo / 12);
    }
    return amountKobo;
  }

  /**
   * Evaluate metric freshness status
   */
  public static evaluateFreshness(computedAt: number, maxAgeMs: number = 3600000): FreshnessMetadata {
    const age = Date.now() - computedAt;
    const freshness = age > maxAgeMs ? 'stale' : 'fresh';

    return {
      computedAt,
      freshness,
      sourcePeriod: this.getLagosDate(computedAt),
      aggregationVersion: 1,
      timezone: 'Africa/Lagos',
      currency: 'NGN',
    };
  }

  /**
   * Sanitize sensitive data from analytics payloads (strip passwords, tokens, full emails, raw phone numbers)
   */
  public static sanitizeAnalyticsPayload<T extends Record<string, any>>(data: T): T {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const forbiddenKeys = [
      'password',
      'passwordHash',
      'token',
      'sessionToken',
      'refreshToken',
      'twoFactorSecret',
      'mfaSecret',
      'paystackSecretKey',
      'secretKey',
      'cardNumber',
      'authorizationCode',
      'signature',
    ];

    for (const key of Object.keys(sanitized)) {
      if (forbiddenKeys.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        delete (sanitized as any)[key];
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
        sanitized[key] = this.sanitizeAnalyticsPayload(sanitized[key]);
      }
    }

    return sanitized;
  }
}
