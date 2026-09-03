'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore, isStaff } from '../../../store/auth.store';
import { useAsync, useDebounced } from '../../../lib/hooks';
import { schemes } from '../../../lib/endpoints';
import { DemoBanner, EmptyState, ErrorNote, Field, Pagination, PageHeader, SkeletonRows } from '../../../components/ui';

const CATEGORIES = ['Health insurance', 'Maternal health', 'Child health', 'Senior care', 'Disability support', 'General'];

export default function SchemesPage() {
  const user = useAuthStore((s) => s.user);
  const staff = isStaff(user?.role);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    eligibilityCriteria: '',
    benefits: '',
    applicationUrl: '',
    category: CATEGORIES[0],
    documentsRequired: '',
  });

  const query = useAsync(
    () =>
      schemes.list({
        page,
        limit: 10,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(category ? { category } : {}),
      }),
    [page, debouncedSearch, category],
  );

  const items = query.data?.items ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await schemes.create({
        title: form.title.trim(),
        description: form.description.trim(),
        eligibilityCriteria: form.eligibilityCriteria.trim(),
        benefits: form.benefits.trim(),
        category: form.category,
        ...(form.applicationUrl.trim() ? { applicationUrl: form.applicationUrl.trim() } : {}),
        documentsRequired: form.documentsRequired
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      });
      setShowForm(false);
      setForm({
        title: '',
        description: '',
        eligibilityCriteria: '',
        benefits: '',
        applicationUrl: '',
        category: CATEGORIES[0],
        documentsRequired: '',
      });
      setPage(1);
      query.reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Government health schemes"
        subtitle="Eligibility, benefits and the documents you need."
        action={
          staff ? (
            <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Close' : 'Publish a scheme'}
            </button>
          ) : null
        }
      />
      <DemoBanner>
        <>
          <strong>Illustrative content.</strong> These scheme records are written for this project. They do not
          reproduce any real government programme — check an official portal before acting on eligibility rules.
        </>
      </DemoBanner>

      <ErrorNote error={submitError} />

      {showForm ? (
        <form onSubmit={submit} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.8rem', marginBottom: '1.25rem' }}>
          <Field label="Title">
            <input className="input-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Category">
            <select className="input-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea className="input-control" rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Eligibility criteria">
            <textarea className="input-control" rows={2} required value={form.eligibilityCriteria} onChange={(e) => setForm({ ...form, eligibilityCriteria: e.target.value })} />
          </Field>
          <Field label="Benefits">
            <textarea className="input-control" rows={2} required value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
          </Field>
          <Field label="Application URL (optional)">
            <input className="input-control" type="url" value={form.applicationUrl} onChange={(e) => setForm({ ...form, applicationUrl: e.target.value })} />
          </Field>
          <Field label="Documents required" hint="Comma-separated.">
            <input className="input-control" value={form.documentsRequired} onChange={(e) => setForm({ ...form, documentsRequired: e.target.value })} />
          </Field>
          <button className="btn-primary" type="submit" disabled={submitting} style={{ justifyContent: 'center' }}>
            {submitting ? 'Publishing…' : 'Publish scheme'}
          </button>
        </form>
      ) : null}

      <div className="glass-card" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          className="input-control"
          style={{ flex: '1 1 220px' }}
          placeholder="Search schemes…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input-control"
          style={{ width: 'auto' }}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={3} height={120} />
      ) : items.length === 0 ? (
        <EmptyState title="No schemes found" />
      ) : (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {items.map((scheme) => (
            <Link key={scheme.id} href={`/schemes/${scheme.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1rem' }}>{scheme.title}</strong>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <span className="badge badge-purple badge-cyan">{scheme.category}</span>
                    {!scheme.isActive ? <span className="badge badge-rose">inactive</span> : null}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: '0.45rem', fontSize: '0.9rem' }}>
                  {scheme.description.slice(0, 200)}
                  {scheme.description.length > 200 ? '…' : ''}
                </p>
                <p className="subtle" style={{ marginTop: '0.4rem' }}>
                  Benefits: {scheme.benefits.slice(0, 120)}
                  {scheme.benefits.length > 120 ? '…' : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {query.data ? (
        <Pagination page={query.data.meta.page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} onChange={setPage} />
      ) : null}
    </>
  );
}
