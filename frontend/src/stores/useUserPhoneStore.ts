import { create } from 'zustand';
import { api } from '../lib/api';
import { useAuthStore } from './useAuthStore';
import { toast } from 'sonner';

export interface UserPhone {
  _id: string;
  userId: string;
  phone: string;
  phoneNormalized: string;
  isVerified: boolean;
  isPrimary: boolean;
  verifiedAt?: number;
  createdAt: number;
}

interface UserPhoneStoreState {
  phones: UserPhone[];
  isLoading: boolean;
  isSendingOtp: boolean;
  isVerifyingOtp: boolean;
  activePhoneForVerification: string | null;

  // Actions
  fetchPhones: () => Promise<UserPhone[]>;
  sendOtp: (phone: string) => Promise<{ success: boolean; normalizedPhone?: string; expiresInSeconds?: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean }>;
  setPrimary: (phoneId: string) => Promise<boolean>;
  deletePhone: (phoneId: string) => Promise<boolean>;
  setActivePhoneForVerification: (phone: string | null) => void;
}

export const useUserPhoneStore = create<UserPhoneStoreState>((set, get) => ({
  phones: [],
  isLoading: false,
  isSendingOtp: false,
  isVerifyingOtp: false,
  activePhoneForVerification: null,

  setActivePhoneForVerification: (phone) => set({ activePhoneForVerification: phone }),

  fetchPhones: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ phones?: UserPhone[]; data?: { phones: UserPhone[] } }>('/users/me/phones');
      const phones = response.data?.phones || response.phones || [];
      set({ phones, isLoading: false });
      return phones;
    } catch (err: any) {
      set({ isLoading: false });
      return [];
    }
  },

  sendOtp: async (phone: string) => {
    set({ isSendingOtp: true });
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        data?: { phoneId: string; normalizedPhone: string; expiresInSeconds: number };
      }>('/users/me/phones/send-otp', { phone });

      toast.success(response.message || 'Verification code sent.');
      set({
        isSendingOtp: false,
        activePhoneForVerification: phone,
      });

      return {
        success: true,
        normalizedPhone: response.data?.normalizedPhone,
        expiresInSeconds: response.data?.expiresInSeconds || 600,
      };
    } catch (err: any) {
      set({ isSendingOtp: false });
      toast.error(err.message || 'Failed to send verification code.');
      throw err;
    }
  },

  verifyOtp: async (phone: string, otp: string) => {
    set({ isVerifyingOtp: true });
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        data?: any;
      }>('/users/me/phones/verify-otp', { phone, otp });

      toast.success(response.message || 'Phone number verified successfully!');
      set({ isVerifyingOtp: false, activePhoneForVerification: null });

      // Refresh list of phones and session
      await get().fetchPhones();
      await useAuthStore.getState().refreshSession();

      return { success: true };
    } catch (err: any) {
      set({ isVerifyingOtp: false });
      toast.error(err.message || 'Verification failed. Please check the code.');
      throw err;
    }
  },

  setPrimary: async (phoneId: string) => {
    try {
      await api.post(`/users/me/phones/${phoneId}/set-primary`);
      toast.success('Primary phone number updated.');
      await get().fetchPhones();
      await useAuthStore.getState().refreshSession();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary phone.');
      return false;
    }
  },

  deletePhone: async (phoneId: string) => {
    try {
      await api.delete(`/users/me/phones/${phoneId}`);
      toast.success('Phone number removed.');
      await get().fetchPhones();
      await useAuthStore.getState().refreshSession();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove phone number.');
      return false;
    }
  },
}));
