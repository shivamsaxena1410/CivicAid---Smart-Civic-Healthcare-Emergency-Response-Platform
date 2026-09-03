'use client';

import { useState } from 'react';
import { useLocationStore } from '../../../store/location.store';
import { useAsync, useDebounced } from '../../../lib/hooks';
import { hospitals } from '../../../lib/endpoints';
import { LocationBar } from '../../../components/LocationBar';
import { MapPanel } from '../../../components/MapPanel';
import { FacilityCard, Metric, MetricRow } from '../../../components/FacilityCard';
import { DemoBanner, EmptyState, ErrorNote, Pagination, PageHeader, SkeletonRows } from '../../../components/ui';
import { updatedLabel } from '../../../lib/format';

const TOGGLES = [
  { key: 'emergencyOnly', label: 'Emergency open' },
  { key: 'icuOnly', label: 'ICU beds free' },
  { key: 'oxygenOnly', label: 'Oxygen support' },
  { key: 'ventilatorOnly', label: 'Ventilators' },
] as const;

type ToggleKey = (typeof TOGGLES)[number]['key'];

export default function HospitalsPage() {
  const { lat, lng, radiusKm } = useLocationStore();
  const [filters, setFilters] = useState<Record<ToggleKey, boolean>>({
    emergencyOnly: false,
    icuOnly: false,
    oxygenOnly: false,
    ventilatorOnly: false,
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const query = useAsync(
    () =>
      hospitals.search({
        lat,
        lng,
        radiusKm,
        page,
        limit: 10,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        // Only send a filter when it is on. Sending `false` would ask the API to
        // filter for hospitals *without* ICU beds on some endpoints.
        ...Object.fromEntries(Object.entries(filters).filter(([, on]) => on)),
      }),
    [lat, lng, radiusKm, page, debouncedSearch, filters],
  );

  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader title="Hospital bed availability" subtitle="Live capacity as reported by each facility." />
      <DemoBanner />
      <LocationBar />

      <div className="glass-card" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          className="input-control"
          style={{ flex: '1 1 220px' }}
          placeholder="Search hospitals…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {TOGGLES.map((toggle) => (
          <button
            key={toggle.key}
            className={filters[toggle.key] ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.83rem' }}
            onClick={() => {
              setFilters((f) => ({ ...f, [toggle.key]: !f[toggle.key] }));
              setPage(1);
            }}
          >
            {toggle.label}
          </button>
        ))}
      </div>

      <MapPanel
        lat={lat}
        lng={lng}
        radiusKm={radiusKm}
        height={340}
        points={items.map((org) => ({
          id: org.id,
          name: org.name,
          latitude: org.latitude,
          longitude: org.longitude,
          type: org.type,
          distanceKm: org.distanceKm,
          detail: `${org.hospitalDetail?.availableGeneralBeds ?? 0} general · ${org.hospitalDetail?.availableIcuBeds ?? 0} ICU beds free`,
          href: `/hospitals/${org.id}`,
        }))}
      />

      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={3} height={160} />
      ) : items.length === 0 ? (
        <EmptyState title="No hospitals match" hint="Widen the radius or clear the filters." />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((org) => {
            const detail = org.hospitalDetail;
            const updated = updatedLabel(detail?.availabilityUpdatedAt);
            return (
              <FacilityCard key={org.id} org={org}>
                <MetricRow>
                  <Metric
                    label="General beds"
                    value={detail?.availableGeneralBeds ?? '—'}
                    accent={detail && detail.availableGeneralBeds > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}
                  />
                  <Metric
                    label="ICU beds"
                    value={detail?.availableIcuBeds ?? '—'}
                    accent={detail && detail.availableIcuBeds > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}
                  />
                  <Metric label="Total beds" value={detail?.totalBeds ?? '—'} />
                  <Metric
                    label="Emergency"
                    value={detail?.emergencyAvailable ? 'Open' : 'Closed'}
                    accent={detail?.emergencyAvailable ? 'var(--accent-emerald)' : 'var(--accent-rose)'}
                  />
                </MetricRow>
                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {detail?.hasOxygenSupport ? <span className="badge badge-cyan">oxygen</span> : null}
                  {detail?.hasVentilators ? <span className="badge badge-cyan">ventilators</span> : null}
                  {(detail?.departments ?? []).slice(0, 4).map((dept) => (
                    <span key={dept} className="badge badge-emerald">
                      {dept}
                    </span>
                  ))}
                  {/* A capacity number with no timestamp is not actionable; an
                      old one is actively misleading during an emergency. */}
                  <span className={updated.stale ? 'badge badge-amber' : 'badge badge-cyan'}>
                    updated {updated.text}
                  </span>
                </div>
              </FacilityCard>
            );
          })}
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
