import { create } from 'zustand';
import type { User, Organization } from '@sparqplug/types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setLoading: (v: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  organization: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, organization: null, isLoading: false }),
}));
