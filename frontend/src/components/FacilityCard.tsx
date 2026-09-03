'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Organization } from '../types';
import { DistanceLabel, VerificationBadge } from './ui';

const TYPE_LABEL: Record<string, string> = {
  HOSPITAL: 'Hospital',
  BLOOD_BANK: 'Blood bank',
  PHARMACY: 'Pharmacy',
  AMBULANCE_PROVIDER: 'Ambulance provider',
  NGO: 'NGO',
};

const DETAIL_HREF: Record<string, string> = {
  HOSPITAL: '/hospitals',
  BLOOD_BANK: '/blood-banks',
  PHARMACY: '/pharmacies',
  AMBULANCE_PROVIDER: '/ambulance',
};

/**
 * One facility in a results list.
 *
 * `children` carries the type-specific body (bed counts, blood units, stock)
 * so hospitals/blood banks/pharmacies share identical framing without five
 * near-copies of the same card.
 */
export function FacilityCard({
  org,
  children,
  footer,
}: {
  org: Organization & { distanceKm?: number | null };
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const href = DETAIL_HREF[org.type] ? `${DETAIL_HREF[org.type]}/${org.id}` : `/discover/${org.id}`;

  return (
    <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 650 }}>{org.name}</h3>
          </Link>
          <p className="subtle" style={{ marginTop: '0.2rem' }}>
            {TYPE_LABEL[org.type] ?? org.type} · {org.address}, {org.city}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <DistanceLabel distanceKm={org.distanceKm} />
          <VerificationBadge status={org.verificationStatus} />
        </div>
      </div>

      {children ? <div style={{ marginTop: '0.85rem' }}>{children}</div> : null}

      <div
        style={{
          marginTop: '0.85rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <span className="subtle">
          {org.phone}
          {org.website ? ` · ${org.website}` : ''}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {footer}
          <Link href={href} className="btn-secondary" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A labelled number, used inside facility cards for capacity figures. */
export function Metric({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.5rem 0.7rem',
        minWidth: 92,
      }}
    >
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: accent ?? 'var(--text-primary)' }}>{value}</div>
      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
        {label}
      </div>
    </div>
  );
}

export function MetricRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{children}</div>;
}
