'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore, isStaff } from '../../../../store/auth.store';
import { useAsync } from '../../../../lib/hooks';
import { complaints } from '../../../../lib/endpoints';
import { ErrorNote, Field, PageHeader, SkeletonRows } from '../../../../components/ui';
import { formatDateTime, titleCase } from '../../../../lib/format';
import type { ComplaintStatus } from '../../../../types';

const STATUS_CLASS: Record<ComplaintStatus, string> = {
  PENDING: 'badge badge-amber',
  UNDER_REVIEW: 'badge badge-cyan',
  RESOLVED: 'badge badge-emerald',
  REJECTED: 'badge badge-rose',
};

/** Statuses an authority may move a complaint to. PENDING is the initial state. */
const RESOLUTION_STATUSES: ComplaintStatus[] = ['UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

export function ComplaintDetail({ id }: { id: string }) {
  const user = useAuthStore((s) => s.user);
  const staff = isStaff(user?.role);

  const { data: complaint, loading, error, reload } = useAsync(() => complaints.get(id), [id]);

  const [status, setStatus] = useState<ComplaintStatus>('RESOLVED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  if (loading) return <SkeletonRows count={2} height={150} />;
  if (error) return <ErrorNote error={error} />;
  if (!complaint) return <ErrorNote error={new Error('Complaint not found.')} />;

  const resolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await complaints.resolve(complaint.id, { status, resolutionNotes: notes.trim() });
      setNotes('');
      reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Link href="/complaints" className="subtle" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
        ← Back to complaints
      </Link>

      <PageHeader
        title={complaint.category}
        subtitle={`Filed ${formatDateTime(complaint.createdAt)}`}
        action={<span className={STATUS_CLASS[complaint.status]}>{titleCase(complaint.status)}</span>}
      />

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>{complaint.description}</p>
        {complaint.organization ? (
          <p className="subtle" style={{ marginTop: '0.75rem' }}>
            About: {complaint.organization.name}, {complaint.organization.city}
          </p>
        ) : null}
        {/* The API withholds the citizen's contact details from non-staff
            callers, so this block simply renders whatever it was given. */}
        {complaint.citizen ? (
          <p className="subtle" style={{ marginTop: '0.3rem' }}>
            Filed by: {complaint.citizen.name}
            {complaint.citizen.email ? ` · ${complaint.citizen.email}` : ''}
            {complaint.citizen.phone ? ` · ${complaint.citizen.phone}` : ''}
          </p>
        ) : null}
      </div>

      {complaint.resolutionNotes ? (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">Resolution</h2>
          <p style={{ fontSize: '0.93rem', lineHeight: 1.6 }}>{complaint.resolutionNotes}</p>
          <p className="subtle" style={{ marginTop: '0.5rem' }}>
            {complaint.resolvedBy ? `${complaint.resolvedBy.name} (${titleCase(complaint.resolvedBy.role)})` : 'Authority'}
            {complaint.resolvedAt ? ` · ${formatDateTime(complaint.resolvedAt)}` : ''}
          </p>
        </div>
      ) : null}

      {staff ? (
        <form onSubmit={resolve} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
          <h2 className="section-title">Update this complaint</h2>
          <ErrorNote error={saveError} />
          <Field label="New status">
            <select className="input-control" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
              {RESOLUTION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Resolution notes" hint="Visible to the citizen who filed the complaint.">
            <textarea className="input-control" rows={3} required value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <button className="btn-primary" type="submit" disabled={saving} style={{ justifyContent: 'center' }}>
            {saving ? 'Saving…' : 'Save update'}
          </button>
        </form>
      ) : null}
    </>
  );
}
