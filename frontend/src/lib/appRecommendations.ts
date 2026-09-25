/**
 * Application Recommendation Engine
 *
 * Provides intelligent, category-specific and workflow-contextual application
 * recommendations based on the organization's business category, industry,
 * and currently activated operational stack.
 */

import type { ApplicationKey } from '@orviohub/shared';

export interface AppRecommendation {
  appKey: ApplicationKey;
  reason: string;
  tag?: string; // e.g. "Core Foundation", "High Impact", "Workflow Synergies"
}

export interface CategoryRecommendationProfile {
  categoryName: string;
  headline: string;
  description: string;
  recommendations: AppRecommendation[];
}

const CATEGORY_PROFILES: Record<string, CategoryRecommendationProfile> = {
  'provision store': {
    categoryName: 'Provision Store / Supermarket',
    headline: 'Recommended Retail & Supermarket Stack',
    description: 'Keep your store shelves organized and counter lines moving quickly with automated inventory and fast counter checkout.',
    recommendations: [
      {
        appKey: 'inventory',
        reason: 'Essential for tracking stock levels, batches, supplier invoices, and receiving low-stock restock alerts.',
        tag: 'Core Foundation',
      },
      {
        appKey: 'pos',
        reason: 'Accelerates front-desk cashier sales with fast barcode scanning, cash drawers, and instant receipt printing.',
        tag: 'High Impact',
      },
      {
        appKey: 'taskmanagement',
        reason: 'Assign shelf-auditing and daily restock task lists directly to floor personnel.',
        tag: 'Team Operations',
      },
    ],
  },
  'pharmacy': {
    categoryName: 'Pharmacy & Healthcare',
    headline: 'Recommended Healthcare Operations Stack',
    description: 'Ensure accurate pharmaceutical stock tracking, compliance with expiration dates, and seamless patient appointment bookings.',
    recommendations: [
      {
        appKey: 'inventory',
        reason: 'Precise batch number tracking, expiry date alerts, and purchase orders for pharmaceuticals.',
        tag: 'Core Foundation',
      },
      {
        appKey: 'booking',
        reason: 'Enable patients to schedule pharmacist consultations, immunization appointments, and prescription pickups.',
        tag: 'Patient Care',
      },
      {
        appKey: 'pos',
        reason: 'Quick OTC and prescription counter checkout with compliant itemized receipt printing.',
        tag: 'High Impact',
      },
    ],
  },
  'restaurant': {
    categoryName: 'Restaurant / Food & Beverage',
    headline: 'Recommended Hospitality Stack',
    description: 'Prevent food waste, streamline kitchen coordination, and elevate the guest dining experience from reservation to bill.',
    recommendations: [
      {
        appKey: 'inventory',
        reason: 'Track perishable food ingredients, supplier deliveries, and automatic inventory depletion from recipe sales.',
        tag: 'Core Foundation',
      },
      {
        appKey: 'pos',
        reason: 'Table-side order taking, split billing, payment settlement, and automated kitchen ticket printing.',
        tag: 'High Impact',
      },
      {
        appKey: 'booking',
        reason: 'Manage table reservations, VIP guest seating, and event bookings with automated SMS confirmations.',
        tag: 'Guest Experience',
      },
    ],
  },
  'boutique': {
    categoryName: 'Boutique / Fashion & Apparel',
    headline: 'Recommended Fashion & Apparel Stack',
    description: 'Effortlessly organize apparel variations and offer customers modern in-store and omnichannel checkout.',
    recommendations: [
      {
        appKey: 'inventory',
        reason: 'Manage complex size and color matrix variations, seasonal catalogs, and multi-location branch transfers.',
        tag: 'Core Foundation',
      },
      {
        appKey: 'pos',
        reason: 'Sleek counter checkout terminal with branded digital receipts and multi-tender payments.',
        tag: 'High Impact',
      },
    ],
  },
  'gym': {
    categoryName: 'Gym & Fitness',
    headline: 'Recommended Fitness Center Stack',
    description: 'Manage memberships, automate class booking schedules, and drive recurring subscription revenues.',
    recommendations: [
      {
        appKey: 'gym',
        reason: 'Member check-in tracking, membership tiers, trainer scheduling, and workout facility management.',
        tag: 'Core Foundation',
      },
      {
        appKey: 'booking',
        reason: 'Empower members to reserve spots in group classes, personal training slots, and court times online.',
        tag: 'Member Engagement',
      },
      {
        appKey: 'billing',
        reason: 'Automated recurring monthly dues, annual renewals, and member debit agreements.',
        tag: 'Revenue Engine',
      },
      {
        appKey: 'inventory',
        reason: 'Sell fitness merchandise, nutritional supplements, and branded gear at your front desk.',
        tag: 'Pro Shop',
      },
    ],
  },
  'service': {
    categoryName: 'Service & Professional Consulting',
    headline: 'Recommended Professional Services Stack',
    description: 'Coordinate appointments, assign client project tasks, and automate client retainer billing seamlessly.',
    recommendations: [
      {
        appKey: 'booking',
        reason: 'Client consultation booking with automated calendar synchronization and SMS reminders.',
        tag: 'Client Intake',
      },
      {
        appKey: 'billing',
        reason: 'Professional invoice generation, automated payment reminders, and retainer billing.',
        tag: 'Revenue Engine',
      },
      {
        appKey: 'taskmanagement',
        reason: 'Coordinate project milestones, client deliverables, and team task assignments.',
        tag: 'Team Workflow',
      },
    ],
  },
  'wholesale': {
    categoryName: 'Wholesale & Distribution',
    headline: 'Recommended Wholesale & Distribution Stack',
    description: 'Oversee high-volume multi-warehouse operations, commercial client credit terms, and fulfillment dispatches.',
    recommendations: [
      {
        appKey: 'inventory',
        reason: 'Multi-branch warehouse bin allocation, pallet tracking, and automatic bulk reorder thresholds.',
        tag: 'Core Foundation',
      },
      {
        appKey: 'billing',
        reason: 'Commercial net-30 invoicing, credit management, and bulk client account statements.',
        tag: 'High Impact',
      },
      {
        appKey: 'taskmanagement',
        reason: 'Assign loading dock, warehouse picking, and fleet driver dispatch tasks.',
        tag: 'Logistics',
      },
    ],
  },
};

const DEFAULT_PROFILE: CategoryRecommendationProfile = {
  categoryName: 'General Business Operations',
  headline: 'Recommended Operational Stack',
  description: 'A proven combination of tools to organize stock, speed up sales, and coordinate your team.',
  recommendations: [
    {
      appKey: 'inventory',
      reason: 'The central operational nervous system for product catalogs, stock tracking, and supplier orders.',
      tag: 'Core Foundation',
    },
    {
      appKey: 'pos',
      reason: 'Speed up daily counter transactions with modern point-of-sale checkout and receipt management.',
      tag: 'High Impact',
    },
    {
      appKey: 'taskmanagement',
      reason: 'Keep your team aligned on daily checklists, routine audits, and operational assignments.',
      tag: 'Team Operations',
    },
  ],
};

/**
 * Returns tailored recommendations based on category or business type.
 */
export function getRecommendationsForCategory(categoryOrType?: string): CategoryRecommendationProfile {
  if (!categoryOrType) return DEFAULT_PROFILE;

  const normalized = categoryOrType.toLowerCase().trim();

  for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return profile;
    }
  }

  // Check aliases
  if (normalized.includes('food') || normalized.includes('cafe') || normalized.includes('bakery')) {
    return CATEGORY_PROFILES['restaurant'];
  }
  if (normalized.includes('supermarket') || normalized.includes('grocery') || normalized.includes('retail')) {
    return CATEGORY_PROFILES['provision store'];
  }
  if (normalized.includes('health') || normalized.includes('clinic') || normalized.includes('hospital')) {
    return CATEGORY_PROFILES['pharmacy'];
  }
  if (normalized.includes('fitness') || normalized.includes('crossfit') || normalized.includes('sports')) {
    return CATEGORY_PROFILES['gym'];
  }
  if (normalized.includes('fashion') || normalized.includes('apparel') || normalized.includes('cloth')) {
    return CATEGORY_PROFILES['boutique'];
  }
  if (normalized.includes('consulting') || normalized.includes('agency') || normalized.includes('repair')) {
    return CATEGORY_PROFILES['service'];
  }
  if (normalized.includes('distribut') || normalized.includes('logistics') || normalized.includes('supply')) {
    return CATEGORY_PROFILES['wholesale'];
  }

  return DEFAULT_PROFILE;
}

/**
 * Provides dynamic cross-sell operational tips based on current activations.
 */
export function getContextualTipForApp(appKey: string, activeAppKeys: string[]): string | null {
  const normKey = appKey.toLowerCase();
  const hasInventory = activeAppKeys.includes('inventory');
  const hasPos = activeAppKeys.includes('pos');
  const hasBooking = activeAppKeys.includes('booking');

  if (normKey === 'pos' && hasInventory) {
    return 'Users who manage Inventory with Orviohub activate POS for seamless front-counter sales sync.';
  }
  if (normKey === 'taskmanagement' && hasInventory) {
    return 'Activate Task Management to assign inventory restock checklists directly to your team members.';
  }
  if (normKey === 'billing' && (hasBooking || hasInventory)) {
    return 'Automate customer invoice generation and payment tracking for your active services.';
  }
  if (normKey === 'booking' && hasPos) {
    return 'Connect appointments with checkout to automatically settle service fees upon completion.';
  }
  return null;
}
