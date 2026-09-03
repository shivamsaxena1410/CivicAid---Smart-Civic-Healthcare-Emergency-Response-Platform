'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth.store';

/**
 * Entry point. There is no separate marketing page — signed-in users go to the
 * dashboard, everyone else to the login screen (which carries the project
 * description and the demo accounts).
 */
export default function Home() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [isInitialized, user, router]);

  return (
    <div className="page-shell" style={{ paddingTop: '4rem' }}>
      <div className="skeleton" style={{ height: 120 }} />
    </div>
  );
}
