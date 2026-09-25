import { dataService } from './dataService.js';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  fractionDigits: number;
  baseRateToNgn: number;
}

export const FX_RATES: Record<string, CurrencyConfig> = {
  NGN: { code: 'NGN', symbol: '₦', fractionDigits: 0, baseRateToNgn: 1 },
  USD: { code: 'USD', symbol: '$', fractionDigits: 2, baseRateToNgn: 1500 },
  EUR: { code: 'EUR', symbol: '€', fractionDigits: 2, baseRateToNgn: 1650 },
  GBP: { code: 'GBP', symbol: '£', fractionDigits: 2, baseRateToNgn: 1950 },
};

export class CurrencyService {
  /**
   * Retrieves the configured currency for an organization or defaults to NGN
   */
  public async getOrganizationCurrency(organizationId?: string): Promise<CurrencyConfig> {
    if (!organizationId) return FX_RATES.NGN;

    try {
      const org = await dataService.getOrganization(organizationId);
      const currencyCode = (((org as any)?.currency || (org as any)?.settings?.currency || 'NGN') as string).toUpperCase();
      return FX_RATES[currencyCode] || FX_RATES.NGN;
    } catch {
      return FX_RATES.NGN;
    }
  }

  /**
   * Converts an amount from one currency to another using current base rates
   */
  public convert(amount: number, from: string, to: string): number {
    const fromRate = FX_RATES[from.toUpperCase()]?.baseRateToNgn || 1;
    const toRate = FX_RATES[to.toUpperCase()]?.baseRateToNgn || 1;
    const amountInNgn = amount * fromRate;
    const targetAmount = amountInNgn / toRate;
    const cfg = FX_RATES[to.toUpperCase()] || FX_RATES.NGN;
    return Number(targetAmount.toFixed(cfg.fractionDigits));
  }

  /**
   * Formats an amount with the appropriate currency symbol and decimals
   */
  public format(amount: number, currency = 'NGN'): string {
    const cfg = FX_RATES[currency.toUpperCase()] || FX_RATES.NGN;
    return `${cfg.symbol}${amount.toLocaleString('en-NG', {
      minimumFractionDigits: cfg.fractionDigits,
      maximumFractionDigits: cfg.fractionDigits,
    })}`;
  }
}

export const currencyService = new CurrencyService();
