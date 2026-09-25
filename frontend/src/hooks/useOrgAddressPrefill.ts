import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { toast } from 'sonner';

export interface OrgAddressData {
  street: string;
  city: string;
  state: string;
  phone: string;
  phoneDigits: string;
  country?: string;
}

// In-memory cache across hook instances to prevent duplicate requests
const orgAddressCache = new Map<string, OrgAddressData>();

export function cleanNigerianPhone(val: string): string {
  let raw = val.replace(/\s+/g, '');
  if (raw.startsWith('+234')) {
    raw = raw.slice(4);
  } else if (raw.startsWith('234')) {
    raw = raw.slice(3);
  } else if (raw.startsWith('0')) {
    raw = raw.slice(1);
  }
  return raw;
}

export function useOrgAddressPrefill(organizationId?: string) {
  const { currentWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrgAddress = useCallback(
    async (targetOrgId?: string): Promise<OrgAddressData | null> => {
      const activeId = targetOrgId || organizationId || currentWorkspace?.id;
      if (!activeId) {
        const ws = currentWorkspace as any;
        if (ws) {
          const meta = ws?.metadata || {};
          const street = ws?.street || meta.street || '';
          const city = ws?.city || meta.city || '';
          const state = ws?.state || meta.state || '';
          const phone = ws?.phone || meta.phone || '';
          if (street || city || state || phone) {
            return {
              street,
              city,
              state,
              phone,
              phoneDigits: cleanNigerianPhone(phone),
              country: ws?.country || meta.country || 'Nigeria',
            };
          }
        }
        return null;
      }

      if (orgAddressCache.has(activeId)) {
        return orgAddressCache.get(activeId)!;
      }

      const ws = currentWorkspace as any;
      const meta = ws?.metadata || {};
      let orgStreet = (ws?.id === activeId ? (ws?.street || meta.street) : '') || '';
      let orgCity = (ws?.id === activeId ? (ws?.city || meta.city) : '') || '';
      let orgState = (ws?.id === activeId ? (ws?.state || meta.state) : '') || '';
      let orgPhone = (ws?.id === activeId ? (ws?.phone || meta.phone) : '') || '';

      if (!orgStreet && !orgPhone) {
        try {
          setIsLoading(true);
          const res = await api.get<any>(`/organizations/${activeId}`).catch(() => null);
          const orgData = res?.organization || res?.data?.organization || res?.data || res;
          if (orgData) {
            orgStreet = orgData.street || orgData.address || '';
            orgCity = orgData.city || '';
            orgState = orgData.state || '';
            orgPhone = orgData.phone || '';
          }
        } finally {
          setIsLoading(false);
        }
      }

      const result: OrgAddressData = {
        street: orgStreet,
        city: orgCity,
        state: orgState,
        phone: orgPhone,
        phoneDigits: cleanNigerianPhone(orgPhone),
        country: 'Nigeria',
      };

      if (orgStreet || orgPhone || orgCity || orgState) {
        orgAddressCache.set(activeId, result);
      }

      return result;
    },
    [organizationId, currentWorkspace]
  );

  const prefill = useCallback(
    async (
      setters: {
        setStreet?: (val: string) => void;
        setCity?: (val: string) => void;
        setStateName?: (val: string) => void;
        setPhoneDigits?: (val: string) => void;
      },
      overrideOrgId?: string
    ): Promise<boolean> => {
      try {
        const address = await fetchOrgAddress(overrideOrgId);
        if (!address || (!address.street && !address.phone && !address.city && !address.state)) {
          toast.info('Could not retrieve organization address details.');
          return false;
        }

        if (address.street && setters.setStreet) setters.setStreet(address.street);
        if (address.city && setters.setCity) setters.setCity(address.city);
        if (address.state && setters.setStateName) setters.setStateName(address.state);
        if (address.phoneDigits && setters.setPhoneDigits) setters.setPhoneDigits(address.phoneDigits);

        toast.success('Pre-filled address and contact details from organization!');
        return true;
      } catch {
        toast.info('Could not retrieve organization address details.');
        return false;
      }
    },
    [fetchOrgAddress]
  );

  return {
    fetchOrgAddress,
    prefill,
    isLoading,
  };
}
