'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { VerificationStatus } from '../types';

/** Small shared primitives. Styling comes from the tokens in globals.css. */

/**
 * Shown on every screen that displays facility numbers.
 *
 * The seeded organisations are fictional and their bed counts, blood stock and
 * medicine inventory are made up. Without this banner a demo screenshot reads as
 * a factual claim about real hospital capacity.
 */
export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="demo-banner">
      <span aria-hidden>⚠</span>
      <span>
        {children ?? (
          <>
            <strong>Simulated data.</strong> All organisations below are fictional demo records seeded for this
            project. Availability figures are not real and must not be relied on.
          </>
        )}
      </span>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1.25rem',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{title}</h1>
        {subtitle ? <p className="muted" style={{ marginTop: '0.3rem', fontSize: '0.92rem' }}>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const correlationId = (error as { correlationId?: string } | null)?.correlationId;
  return (
    <div className="form-error" style={{ marginBottom: '1rem' }} role="alert">
      {message}
      {correlationId ? (
        <div className="subtle" style={{ marginTop: '0.3rem' }}>
          Reference: {correlationId}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1.25rem' }}>
      <p style={{ fontWeight: 600 }}>{title}</p>
      {hint ? <p className="subtle" style={{ marginTop: '0.4rem' }}>{hint}</p> : null}
    </div>
  );
}

export function SkeletonRows({ count = 3, height = 92 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent = 'var(--accent-cyan)',
  href,
  hint,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', height: '100%' }}>
      <div className="stat-value" style={{ color: accent }}>
        {value}
      </div>
      <div className="stat-label" style={{ marginTop: '0.35rem' }}>
        {label}
      </div>
      {hint ? <div className="subtle" style={{ marginTop: '0.4rem' }}>{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  ) : (
    body
  );
}

const VERIFICATION_BADGE: Record<VerificationStatus, string> = {
  APPROVED: 'badge badge-emerald',
  PENDING: 'badge badge-amber',
  REJECTED: 'badge badge-rose',
  SUSPENDED: 'badge badge-rose',
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return <span className={VERIFICATION_BADGE[status] ?? 'badge badge-cyan'}>{status.toLowerCase()}</span>;
}

/** Distance is `null` whenever the search ran without an origin — say so rather than printing 0 km. */
export function DistanceLabel({ distanceKm }: { distanceKm?: number | null }) {
  if (distanceKm === null || distanceKm === undefined) {
    return <span className="subtle">distance unknown</span>;
  }
  return <span className="badge badge-cyan">{distanceKm.toFixed(2)} km</span>;
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        marginTop: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <span className="subtle">
        {total} result{total === 1 ? '' : 's'} · page {page} of {Math.max(totalPages, 1)}
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="subtle" style={{ display: 'block', marginTop: '0.3rem' }}>{hint}</span> : null}
    </label>
  );
}

export function Grid({ children, min = 260 }: { children: ReactNode; min?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.9rem',
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}
