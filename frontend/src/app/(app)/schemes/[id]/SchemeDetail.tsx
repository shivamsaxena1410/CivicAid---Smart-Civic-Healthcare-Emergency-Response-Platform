'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore, isStaff } from '../../../../store/auth.store';
import { useAsync } from '../../../../lib/hooks';
import { schemes } from '../../../../lib/endpoints';
import { DemoBanner, ErrorNote, PageHeader, SkeletonRows } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';

export function SchemeDetail({ id }: { id: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const staff = isStaff(user?.role);

  const { data: scheme, loading, error, reload } = useAsync(() => schemes.get(id), [id]);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <SkeletonRows count={2} height={160} />;
  if (error) return <ErrorNote error={error} />;
  if (!scheme) return <ErrorNote error={new Error('Scheme not found.')} />;

  const toggleActive = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await schemes.update(scheme.id, { isActive: !scheme.isActive });
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    // A published scheme is public information; deleting it is not something to
    // do on a stray click.
    if (!window.confirm('Delete this scheme permanently?')) return;
    setBusy(true);
    setActionError(null);
    try {
      await schemes.remove(scheme.id);
      router.replace('/schemes');
    } catch (err) {
      setActionError(err);
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/schemes" className="subtle" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
        ← Back to schemes
      </Link>

      <PageHeader
        title={scheme.title}
        subtitle={`${scheme.category} · published ${formatDateTime(scheme.createdAt)}`}
        action={
          staff ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={toggleActive} disabled={busy}>
                {scheme.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className="btn-danger" onClick={remove} disabled={busy}>
                Delete
              </button>
            </div>
          ) : scheme.isActive ? null : (
            <span className="badge badge-rose">inactive</span>
          )
        }
      />

      <DemoBanner>
        <>
          <strong>Illustrative content.</strong> This scheme record was written for this project and does not
          reproduce a real government programme.
        </>
      </DemoBanner>

      <ErrorNote error={actionError} />

      <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1.1rem' }}>
        <section>
          <h2 className="section-title">About</h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.65 }}>{scheme.description}</p>
        </section>
        <section>
          <h2 className="section-title">Who is eligible</h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.65 }}>{scheme.eligibilityCriteria}</p>
        </section>
        <section>
          <h2 className="section-title">Benefits</h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.65 }}>{scheme.benefits}</p>
        </section>
        {scheme.documentsRequired?.length ? (
          <section>
            <h2 className="section-title">Documents required</h2>
            <ul style={{ paddingLeft: '1.1rem', display: 'grid', gap: '0.25rem' }}>
              {scheme.documentsRequired.map((doc) => (
                <li key={doc} style={{ fontSize: '0.93rem' }}>
                  {doc}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {scheme.applicationUrl ? (
          <a
            href={scheme.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ textDecoration: 'none', justifySelf: 'start' }}
          >
            Open application portal ↗
          </a>
        ) : null}
      </div>
    </>
  );
}
