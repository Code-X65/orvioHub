export interface ProrationBreakdown {
  currentPlanName: string;
  currentPlanPrice: number;
  targetPlanName: string;
  targetPlanPrice: number;
  daysRemaining: number;
  totalDaysInCycle: number;
  unusedCurrentCredit: number;
  newPlanCharge: number;
}

export interface ProrationResult {
  creditAmount: number;
  chargeAmount: number;
  proratedAmount: number; // Positive = due now, negative = account credit
  nextFullCharge: number;
  nextChargeDate: number;
  billingInterval: 'monthly' | 'annual';
  breakdown: ProrationBreakdown;
}

export interface PlanPricingInfo {
  key: string;
  name?: string;
  monthlyPrice?: number;
  annualPrice?: number;
  priceMonthly?: number;
  priceAnnual?: number;
  price?: {
    monthly: number;
    annual: number;
  };
}

export class ProrationService {
  /**
   * Calculates prorated charges and credit adjustments for mid-cycle plan changes
   */
  public calculateProration(
    currentPlan: PlanPricingInfo,
    targetPlan: PlanPricingInfo,
    currentPeriodStart: number,
    currentPeriodEnd: number,
    billingInterval: 'monthly' | 'annual' = 'monthly'
  ): ProrationResult {
    const now = Date.now();
    const cycleDurationMs = Math.max(currentPeriodEnd - currentPeriodStart, 86_400_000);
    const totalDaysInCycle = Math.max(1, Math.round(cycleDurationMs / 86_400_000));
    
    const remainingMs = Math.max(0, currentPeriodEnd - now);
    const daysRemaining = Math.max(0, Math.min(totalDaysInCycle, Math.ceil(remainingMs / 86_400_000)));

    const getCurrentPrice = (p: PlanPricingInfo) => {
      if (billingInterval === 'annual') {
        return p.annualPrice ?? p.priceAnnual ?? p.price?.annual ?? (p.monthlyPrice ? p.monthlyPrice * 10 : 75000);
      }
      return p.monthlyPrice ?? p.priceMonthly ?? p.price?.monthly ?? 7500;
    };

    const getTargetPrice = (p: PlanPricingInfo) => {
      if (billingInterval === 'annual') {
        return p.annualPrice ?? p.priceAnnual ?? p.price?.annual ?? (p.monthlyPrice ? p.monthlyPrice * 10 : 250000);
      }
      return p.monthlyPrice ?? p.priceMonthly ?? p.price?.monthly ?? 25000;
    };

    const currentPrice = getCurrentPrice(currentPlan);
    const targetPrice = getTargetPrice(targetPlan);

    // Fraction of cycle remaining
    const remainingRatio = daysRemaining / totalDaysInCycle;

    // Credit unused days of current plan
    const creditForCurrent = Math.round(currentPrice * remainingRatio);
    // Charge remaining days on new plan
    const chargeForNew = Math.round(targetPrice * remainingRatio);
    // Net prorated amount
    const proratedAmount = Math.max(0, chargeForNew - creditForCurrent);

    return {
      creditAmount: creditForCurrent,
      chargeAmount: chargeForNew,
      proratedAmount,
      nextFullCharge: targetPrice,
      nextChargeDate: currentPeriodEnd,
      billingInterval,
      breakdown: {
        currentPlanName: currentPlan.name || currentPlan.key,
        currentPlanPrice: currentPrice,
        targetPlanName: targetPlan.name || targetPlan.key,
        targetPlanPrice: targetPrice,
        daysRemaining,
        totalDaysInCycle,
        unusedCurrentCredit: creditForCurrent,
        newPlanCharge: chargeForNew,
      },
    };
  }
}

export const prorationService = new ProrationService();
