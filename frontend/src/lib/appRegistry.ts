import React from 'react';
import { Boxes, ShoppingCart, Calendar, Dumbbell, CreditCard, ClipboardList, Zap } from 'lucide-react';
import {
  applications,
  USER_FACING_APP_KEYS,
  KNOWN_PLAN_KEYS,
  type ApplicationKey,
  type ApplicationDefinition,
  type AppAvailability,
  type KnownPlanKey,
} from '@orviohub/shared';

export type { AppAvailability, KnownPlanKey };
export { KNOWN_PLAN_KEYS };

export interface AppDisplayMeta {
  icon: React.ReactNode;
  description: string;
  badge?: string;
  availability: AppAvailability;
  planRequirements: string[];
}

export function validatePlanRequirement(req: string, appKey?: string): boolean {
  const isKnown = KNOWN_PLAN_KEYS.includes(req.toLowerCase() as KnownPlanKey);
  if (!isKnown) {
    console.warn(
      `[AppRegistry Warning] Application "${appKey || 'unknown'}" specifies unrecognized plan requirement "${req}". Valid plan keys: ${KNOWN_PLAN_KEYS.join(', ')}`
    );
  }
  return isKnown;
}

for (const app of Object.values(applications)) {
  if (app.planRequirements) {
    for (const req of app.planRequirements) {
      validatePlanRequirement(req, app.key);
    }
  }
}

function resolveIcon(iconName?: string, appKey?: string): React.ReactNode {
  switch (iconName || appKey) {
    case 'Boxes':
    case 'inventory':
      return React.createElement(Boxes, { className: 'w-7 h-7 text-indigo-400' });
    case 'ShoppingCart':
    case 'pos':
      return React.createElement(ShoppingCart, { className: 'w-7 h-7 text-emerald-400' });
    case 'Calendar':
    case 'booking':
      return React.createElement(Calendar, { className: 'w-7 h-7 text-sky-400' });
    case 'Dumbbell':
    case 'gym':
      return React.createElement(Dumbbell, { className: 'w-7 h-7 text-orange-400' });
    case 'CreditCard':
    case 'billing':
      return React.createElement(CreditCard, { className: 'w-7 h-7 text-violet-400' });
    case 'ClipboardList':
    case 'taskmanagement':
      return React.createElement(ClipboardList, { className: 'w-7 h-7 text-cyan-400' });
    default:
      return React.createElement(Zap, { className: 'w-7 h-7 text-purple-400' });
  }
}

const FALLBACK_META: AppDisplayMeta = {
  icon: React.createElement(Zap, { className: 'w-7 h-7 text-purple-400' }),
  description: 'Application management module.',
  availability: 'available',
  planRequirements: ['standard', 'premium', 'enterprise'],
};

export const APP_DISPLAY_META: Partial<Record<ApplicationKey, AppDisplayMeta>> = Object.values(
  applications
).reduce<Partial<Record<ApplicationKey, AppDisplayMeta>>>((acc, app: ApplicationDefinition) => {
  const marketingBadge = app.badge && app.badge !== 'Coming Soon' ? app.badge : undefined;
  acc[app.key] = {
    icon: resolveIcon(app.iconName, app.key),
    description: app.description || `${app.name} management module.`,
    badge: marketingBadge,
    availability: app.availability || (app.status === 'coming_soon' ? 'coming_soon' : 'available'),
    planRequirements: app.planRequirements || ['standard', 'premium', 'enterprise'],
  };
  return acc;
}, {});

export function getAppMeta(key: string): AppDisplayMeta {
  const normalizedKey = key.toLowerCase() as ApplicationKey;
  const canonicalApp = applications[normalizedKey];

  if (canonicalApp) {
    const marketingBadge =
      canonicalApp.badge && canonicalApp.badge !== 'Coming Soon' ? canonicalApp.badge : undefined;
    return {
      icon: resolveIcon(canonicalApp.iconName, canonicalApp.key),
      description: canonicalApp.description || `${canonicalApp.name} management module.`,
      badge: marketingBadge,
      availability:
        canonicalApp.availability ||
        (canonicalApp.status === 'coming_soon' ? 'coming_soon' : 'available'),
      planRequirements: canonicalApp.planRequirements || ['standard', 'premium', 'enterprise'],
    };
  }

  return {
    ...FALLBACK_META,
    description: `${key.charAt(0).toUpperCase() + key.slice(1)} management module.`,
  };
}

export { USER_FACING_APP_KEYS };

export function getActivatableAppKeys(): ApplicationKey[] {
  return Object.values(applications)
    .filter((app) => app.isActivatable)
    .map((app) => app.key);
}

export function getVisibleAppKeys(): ApplicationKey[] {
  return Object.values(applications)
    .filter((app) => app.isVisibleToUsers)
    .map((app) => app.key);
}

export function assertRegistryConsistency(): void {
  const canonicalKeys = new Set(Object.keys(applications).map((k) => k.toLowerCase()));
  const errors: string[] = [];

  for (const key of USER_FACING_APP_KEYS) {
    if (!canonicalKeys.has(key.toLowerCase())) {
      errors.push(`USER_FACING_APP_KEYS references unknown application "${key}"`);
    }
  }

  for (const app of Object.values(applications)) {
    if (app.isActivatable && (!app.planRequirements || app.planRequirements.length === 0)) {
      errors.push(`Activatable application "${app.key}" has no plan requirements`);
    }
    if (app.planRequirements) {
      for (const req of app.planRequirements) {
        if (!KNOWN_PLAN_KEYS.includes(req.toLowerCase() as KnownPlanKey)) {
          errors.push(`Application "${app.key}" references unknown plan key "${req}"`);
        }
      }
    }
  }

  if (errors.length > 0 && typeof console !== 'undefined') {
    console.warn(
      `[AppRegistry Consistency] ${errors.length} issue(s) detected:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}