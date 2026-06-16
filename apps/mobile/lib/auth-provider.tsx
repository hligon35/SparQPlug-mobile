import { useEffect, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api, clearToken, saveToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiResponse, User, Organization } from '@sparqplug/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setOrganization, setFirebaseToken, setLoading, signOut } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        await clearToken();
        signOut();
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        setFirebaseToken(idToken);
        await saveToken(idToken);

        const response = await api.post<ApiResponse<{ user: User; organization: Organization }>>(
          '/auth/session',
          { idToken },
        );

        if (response.success && response.data) {
          setUser(response.data.user);
          setOrganization(response.data.organization);
        } else {
          await clearToken();
          signOut();
        }
      } catch (error) {
        console.error('[MobileAuthProvider]', error);
        await clearToken();
        signOut();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setFirebaseToken, setLoading, setOrganization, setUser, signOut]);

  return <>{children}</>;
}