'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore, isStaff } from '../../../store/auth.store';
import { useAsync, useDebounced } from '../../../lib/hooks';
import { complaints, organizations } from '../../../lib/endpoints';
import { DemoBanner, EmptyState, ErrorNote, Field, Pagination, PageHeader, SkeletonRows } from '../../../components/ui';
import { formatDateTime, titleCase } from '../../../lib/format';
import type { ComplaintStatus } from '../../../types';

const STATUS_CLASS: Record<ComplaintStatus, string> = {
  PENDING: 'badge badge-amber',
  UNDER_REVIEW: 'badge badge-cyan',
  RESOLVED: 'badge badge-emerald',
  REJECTED: 'badge badge-rose',
};

const STATUS_FILTERS: Array<{ value: ComplaintStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CATEGORIES = [
  'Hospital service',
  'Blood bank service',
  'Pharmacy pricing',
  'Ambulance delay',
  'Sanitation',
  'Water supply',
  'Public health hazard',
  'Other',
];

export default function ComplaintsPage() {
  const user = useAuthStore((s) => s.user);
  const staff = isStaff(user?.role);

  const [status, setStatus] = useState<ComplaintStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const [form, setForm] = useState({ category: CATEGORIES[0], description: '', organizationId: '' });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const listQuery = useAsync(
    () =>
      complaints.list({
        page,
        limit: 10,
        ...(status ? { status } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    [page, status, debouncedSearch],
  );

  // Used to attach a complaint to a facility. Loaded once, without coordinates
  // — this is a picker, not a proximity search.
  const orgsQuery = useAsync(() => organizations.search({ limit: 100 }), []);

  const items = listQuery.data?.items ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await complaints.create({
        category: form.category,
        description: form.description.trim(),
        ...(form.organizationId ? { organizationId: form.organizationId } : {}),
      });
      setForm({ category: CATEGORIES[0], description: '', organizationId: '' });
      setShowForm(false);
      setPage(1);
      listQuery.reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle={
          staff
            ? 'Every citizen grievance on the platform. Open one to review and resolve it.'
            : 'Grievances you have filed, and their status.'
        }
        action={
          user?.role === 'CITIZEN' ? (
            <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Close' : 'File a complaint'}
            </button>
          ) : null
        }
      />
      <DemoBanner>
        <>
          <strong>Demonstration only.</strong> Complaints filed here are stored in the project database and are not
          forwarded to any real authority.
        </>
      </DemoBanner>

      <ErrorNote error={submitError} />

      {showForm ? (
        <form onSubmit={submit} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <Field label="Category">
            <select className="input-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Facility involved (optional)">
            <select
              className="input-control"
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
            >
              <option value="">Not about a specific facility</option>
              {(orgsQuery.data?.items ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} — {org.city}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What happened?">
            <textarea
              className="input-control"
              rows={4}
              required
              minLength={10}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <button className="btn-primary" type="submit" disabled={submitting} style={{ justifyContent: 'center' }}>
            {submitting ? 'Submitting…' : 'Submit complaint'}
          </button>
        </form>
      ) : null}

      <div className="glass-card" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          className="input-control"
          style={{ flex: '1 1 220px' }}
          placeholder="Search complaints…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={status === filter.value ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.83rem' }}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <ErrorNote error={listQuery.error} />

      {listQuery.loading ? (
        <SkeletonRows count={4} height={92} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No complaints"
          hint={user?.role === 'CITIZEN' ? 'Use “File a complaint” to raise one.' : undefined}
        />
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {items.map((complaint) => (
            <Link key={complaint.id} href={`/complaints/${complaint.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="glass-panel" style={{ padding: '1rem 1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <strong>{complaint.category}</strong>
                  <span className={STATUS_CLASS[complaint.status]}>{titleCase(complaint.status)}</span>
                </div>
                <p className="muted" style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
                  {complaint.description.slice(0, 180)}
                  {complaint.description.length > 180 ? '…' : ''}
                </p>
                <div className="subtle" style={{ marginTop: '0.45rem' }}>
                  {formatDateTime(complaint.createdAt)}
                  {complaint.organization ? ` · ${complaint.organization.name}` : ''}
                  {staff && complaint.citizen ? ` · filed by ${complaint.citizen.name}` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {listQuery.data ? (
        <Pagination
          page={listQuery.data.meta.page}
          totalPages={listQuery.data.meta.totalPages}
          total={listQuery.data.meta.total}
          onChange={setPage}
        />
      ) : null}
    </>
  );
}
