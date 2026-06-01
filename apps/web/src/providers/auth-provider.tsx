import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import type { ApiResponse, User, Organization } from '@sparqplug/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setOrganization, setFirebaseToken, setLoading, signOut } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        signOut();
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        setFirebaseToken(idToken);

        const response = await api.post<ApiResponse<{ user: User; organization: Organization }>>(
          '/auth/session',
          { idToken },
        );

        if (response.success && response.data) {
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
