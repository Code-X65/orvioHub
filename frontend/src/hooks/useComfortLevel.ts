/**
 * useComfortLevel - reads the team comfort level from the org's inventory onboarding data
 * and returns a derived UI density tier used to adapt tooltip verbosity, button sizes,
 * tour depth, and empty-state guidance across the inventory surface.
 *
 * Comfort level IDs (from InventoryAppOnboarding.tsx):
 *   'very'       -> compact  (tech-savvy, minimal hand-holding)
 *   'somewhat'   -> default  (guided but not verbose)
 *   'not_very'   -> spacious (big targets, reduced typing)
 *   'not_at_all' -> spacious (first-time users, maximum guidance)
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComfortLevelId = 'very' | 'somewhat' | 'not_very' | 'not_at_all';

/** Coarse UI density bucket surfaced to consuming components. */
export type UIDensityTier = 'compact' | 'default' | 'spacious';

export interface ComfortConfig {
  /** Raw comfort level identifier from onboarding */
  comfortLevelId: ComfortLevelId;
  /** Derived density tier */
  densityTier: UIDensityTier;
  /** Whether to show inline helper tooltips on controls */
  showTooltips: boolean;
  /** Whether to run an extended (multi-step) onboarding tour */
  extendedTour: boolean;
  /** Button size token */
  buttonSize: 'sm' | 'default' | 'lg';
  /** Input size token */
  inputSize: 'sm' | 'default' | 'lg';
  /** Whether to show detailed guidance copy in empty states */
  verboseEmptyStates: boolean;
}

// ---------------------------------------------------------------------------
// Static mapping
// ---------------------------------------------------------------------------

const COMFORT_CONFIGS: Record<ComfortLevelId, ComfortConfig> = {
  very: {
    comfortLevelId: 'very',
    densityTier: 'compact',
    showTooltips: false,
    extendedTour: false,
    buttonSize: 'sm',
    inputSize: 'sm',
    verboseEmptyStates: false,
  },
  somewhat: {
    comfortLevelId: 'somewhat',
    densityTier: 'default',
    showTooltips: true,
    extendedTour: false,
    buttonSize: 'default',
    inputSize: 'default',
    verboseEmptyStates: false,
  },
  not_very: {
    comfortLevelId: 'not_very',
    densityTier: 'spacious',
    showTooltips: true,
    extendedTour: true,
    buttonSize: 'lg',
    inputSize: 'lg',
    verboseEmptyStates: true,
  },
  not_at_all: {
    comfortLevelId: 'not_at_all',
    densityTier: 'spacious',
    showTooltips: true,
    extendedTour: true,
    buttonSize: 'lg',
    inputSize: 'lg',
    verboseEmptyStates: true,
  },
};

const DEFAULT_CONFIG: ComfortConfig = COMFORT_CONFIGS['somewhat'];

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function getCachedComfortLevel(orgId: string): ComfortLevelId | null {
  try {
    const raw = localStorage.getItem(`orvio_comfort_${orgId}`);
    if (raw && raw in COMFORT_CONFIGS) return raw as ComfortLevelId;
  } catch {
    // SSR / private browsing
  }
  return null;
}

function setCachedComfortLevel(orgId: string, level: ComfortLevelId): void {
  try {
    localStorage.setItem(`orvio_comfort_${orgId}`, level);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current UI comfort configuration for the active organisation.
 *
 * Resolution order:
 *  1. localStorage cache  (instant - avoids flash)
 *  2. /organizations/:id/inventory-onboarding API response
 *  3. Falls back to 'somewhat' (default) on error or missing data
 */
export function useComfortLevel(): ComfortConfig & {
  isLoading: boolean;
  /** Call this after the user updates their comfort level in Settings. */
  refresh: () => void;
} {
  const { currentWorkspace } = useWorkspaceStore();
  const orgId = currentWorkspace?.id ?? null;

  const initialLevel: ComfortLevelId =
    orgId ? (getCachedComfortLevel(orgId) ?? 'somewhat') : 'somewhat';

  const [comfortLevelId, setComfortLevelId] = useState<ComfortLevelId>(initialLevel);
  const [isLoading, setIsLoading] = useState(
    !orgId || getCachedComfortLevel(orgId) === null
  );

  const fetchComfortLevel = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.get<any>(`/organizations/${orgId}/inventory-onboarding`);

      // Support multiple known response shapes from the backend
      const raw: string | undefined =
        res?.teamComfortLevel ??
        res?.data?.teamComfortLevel ??
        res?.responses?.teamComfortLevel ??
        res?.data?.responses?.teamComfortLevel;

      if (raw && raw in COMFORT_CONFIGS) {
        const level = raw as ComfortLevelId;
        setComfortLevelId(level);
        setCachedComfortLevel(orgId, level);
      }
    } catch {
      // Keep cached / default value; fail silently
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  // On org change: serve cache instantly then reconcile with server
  useEffect(() => {
    if (orgId) {
      const cached = getCachedComfortLevel(orgId);
      if (cached) setComfortLevelId(cached);
    }
    fetchComfortLevel();
  }, [orgId, fetchComfortLevel]);

  const config = useMemo(
    () => COMFORT_CONFIGS[comfortLevelId] ?? DEFAULT_CONFIG,
    [comfortLevelId]
  );

  return { ...config, isLoading, refresh: fetchComfortLevel };
}
