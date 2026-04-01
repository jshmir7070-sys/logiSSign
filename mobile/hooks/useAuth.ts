import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { session, driver, isLoading, setSession, fetchDriver } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user.id) {
        fetchDriver(currentSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user.id) {
          fetchDriver(newSession.user.id);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, fetchDriver]);

  return { session, driver, isLoading };
}
