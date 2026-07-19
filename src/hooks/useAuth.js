import { useEffect, useState } from 'react';
import { AuthService } from '../lib/auth/authService.js';

export default function useAuth({ refreshWorkspace }) {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AuthService.getSession()
      .then((session) => {
        if (isMounted) setAuthSession(session);
      })
      .catch(() => {
        if (isMounted) setAuthSession(null);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    const subscription = AuthService.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthSession(session);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setSignOutLoading(true);
    refreshWorkspace({ error: '' });

    const { error } = await AuthService.signOut();

    if (error) {
      refreshWorkspace({ error: 'No fue posible cerrar la sesión. Intenta nuevamente.' });
      setSignOutLoading(false);
      return;
    }

    setAuthSession(null);
    refreshWorkspace({ reset: true });
    setSignOutLoading(false);
  }

  return {
    authSession,
    authLoading,
    signOutLoading,
    handleSignOut,
  };
}
