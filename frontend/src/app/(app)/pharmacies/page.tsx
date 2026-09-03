'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocationStore } from '../../../store/location.store';
import { useAsync, useDebounced } from '../../../lib/hooks';
import { pharmacies } from '../../../lib/endpoints';
import { LocationBar } from '../../../components/LocationBar';
import { MapPanel } from '../../../components/MapPanel';
import { FacilityCard, Metric, MetricRow } from '../../../components/FacilityCard';
import { DemoBanner, EmptyState, ErrorNote, Pagination, PageHeader, SkeletonRows } from '../../../components/ui';

type Mode = 'medicine' | 'pharmacy';

export default function PharmaciesPage() {
  const { lat, lng, radiusKm } = useLocationStore();
  const [mode, setMode] = useState<Mode>('medicine');
  const [medicineName, setMedicineName] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [page, setPage] = useState(1);
  const debouncedName = useDebounced(medicineName);

  // Two distinct questions: "who stocks this drug?" (medicine search, returns
  // medicine rows) and "which pharmacies are near me?" (facility search).
  const medicineQuery = useAsync(
    () =>
      mode === 'medicine'
        ? pharmacies.searchMedicines({
            lat,
            lng,
            radiusKm,
            page,
            limit: 15,
            inStockOnly,
            ...(debouncedName ? { medicineName: debouncedName } : {}),
          })
        : Promise.resolve(null),
    [mode, lat, lng, radiusKm, page, inStockOnly, debouncedName],
  );

  const pharmacyQuery = useAsync(
    () =>
      mode === 'pharmacy'
        ? pharmacies.search({ lat, lng, radiusKm, page, limit: 10 })
        : Promise.resolve(null),
    [mode, lat, lng, radiusKm, page],
  );

  const medicines = medicineQuery.data?.items ?? [];
  const pharmacyItems = pharmacyQuery.data?.items ?? [];
  const active = mode === 'medicine' ? medicineQuery : pharmacyQuery;
  const meta = mode === 'medicine' ? medicineQuery.data?.meta : pharmacyQuery.data?.meta;

  // In medicine mode every result row carries its pharmacy, so the map plots
  // the distinct pharmacies rather than one pin per drug.
  const mapPoints =
    mode === 'medicine'
      ? Array.from(
          new Map(
            medicines
              .filter((m) => m.organization)
              .map((m) => [
                m.organization!.id,
                {
                  id: m.organization!.id,
                  name: m.organization!.name,
                  latitude: m.organization!.latitude,
                  longitude: m.organization!.longitude,
                  type: m.organization!.type,
                  distanceKm: m.distanceKm,
                  detail: `${m.medicineName} · ₹${m.price}`,
                  href: `/pharmacies/${m.organization!.id}`,
                },
              ]),
          ).values(),
        )
      : pharmacyItems.map((org) => ({
          id: org.id,
          name: org.name,
          latitude: org.latitude,
          longitude: org.longitude,
          type: org.type,
          distanceKm: org.distanceKm,
          detail: `${org.pharmacyMedicines?.length ?? 0} medicines listed`,
          href: `/pharmacies/${org.id}`,
        }));

  return (
    <>
      <PageHeader title="Pharmacies & medicine stock" subtitle="Find who has a medicine in stock near you." />
      <DemoBanner />
      <LocationBar />

      <div className="glass-card" style={{ marginBottom: '1rem', display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={mode === 'medicine' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              setMode('medicine');
              setPage(1);
            }}
          >
            Search a medicine
          </button>
          <button
            className={mode === 'pharmacy' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              setMode('pharmacy');
              setPage(1);
            }}
          >
            Browse pharmacies
          </button>
        </div>

        {mode === 'medicine' ? (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input-control"
              style={{ flex: '1 1 240px' }}
              placeholder="Medicine name, e.g. Paracetamol"
              value={medicineName}
              onChange={(e) => {
                setMedicineName(e.target.value);
                setPage(1);
              }}
            />
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.87rem' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  setPage(1);
                }}
              />
              In stock only
            </label>
          </div>
        ) : null}
      </div>

      <MapPanel lat={lat} lng={lng} radiusKm={radiusKm} height={320} points={mapPoints} />

      <ErrorNote error={active.error} />

      {active.loading ? (
        <SkeletonRows count={4} height={90} />
      ) : mode === 'medicine' ? (
        medicines.length === 0 ? (
          <EmptyState
            title="No matching stock in range"
            hint="Try a different spelling, widen the radius, or untick “in stock only”."
          />
        ) : (
          <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Pharmacy</th>
                  <th>Distance</th>
                  <th>Price</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((medicine) => (
                  <tr key={medicine.id}>
                    <td>
                      <strong>{medicine.medicineName}</strong>
                      {medicine.genericName ? <div className="subtle">{medicine.genericName}</div> : null}
                    </td>
                    <td>
                      {medicine.organization ? (
                        <Link href={`/pharmacies/${medicine.organization.id}`} style={{ color: 'var(--accent-cyan)' }}>
                          {medicine.organization.name}
                        </Link>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                      {medicine.organization ? <div className="subtle">{medicine.organization.city}</div> : null}
                    </td>
                    <td>
                      {medicine.distanceKm !== null && medicine.distanceKm !== undefined
                        ? `${medicine.distanceKm.toFixed(2)} km`
                        : '—'}
                    </td>
                    <td>₹{Number(medicine.price).toFixed(2)}</td>
                    <td>
                      {medicine.inStock ? (
                        <span className="badge badge-emerald">{medicine.quantity} left</span>
                      ) : (
                        <span className="badge badge-rose">out of stock</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : pharmacyItems.length === 0 ? (
        <EmptyState title="No pharmacies in range" hint="Try a larger radius." />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {pharmacyItems.map((org) => {
            const stock = org.pharmacyMedicines ?? [];
            return (
              <FacilityCard key={org.id} org={org}>
                <MetricRow>
                  <Metric label="Medicines listed" value={stock.length} />
                  <Metric
                    label="In stock"
                    value={stock.filter((m) => m.inStock).length}
                    accent="var(--accent-emerald)"
                  />
                </MetricRow>
              </FacilityCard>
            );
          })}
        </div>
      )}

      {meta ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
      ) : null}
    </>
  );
}
