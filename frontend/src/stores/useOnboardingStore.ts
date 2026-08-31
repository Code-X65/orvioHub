import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface OnboardingState {
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  formData: Record<string, any>;
  isLoading: boolean;

  fetchStatus: () => Promise<void>;
  startFlow: (initialStep?: string, productKey?: string, workspaceId?: string) => Promise<void>;
  updateProgress: (step: string, data: any) => Promise<void>;
  completeStep: (step: string, nextStep?: string, data?: any) => Promise<void>;
  skipStep: (step: string, nextStep?: string) => Promise<void>;
  completeFlow: (finalData?: any) => Promise<void>;
  skipPermanently: () => Promise<void>;
  resetFlow: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      status: 'pending',
      currentStep: 'account_creation',
      completedSteps: [],
      skippedSteps: [],
      formData: {},
      isLoading: false,

  fetchStatus: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ flow?: any; status?: any }>('/onboarding');
      if (res.flow) {
        set({
          status: res.flow.status || 'pending',
          currentStep: res.flow.currentStep || 'account_creation',
          completedSteps: res.flow.completedSteps || [],
          skippedSteps: res.flow.skippedSteps || [],
          formData: res.flow.stepData || {},
        });
      }
    } catch {
      // Fallback
    } finally {
      set({ isLoading: false });
    }
  },

  startFlow: async (initialStep = 'profile_setup', productKey, workspaceId) => {
    set({ isLoading: true });
    try {
      const res = await api.post<{ flow: any }>('/onboarding/start', {
        initialStep,
        productKey,
        workspaceId,
      });
      if (res.flow) {
        set({
          status: res.flow.status || 'in_progress',
          currentStep: res.flow.currentStep || initialStep,
          completedSteps: res.flow.completedSteps || [],
          skippedSteps: res.flow.skippedSteps || [],
          formData: res.flow.stepData || {},
        });
      }
    } catch {
      set({ status: 'in_progress', currentStep: initialStep });
    } finally {
      set({ isLoading: false });
    }
  },

  updateProgress: async (step, data) => {
    try {
      await api.patch('/onboarding/progress', { step, data });
      set((state) => ({
        currentStep: step,
        formData: { ...state.formData, [step]: data, ...data },
      }));
    } catch {
      set((state) => ({
        currentStep: step,
        formData: { ...state.formData, [step]: data, ...data },
      }));
    }
  },

  completeStep: async (step, nextStep, data) => {
    try {
      await api.post('/onboarding/complete-step', { step, nextStep, data });
      set((state) => ({
        currentStep: nextStep || step,
        completedSteps: Array.from(new Set([...state.completedSteps, step])),
        formData: data ? { ...state.formData, [step]: data, ...data } : state.formData,
      }));
    } catch {
      set((state) => ({
        currentStep: nextStep || step,
        completedSteps: Array.from(new Set([...state.completedSteps, step])),
      }));
    }
  },

  skipStep: async (step, nextStep) => {
    try {
      await api.post('/onboarding/skip-step', { step, nextStep });
      set((state) => ({
        currentStep: nextStep || step,
        skippedSteps: Array.from(new Set([...state.skippedSteps, step])),
      }));
    } catch {
      set((state) => ({
        currentStep: nextStep || step,
        skippedSteps: Array.from(new Set([...state.skippedSteps, step])),
      }));
    }
  },

  completeFlow: async (finalData) => {
    set({ isLoading: true });
    try {
      await api.post('/onboarding/complete', { finalData });
      set({ status: 'completed', currentStep: 'completed' });
    } catch {
      set({ status: 'completed', currentStep: 'completed' });
    } finally {
      set({ isLoading: false });
    }
  },

  skipPermanently: async () => {
    set({ isLoading: true });
    try {
      await api.post('/onboarding/skip-permanently', {});
      set({ status: 'completed', currentStep: 'completed' });
    } catch {
      set({ status: 'completed', currentStep: 'completed' });
    } finally {
      set({ isLoading: false });
    }
  },

  resetFlow: async () => {
    set({ isLoading: true });
    try {
      await api.post('/onboarding/reset', {});
      set({
        status: 'pending',
        currentStep: 'account_creation',
        completedSteps: [],
        skippedSteps: [],
        formData: {},
      });
    } catch {
      set({
        status: 'pending',
        currentStep: 'account_creation',
        completedSteps: [],
        skippedSteps: [],
        formData: {},
      });
    } finally {
      set({ isLoading: false });
    }
  },
}),
    {
      name: 'orvio_onboarding_state',
      partialize: (state) => ({
        status: state.status,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        skippedSteps: state.skippedSteps,
        formData: state.formData,
      }),
    }
  )
);
