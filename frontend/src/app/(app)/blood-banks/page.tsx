'use client';

import { useState } from 'react';
import { useLocationStore } from '../../../store/location.store';
import { useAsync } from '../../../lib/hooks';
import { bloodBanks } from '../../../lib/endpoints';
import { LocationBar } from '../../../components/LocationBar';
import { MapPanel } from '../../../components/MapPanel';
import { FacilityCard, Metric, MetricRow } from '../../../components/FacilityCard';
import { DemoBanner, EmptyState, ErrorNote, Pagination, PageHeader, SkeletonRows } from '../../../components/ui';
import { BLOOD_LABEL, BLOOD_TYPES } from '../../../lib/format';
import type { BloodType } from '../../../types';

export default function BloodBanksPage() {
  const { lat, lng, radiusKm } = useLocationStore();
  const [bloodType, setBloodType] = useState<BloodType | ''>('');
  const [minUnits, setMinUnits] = useState(1);
  const [page, setPage] = useState(1);

  const query = useAsync(
    () =>
      bloodBanks.search({
        lat,
        lng,
        radiusKm,
        page,
        limit: 10,
        ...(bloodType ? { bloodType, minUnits } : {}),
      }),
    [lat, lng, radiusKm, bloodType, minUnits, page],
  );

  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader title="Blood availability" subtitle="Units in stock by blood group, nearest first." />
      <DemoBanner />
      <LocationBar />

      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <div className="field-label">Blood group needed</div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={bloodType === '' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.85rem' }}
            onClick={() => {
              setBloodType('');
              setPage(1);
            }}
          >
            Any
          </button>
          {BLOOD_TYPES.map((type) => (
            <button
              key={type.value}
              className={bloodType === type.value ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '0.85rem', minWidth: 54, justifyContent: 'center' }}
              onClick={() => {
                setBloodType(type.value);
                setPage(1);
              }}
            >
              {type.label}
            </button>
          ))}
        </div>

        {bloodType ? (
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.85rem' }}>
            <span className="field-label" style={{ margin: 0 }}>
              Minimum units
            </span>
            <input
              className="input-control"
              style={{ width: 100 }}
              type="number"
              min={1}
              value={minUnits}
              onChange={(e) => {
                setMinUnits(Math.max(1, Number(e.target.value) || 1));
                setPage(1);
              }}
            />
          </label>
        ) : null}
      </div>

      <MapPanel
        lat={lat}
        lng={lng}
        radiusKm={radiusKm}
        height={320}
        points={items.map((org) => ({
          id: org.id,
          name: org.name,
          latitude: org.latitude,
          longitude: org.longitude,
          type: org.type,
          distanceKm: org.distanceKm,
          detail: bloodType
            ? `${org.bloodBankInventory?.find((i) => i.bloodType === bloodType)?.unitsAvailable ?? 0} units of ${BLOOD_LABEL[bloodType]}`
            : `${(org.bloodBankInventory ?? []).reduce((sum, i) => sum + i.unitsAvailable, 0)} units total`,
          href: `/blood-banks/${org.id}`,
        }))}
      />

      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={3} height={170} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No blood banks match"
          hint={bloodType ? `No stock of ${BLOOD_LABEL[bloodType]} in range. Try a larger radius.` : 'Try a larger radius.'}
        />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((org) => {
            const inventory = org.bloodBankInventory ?? [];
            // Sort by the app's canonical group order, not by the arbitrary row
            // order the API returns, so the grid does not reshuffle per card.
            const byType = new Map(inventory.map((i) => [i.bloodType, i]));
            return (
              <FacilityCard key={org.id} org={org}>
                <MetricRow>
                  {BLOOD_TYPES.map((type) => {
                    const units = byType.get(type.value)?.unitsAvailable ?? 0;
                    const highlighted = bloodType === type.value;
                    return (
                      <Metric
                        key={type.value}
                        label={type.label}
                        value={units}
                        accent={
                          units === 0
                            ? 'var(--text-muted)'
                            : highlighted
                              ? 'var(--accent-cyan)'
                              : 'var(--accent-emerald)'
                        }
                      />
                    );
                  })}
                </MetricRow>
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
