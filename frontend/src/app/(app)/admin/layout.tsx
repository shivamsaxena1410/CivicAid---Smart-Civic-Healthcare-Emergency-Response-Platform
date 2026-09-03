'use client';

import { RequireAuth } from '../../../components/RequireAuth';
import type { Role } from '../../../types';

const STAFF: Role[] = ['ADMIN', 'AUTHORITY'];

/**
 * AUTHORITY is admitted here because alerts accept that role; the page itself
 * hides the ADMIN-only tabs rather than offering panels that would 403.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={STAFF}>{children}</RequireAuth>;
}
