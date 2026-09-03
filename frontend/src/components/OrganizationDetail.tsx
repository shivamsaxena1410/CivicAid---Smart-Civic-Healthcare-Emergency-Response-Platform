'use client';

import Link from 'next/link';
import { useAsync } from '../lib/hooks';
import { organizations } from '../lib/endpoints';
import { DemoBanner, ErrorNote, PageHeader, SkeletonRows, VerificationBadge } from './ui';
import { Metric, MetricRow } from './FacilityCard';
import { BLOOD_LABEL, ORG_TYPE_LABEL, updatedLabel } from '../lib/format';
import type { BloodType } from '../types';

/**
 * One detail screen for all facility types.
 *
 * `GET /organizations/:id` already returns every nested relation, so hospitals,
 * blood banks, pharmacies and ambulance providers differ only in which block is
 * rendered — not in how the data is fetched.
 */
export function OrganizationDetail({ id, backHref, backLabel }: { id: string; backHref: string; backLabel: string }) {
  const { data: org, loading, error } = useAsync(() => organizations.get(id), [id]);

  if (loading) return <SkeletonRows count={3} height={140} />;
  if (error) return <ErrorNote error={error} />;
  if (!org) return <ErrorNote error={new Error('Facility not found.')} />;

  const hospital = org.hospitalDetail;
  const inventory = org.bloodBankInventory ?? [];
  const medicines = org.pharmacyMedicines ?? [];
  const vehicles = org.ambulanceDetails ?? [];
  const updated = updatedLabel(hospital?.availabilityUpdatedAt);

  return (
    <>
      <Link href={backHref} className="subtle" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
        ← {backLabel}
      </Link>

      <PageHeader
        title={org.name}
        subtitle={`${ORG_TYPE_LABEL[org.type] ?? org.type} · ${org.address}, ${org.city} ${org.pincode}`}
        action={<VerificationBadge status={org.verificationStatus} />}
      />

      <DemoBanner />

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h2 className="section-title">Contact</h2>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.92rem' }}>
          <div>
            <span className="muted">Phone: </span>
            <a href={`tel:${org.phone}`} style={{ color: 'var(--accent-cyan)' }}>
              {org.phone}
            </a>
          </div>
          <div>
            <span className="muted">Email: </span>
            {org.email}
          </div>
          {org.website ? (
            <div>
              <span className="muted">Website: </span>
              {org.website}
            </div>
          ) : null}
          <div className="subtle">
            {org.latitude.toFixed(5)}, {org.longitude.toFixed(5)}
          </div>
        </div>
        {org.description ? (
          <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.92rem' }}>
            {org.description}
          </p>
        ) : null}
      </div>

      {hospital ? (
        <section className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">Bed availability</h2>
          <MetricRow>
            <Metric label="General free" value={hospital.availableGeneralBeds} accent="var(--accent-emerald)" />
            <Metric label="ICU free" value={hospital.availableIcuBeds} accent="var(--accent-rose)" />
            <Metric label="Total beds" value={hospital.totalBeds} />
            <Metric
              label="Emergency"
              value={hospital.emergencyAvailable ? 'Open' : 'Closed'}
              accent={hospital.emergencyAvailable ? 'var(--accent-emerald)' : 'var(--accent-rose)'}
            />
          </MetricRow>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {hospital.hasOxygenSupport ? <span className="badge badge-cyan">oxygen</span> : null}
            {hospital.hasVentilators ? <span className="badge badge-cyan">ventilators</span> : null}
            <span className={updated.stale ? 'badge badge-amber' : 'badge badge-cyan'}>updated {updated.text}</span>
          </div>
          {hospital.departments?.length ? (
            <p className="subtle" style={{ marginTop: '0.7rem' }}>
              Departments: {hospital.departments.join(', ')}
            </p>
          ) : null}
          {hospital.operatingHours ? (
            <p className="subtle" style={{ marginTop: '0.3rem' }}>
              Hours: {hospital.operatingHours}
            </p>
          ) : null}
        </section>
      ) : null}

      {inventory.length > 0 ? (
        <section className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">Blood stock</h2>
          <MetricRow>
            {inventory.map((item) => (
              <Metric
                key={item.id}
                label={BLOOD_LABEL[item.bloodType as BloodType] ?? item.bloodType}
                value={item.unitsAvailable}
                accent={item.unitsAvailable > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)'}
              />
            ))}
          </MetricRow>
        </section>
      ) : null}

      {medicines.length > 0 ? (
        <section className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', overflowX: 'auto' }}>
          <h2 className="section-title">Medicine stock</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Generic</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((medicine) => (
                <tr key={medicine.id}>
                  <td>{medicine.medicineName}</td>
                  <td className="subtle">{medicine.genericName ?? '—'}</td>
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
        </section>
      ) : null}

      {vehicles.length > 0 ? (
        <section className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">Fleet</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.92rem' }}>{vehicle.vehicleNumber}</strong>
                <span className="subtle">{vehicle.vehicleType}</span>
                <span
                  className={
                    vehicle.status === 'AVAILABLE'
                      ? 'badge badge-emerald'
                      : vehicle.status === 'BUSY'
                        ? 'badge badge-amber'
                        : 'badge badge-rose'
                  }
                >
                  {vehicle.status.toLowerCase()}
                </span>
                <span className="subtle">{vehicle.contactNumber}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
