import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization } from '@sparqplug/types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  firebaseToken: string | null;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setFirebaseToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organization: null,
      firebaseToken: null,
      isLoading: true,

      setUser: (user) => set({ user }),
      setOrganization: (organization) => set({ organization }),
      setFirebaseToken: (firebaseToken) => set({ firebaseToken }),
      setLoading: (isLoading) => set({ isLoading }),
      signOut: () =>
        set({ user: null, organization: null, firebaseToken: null, isLoading: false }),
    }),
    {
      name: 'sparqplug-auth',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
      }),
    },
  ),
);
