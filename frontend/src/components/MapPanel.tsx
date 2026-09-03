'use client';

import dynamic from 'next/dynamic';
import type { MapPoint } from './FacilityMap';

/**
 * Client-side-only wrapper around the Leaflet map.
 *
 * Per the bundled Next.js docs, `ssr: false` is only valid inside a Client
 * Component, so the dynamic import lives here rather than in each page.
 */
const FacilityMap = dynamic(() => import('./FacilityMap'), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 420, marginBottom: '1rem' }} />,
});

export function MapPanel(props: {
  points: MapPoint[];
  lat: number;
  lng: number;
  radiusKm: number;
  height?: number;
}) {
  return <FacilityMap {...props} />;
}

export type { MapPoint };
