'use client';

import { useState } from 'react';
import { useLocationStore } from '../../../store/location.store';
import { useAsync, useDebounced } from '../../../lib/hooks';
import { organizations } from '../../../lib/endpoints';
import { LocationBar } from '../../../components/LocationBar';
import { MapPanel } from '../../../components/MapPanel';
import { FacilityCard } from '../../../components/FacilityCard';
import { DemoBanner, EmptyState, ErrorNote, Pagination, PageHeader, SkeletonRows } from '../../../components/ui';
import type { OrgType } from '../../../types';

const TYPE_FILTERS: Array<{ value: OrgType | ''; label: string }> = [
  { value: '', label: 'All facilities' },
  { value: 'HOSPITAL', label: 'Hospitals' },
  { value: 'BLOOD_BANK', label: 'Blood banks' },
  { value: 'PHARMACY', label: 'Pharmacies' },
  { value: 'AMBULANCE_PROVIDER', label: 'Ambulance providers' },
  { value: 'NGO', label: 'NGOs' },
];

export default function DiscoverPage() {
  const { lat, lng, radiusKm } = useLocationStore();
  const [type, setType] = useState<OrgType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const query = useAsync(
    () =>
      organizations.search({
        lat,
        lng,
        radiusKm,
        page,
        limit: 12,
        ...(type ? { type } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    [lat, lng, radiusKm, type, debouncedSearch, page],
  );

  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Nearby facilities"
        subtitle="Every verified facility within your search radius, ordered by real distance (PostGIS)."
      />
      <DemoBanner />
      <LocationBar />

      <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          className="input-control"
          style={{ flex: '1 1 240px' }}
          placeholder="Search by name or city…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input-control"
          style={{ width: 'auto' }}
          value={type}
          onChange={(e) => {
            setType(e.target.value as OrgType | '');
            setPage(1);
          }}
        >
          {TYPE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <MapPanel
        lat={lat}
        lng={lng}
        radiusKm={radiusKm}
        points={items.map((org) => ({
          id: org.id,
          name: org.name,
          latitude: org.latitude,
          longitude: org.longitude,
          type: org.type,
          distanceKm: org.distanceKm,
          detail: `${org.address}, ${org.city}`,
        }))}
      />

      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No facilities in range"
          hint="Try a larger radius, clear the search box, or switch back to the demo centre."
        />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((org) => (
            <FacilityCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {query.data ? (
        <Pagination
          page={query.data.meta.page}
          totalPages={query.data.meta.totalPages}
          total={query.data.meta.total}
          onChange={setPage}
        />
      ) : null}
    </>
  );
}
