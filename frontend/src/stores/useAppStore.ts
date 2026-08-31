import { create } from 'zustand';

interface UserProfile {
  name: string;
  email: string;
  role: string;
}

interface AppState {
  user: UserProfile;
  counter: number;
  activeTab: string;
  notifications: string[];
  incrementCounter: () => void;
  decrementCounter: () => void;
  setActiveTab: (tab: string) => void;
  addNotification: (message: string) => void;
  updateUser: (user: Partial<UserProfile>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: {
    name: 'Developer',
    email: 'dev@orviohub.io',
    role: 'Fullstack Engineer',
  },
  counter: 42,
  activeTab: 'overview',
  notifications: ['System online', 'Fastify backend API connected'],
  incrementCounter: () => set((state) => ({ counter: state.counter + 1 })),
  decrementCounter: () => set((state) => ({ counter: state.counter - 1 })),
  setActiveTab: (activeTab) => set({ activeTab }),
  addNotification: (msg) =>
    set((state) => ({ notifications: [msg, ...state.notifications] })),
  updateUser: (newUser) =>
    set((state) => ({ user: { ...state.user, ...newUser } })),
}));
