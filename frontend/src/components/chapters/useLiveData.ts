'use client';

import { live, organizations, type OrganizationWithDistance } from '../../lib/endpoints';
import { useAsync } from '../../lib/hooks';
import { useLocationStore } from '../../store/location.store';
import type { LiveEnvironment, LiveFacilityResult } from '../../types';

/**
 * Data hooks for the homepage chapters.
 *
 * The two sources are kept in separate hooks on purpose, because they carry
 * different guarantees and the UI must not blur them:
 *
 *   `useLiveFacilities` — real places from OpenStreetMap. Genuinely exist.
 *                         Carry no availability figures, ever.
 *   `useDemoOrganizations` — seeded fictional orgs. Their bed counts, blood
 *                         units and stock levels are invented for the demo.
 *
 * A component showing the second must say so. `<ProvenanceLabel>` in
 * `Provenance.tsx` is the shared way to do that.
 */

export function useLiveEnvironment(): {
  data: LiveEnvironment | null;
  loading: boolean;
  error: unknown;
} {
  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);
  const { data, loading, error } = useAsync(() => live.environment(lat, lng), [lat, lng]);
  return { data, loading, error };
}

export function useLiveFacilities(radiusKmOverride?: number): {
  data: LiveFacilityResult | null;
  loading: boolean;
  error: unknown;
} {
  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);
  const storeRadius = useLocationStore((s) => s.radiusKm);
  // Overpass is the most expensive upstream call in the app; a 15 km sweep of a
  // dense city returns hundreds of nodes. Cap the homepage at something a
  // reader can actually scan.
  const radiusKm = Math.min(radiusKmOverride ?? storeRadius, 5);
  const { data, loading, error } = useAsync(
    () => live.facilities(lat, lng, radiusKm),
    [lat, lng, radiusKm],
  );
  return { data, loading, error };
}

export function useDemoOrganizations(limit = 6): {
  data: OrganizationWithDistance[];
  loading: boolean;
  error: unknown;
} {
  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);
  const radiusKm = useLocationStore((s) => s.radiusKm);
  const { data, loading, error } = useAsync(
    () => organizations.search({ lat, lng, radiusKm, limit }),
    [lat, lng, radiusKm, limit],
  );
  return { data: data?.items ?? [], loading, error };
}
