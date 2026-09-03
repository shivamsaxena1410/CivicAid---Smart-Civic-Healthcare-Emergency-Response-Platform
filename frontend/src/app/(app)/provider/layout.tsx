'use client';

import { RequireAuth } from '../../../components/RequireAuth';
import { PROVIDER_ROLES } from '../../../store/auth.store';

/** Only facility roles reach the provider console; the API enforces the same. */
export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={PROVIDER_ROLES}>{children}</RequireAuth>;
}
