'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import type { Role } from '../types';

/**
 * Client-side route protection.
 *
 * This is a UX affordance, not a security boundary: every protected endpoint is
 * guarded server-side by the global JWT + roles guards, so bypassing this
 * component yields a 401/403 from the API rather than data. It exists so an
 * unauthenticated user lands on /login instead of an empty screen full of
 * failed requests.
 */
export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  /** When set, the signed-in user must hold one of these roles. */
  roles?: Role[];
}) {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [isInitialized, user, roles, router]);

  // `isInitialized` distinguishes "still checking" from "checked, signed out".
  // Without it the first paint redirects everyone to /login on every reload.
  if (!isInitialized) {
    return (
      <div className="page-shell">
        <div className="skeleton" style={{ height: 140 }} />
      </div>
    );
  }

  if (!user || (roles && !roles.includes(user.role))) {
    return (
      <div className="page-shell">
        <p className="muted">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
