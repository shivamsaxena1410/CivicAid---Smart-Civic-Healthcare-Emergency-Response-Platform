'use client';

import { NavBar } from '../../components/NavBar';
import { RequireAuth } from '../../components/RequireAuth';

/**
 * Layout for every signed-in route.
 *
 * Route groups keep `/dashboard`, `/hospitals` etc. as top-level URLs while
 * sharing one nav bar and one auth guard, instead of each page repeating both.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <NavBar />
      <div className="page-shell">{children}</div>
    </RequireAuth>
  );
}
