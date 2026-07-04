import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import type { ApiResponse, User, Organization } from '@sparqplug/types';

const PENDING_ORGANIZATION_NAME_KEY = 'sparqplug.pendingOrganizationName';

function getPendingOrganizationName() {
  if (typeof window === 'undefined') return undefined;
  const value = window.localStorage.getItem(PENDING_ORGANIZATION_NAME_KEY)?.trim();
  return value || undefined;
}

function clearPendingOrganizationName() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_ORGANIZATION_NAME_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setOrganization, setFirebaseToken, setLoading, signOut } = useAuthStore();

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        signOut();
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        setFirebaseToken(idToken);

        const organizationName = getPendingOrganizationName();
        const response = await api.post<ApiResponse<{ user: User; organization: Organization }>>(
          '/auth/session',
          { idToken, ...(organizationName ? { organizationName } : {}) },
        );

        if (response.success && response.data) {
          clearPendingOrganizationName();
          setUser(response.data.user);
          setOrganization(response.data.organization);
        } else {
          signOut();
        }
      } catch (err) {
        console.error('[AuthProvider]', err);
        signOut();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setOrganization, setFirebaseToken, setLoading, signOut]);

  return <>{children}</>;
}