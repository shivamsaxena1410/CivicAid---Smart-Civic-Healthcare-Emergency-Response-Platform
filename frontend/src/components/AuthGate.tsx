'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

/**
 * Runs the session restore exactly once for the whole app.
 *
 * `checkAuth` hits `/auth/me`, so putting it in each page would fire one request
 * per navigation. Route protection itself lives in `RequireAuth`, which only
 * reads the resulting store state.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
}
