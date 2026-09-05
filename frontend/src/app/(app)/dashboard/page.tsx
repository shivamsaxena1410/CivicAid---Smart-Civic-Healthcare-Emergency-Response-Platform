'use client';

import Link from 'next/link';
import { useAuthStore, isProvider, isStaff } from '../../../store/auth.store';
import { useLocationStore } from '../../../store/location.store';
import { useAsync } from '../../../lib/hooks';
import { alerts, ambulances, complaints, hospitals, schemes } from '../../../lib/endpoints';
import { DemoBanner, EmptyState, ErrorNote, Grid, PageHeader, SkeletonRows, StatCard } from '../../../components/ui';
import type { AlertSeverity } from '../../../types';

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  CRITICAL: 'badge badge-rose live-pulse',
  HIGH: 'badge badge-rose',
  MEDIUM: 'badge badge-amber',
  LOW: 'badge badge-cyan',
};

const QUICK_LINKS = [
  { href: '/discover', label: 'Nearby facilities', hint: 'Map + list of every facility type', accent: 'var(--accent-cyan)' },
  { href: '/hospitals', label: 'Hospital beds', hint: 'ICU, general, oxygen, ventilators', accent: 'var(--accent-blue)' },
  { href: '/blood-banks', label: 'Blood availability', hint: 'Units in stock by blood type', accent: 'var(--accent-rose)' },
  { href: '/pharmacies', label: 'Find a medicine', hint: 'Search stock across pharmacies', accent: 'var(--accent-emerald)' },
  { href: '/ambulance', label: 'Request an ambulance', hint: 'Dispatch to your location', accent: 'var(--accent-rose)' },
  { href: '/complaints', label: 'File a complaint', hint: 'Track civic grievances', accent: 'var(--accent-amber)' },
  { href: '/schemes', label: 'Government schemes', hint: 'Eligibility and benefits', accent: 'var(--accent-purple)' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { lat, lng, radiusKm } = useLocationStore();

  const alertsQuery = useAsync(() => alerts.active(), []);
  const complaintsQuery = useAsync(() => complaints.list({ limit: 5 }), []);
  const schemesQuery = useAsync(() => schemes.list({ limit: 3 }), []);
  const requestsQuery = useAsync(() => ambulances.listRequests(), []);

  // Bed capacity within the current radius: the single most useful number on
  // this screen, and it reuses the same PostGIS-backed search as /hospitals.
  const bedsQuery = useAsync(
    () => hospitals.search({ lat, lng, radiusKm, limit: 50 }),
    [lat, lng, radiusKm],
  );

  const nearbyBeds = (bedsQuery.data?.items ?? []).reduce(
    (acc, org) => {
      acc.general += org.hospitalDetail?.availableGeneralBeds ?? 0;
      acc.icu += org.hospitalDetail?.availableIcuBeds ?? 0;
      return acc;
    },
    { general: 0, icu: 0 },
  );

  const openRequests = (requestsQuery.data ?? []).filter(
    (r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED',
  );

  return (
    <div className="cc-dashboard">
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] ?? 'there'}`}
        subtitle="Civic health and emergency assistance at a glance."
        action={
          isProvider(user?.role) ? (
            <Link href="/provider" className="btn-primary" style={{ textDecoration: 'none' }}>
              Provider console
            </Link>
          ) : isStaff(user?.role) ? (
            <Link href="/admin" className="btn-primary" style={{ textDecoration: 'none' }}>
              Admin console
            </Link>
          ) : null
        }
      />

      <DemoBanner />

      {/* Public health alerts sit above everything else — they are the reason a
          citizen would open this app during an emergency. */}
      {alertsQuery.data && alertsQuery.data.length > 0 ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title">Active health alerts</h2>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {alertsQuery.data.map((alert) => (
              <div key={alert.id} className="glass-card" style={{ borderColor: 'rgba(244,63,94,0.25)' }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={SEVERITY_CLASS[alert.severity] ?? 'badge badge-cyan'}>{alert.severity}</span>
                  <strong>{alert.title}</strong>
                  <span className="subtle">{alert.affectedArea}</span>
                </div>
                <p className="muted" style={{ marginTop: '0.45rem', fontSize: '0.9rem' }}>
                  {alert.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Within {radiusKm} km of you</h2>
        <ErrorNote error={bedsQuery.error} />
        {bedsQuery.loading ? (
          <SkeletonRows count={1} height={110} />
        ) : (
          <Grid min={200}>
            <StatCard label="Hospitals nearby" value={bedsQuery.data?.meta.total ?? 0} href="/hospitals" />
            <StatCard label="General beds free" value={nearbyBeds.general} accent="var(--accent-emerald)" href="/hospitals" />
            <StatCard label="ICU beds free" value={nearbyBeds.icu} accent="var(--accent-rose)" href="/hospitals" />
            <StatCard
              label="Your open requests"
              value={openRequests.length}
              accent="var(--accent-amber)"
              href="/ambulance"
              hint={openRequests.length ? openRequests[0].status.replace('_', ' ').toLowerCase() : undefined}
            />
          </Grid>
        )}
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">What do you need?</h2>
        <Grid min={220}>
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="glass-panel" style={{ padding: '1.1rem', height: '100%' }}>
                <div style={{ fontWeight: 650, color: link.accent }}>{link.label}</div>
                <div className="subtle" style={{ marginTop: '0.35rem' }}>
                  {link.hint}
                </div>
              </div>
            </Link>
          ))}
        </Grid>
      </section>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section>
          <h2 className="section-title">Your recent complaints</h2>
          {complaintsQuery.loading ? (
            <SkeletonRows count={2} height={64} />
          ) : complaintsQuery.data && complaintsQuery.data.items.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {complaintsQuery.data.items.map((complaint) => (
                <Link key={complaint.id} href={`/complaints/${complaint.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.92rem' }}>{complaint.category}</strong>
                      <span className="badge badge-cyan">{complaint.status.replace('_', ' ').toLowerCase()}</span>
                    </div>
                    <p className="subtle" style={{ marginTop: '0.3rem' }}>
                      {complaint.description.slice(0, 110)}
                      {complaint.description.length > 110 ? '…' : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No complaints yet" hint="File one from the Complaints tab." />
          )}
        </section>

        <section>
          <h2 className="section-title">Government health schemes</h2>
          {schemesQuery.loading ? (
            <SkeletonRows count={2} height={64} />
          ) : schemesQuery.data && schemesQuery.data.items.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {schemesQuery.data.items.map((scheme) => (
                <Link key={scheme.id} href={`/schemes/${scheme.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.92rem' }}>{scheme.title}</strong>
                      <span className="badge badge-emerald">{scheme.category}</span>
                    </div>
                    <p className="subtle" style={{ marginTop: '0.3rem' }}>
                      {scheme.benefits.slice(0, 110)}
                      {scheme.benefits.length > 110 ? '…' : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No schemes published" />
          )}
        </section>
      </div>
    </div>
  );
}
