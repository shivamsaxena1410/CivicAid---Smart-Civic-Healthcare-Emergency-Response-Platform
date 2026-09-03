'use client';

import { useState } from 'react';
import { useAuthStore } from '../../../store/auth.store';
import { useAsync, useDebounced } from '../../../lib/hooks';
import { admin, alerts } from '../../../lib/endpoints';
import {
  DemoBanner,
  EmptyState,
  ErrorNote,
  Field,
  Grid,
  PageHeader,
  Pagination,
  SkeletonRows,
  StatCard,
  VerificationBadge,
} from '../../../components/ui';
import { formatDateTime, titleCase } from '../../../lib/format';
import type { AlertSeverity, User } from '../../../types';

/**
 * Admin and authority console.
 *
 * The backend splits these two roles: `AdminController` is `@Roles(Role.ADMIN)`
 * wholesale, while alerts accept `AUTHORITY` as well. This page mirrors that
 * split rather than showing an authority user panels whose every request would
 * come back 403.
 */

type TabKey = 'overview' | 'verification' | 'users' | 'alerts' | 'audit';

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
}

const SEVERITIES: AlertSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  LOW: 'badge badge-cyan',
  MEDIUM: 'badge badge-amber',
  HIGH: 'badge badge-amber',
  CRITICAL: 'badge badge-rose',
};

function OverviewTab() {
  const { data, loading, error } = useAsync(() => admin.analytics(), []);

  if (loading) return <SkeletonRows count={2} height={110} />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return <EmptyState title="No analytics available" />;

  const { overview, capacityMetrics } = data;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section>
        <h2 className="section-title">Platform</h2>
        <Grid min={180}>
          <StatCard label="Users" value={overview.totalUsers} />
          <StatCard label="Hospitals" value={overview.totalHospitals} />
          <StatCard label="Blood banks" value={overview.totalBloodBanks} accent="var(--accent-rose)" />
          <StatCard label="Pharmacies" value={overview.totalPharmacies} />
          <StatCard label="Ambulance providers" value={overview.totalAmbulances} />
          <StatCard
            label="Awaiting verification"
            value={overview.pendingVerifications}
            accent="var(--accent-amber)"
            hint="Cannot publish availability until approved."
          />
        </Grid>
      </section>

      <section>
        <h2 className="section-title">Complaints</h2>
        <Grid min={180}>
          <StatCard label="Total" value={overview.totalComplaints} />
          <StatCard label="Resolved" value={overview.resolvedComplaints} accent="var(--accent-emerald)" />
          <StatCard label="Open" value={overview.totalComplaints - overview.resolvedComplaints} accent="var(--accent-amber)" />
        </Grid>
      </section>

      <section>
        <h2 className="section-title">Reported capacity</h2>
        <Grid min={180}>
          <StatCard label="Beds recorded" value={capacityMetrics.totalBeds} />
          <StatCard label="General beds free" value={capacityMetrics.availableGeneralBeds} accent="var(--accent-emerald)" />
          <StatCard label="ICU beds free" value={capacityMetrics.availableIcuBeds} accent="var(--accent-amber)" />
          <StatCard label="Blood units in stock" value={capacityMetrics.totalBloodUnitsInStock} accent="var(--accent-rose)" />
        </Grid>
        <p className="subtle" style={{ marginTop: '0.5rem' }}>
          These are the figures facilities have published, not independently measured values. A facility that has
          not updated in days still counts here.
        </p>
      </section>
    </div>
  );
}

function VerificationTab() {
  const [page, setPage] = useState(1);
  const query = useAsync(() => admin.pendingOrganizations({ page, limit: 10 }), [page]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const items = query.data?.items ?? [];

  const decide = async (orgId: string, status: 'APPROVED' | 'REJECTED') => {
    const reason = (reasons[orgId] ?? '').trim();
    // A rejection with no stated reason gives the facility nothing to fix, so
    // the API requires one and this asks for it before spending the round trip.
    if (status === 'REJECTED' && !reason) {
      setError(new Error('Give a reason before rejecting — the facility sees it.'));
      return;
    }
    setBusyId(orgId);
    setError(null);
    try {
      await admin.verifyOrganization(orgId, { status, ...(reason ? { rejectionReason: reason } : {}) });
      query.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        A facility stays invisible to citizen search until it is approved, and its availability updates are
        rejected. Approving one puts its numbers in front of people making emergency decisions.
      </p>

      <ErrorNote error={error} />
      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={2} height={150} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing awaiting verification" />
      ) : (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {items.map((org) => (
            <div key={org.id} className="glass-panel" style={{ padding: '1.15rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '1rem' }}>{org.name}</strong>
                  <div className="subtle">{titleCase(org.type)}</div>
                </div>
                <VerificationBadge status={org.verificationStatus} />
              </div>

              <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                {org.address}, {org.city} {org.pincode}
              </p>
              <p className="subtle" style={{ marginTop: '0.25rem' }}>
                {org.phone} · {org.email}
                {org.licenseNumber ? ` · licence ${org.licenseNumber}` : ' · no licence number supplied'}
              </p>

              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="input-control"
                  style={{ flex: '1 1 240px' }}
                  placeholder="Reason (required to reject)"
                  value={reasons[org.id] ?? ''}
                  onChange={(e) => setReasons({ ...reasons, [org.id]: e.target.value })}
                />
                <button className="btn-primary" disabled={busyId === org.id} onClick={() => decide(org.id, 'APPROVED')}>
                  Approve
                </button>
                <button className="btn-danger" disabled={busyId === org.id} onClick={() => decide(org.id, 'REJECTED')}>
                  Reject
                </button>
              </div>
            </div>
          ))}
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

function UsersTab({ currentUserId }: { currentUserId?: string }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const query = useAsync(
    () => admin.users({ page, limit: 20, ...(debounced ? { search: debounced } : {}) }),
    [page, debounced],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const items: User[] = query.data?.items ?? [];

  const toggle = async (user: User) => {
    setBusyId(user.id);
    setError(null);
    try {
      await admin.setUserStatus(user.id, !user.isActive);
      query.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <input
        className="input-control"
        style={{ marginBottom: '1rem' }}
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <ErrorNote error={error} />
      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={4} height={54} />
      ) : items.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="glass-panel" style={{ padding: '0.5rem 1rem', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((user) => {
                const self = user.id === currentUserId;
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <div className="subtle">{user.email}</div>
                    </td>
                    <td>
                      <span className="badge badge-cyan">{titleCase(user.role)}</span>
                    </td>
                    <td>
                      <span className={user.isActive ? 'badge badge-emerald' : 'badge badge-rose'}>
                        {user.isActive ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td className="subtle">{formatDateTime(user.createdAt)}</td>
                    <td>
                      {/* Disabling your own account would lock you out of the
                          console that undoes it. */}
                      <button
                        className={user.isActive ? 'btn-danger' : 'btn-secondary'}
                        style={{ fontSize: '0.8rem' }}
                        disabled={busyId === user.id || self}
                        title={self ? 'You cannot disable your own account here.' : undefined}
                        onClick={() => toggle(user)}
                      >
                        {user.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

function AlertsTab() {
  const [page, setPage] = useState(1);
  const query = useAsync(() => alerts.list({ page, limit: 10 }), [page]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'MEDIUM' as AlertSeverity,
    affectedArea: '',
    expiresAt: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const items = query.data?.items ?? [];

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await alerts.create({
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        affectedArea: form.affectedArea.trim(),
        // `datetime-local` gives a value with no timezone; the API expects an
        // ISO 8601 string, so convert rather than posting the raw field.
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
      });
      setForm({ title: '', description: '', severity: 'MEDIUM', affectedArea: '', expiresAt: '' });
      setPage(1);
      query.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await alerts.toggle(id, isActive);
      query.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ErrorNote error={error} />

      <form onSubmit={publish} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Publish an alert
        </h2>
        <p className="subtle" style={{ margin: 0 }}>
          Active alerts appear at the top of every citizen dashboard.
        </p>

        <Field label="Title">
          <input className="input-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className="input-control" rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Field label="Severity">
            <select
              className="input-control"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as AlertSeverity })}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Affected area">
            <input className="input-control" required value={form.affectedArea} onChange={(e) => setForm({ ...form, affectedArea: e.target.value })} />
          </Field>
          <Field label="Expires (optional)">
            <input
              className="input-control"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </Field>
        </div>
        <button className="btn-primary" type="submit" disabled={busy} style={{ justifySelf: 'start' }}>
          {busy ? 'Publishing…' : 'Publish alert'}
        </button>
      </form>

      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={2} height={110} />
      ) : items.length === 0 ? (
        <EmptyState title="No alerts published" />
      ) : (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {items.map((alert) => (
            <div key={alert.id} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                <strong>{alert.title}</strong>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span className={SEVERITY_BADGE[alert.severity]}>{titleCase(alert.severity)}</span>
                  <span className={alert.isActive ? 'badge badge-emerald' : 'badge badge-rose'}>
                    {alert.isActive ? 'live' : 'off'}
                  </span>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem' }}
                    disabled={busy}
                    onClick={() => toggle(alert.id, !alert.isActive)}
                  >
                    {alert.isActive ? 'Take down' : 'Republish'}
                  </button>
                </div>
              </div>
              <p className="muted" style={{ marginTop: '0.45rem', fontSize: '0.9rem' }}>
                {alert.description}
              </p>
              <p className="subtle" style={{ marginTop: '0.35rem' }}>
                {alert.affectedArea} · published {formatDateTime(alert.createdAt)}
                {alert.expiresAt ? ` · expires ${formatDateTime(alert.expiresAt)}` : ''}
              </p>
            </div>
          ))}
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

function AuditTab() {
  const [page, setPage] = useState(1);
  const query = useAsync(() => admin.auditLogs({ page, limit: 25 }), [page]);
  const items = (query.data?.items ?? []) as unknown as AuditLogRow[];

  return (
    <>
      <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        Privileged actions are recorded here — verifications, account status changes and capacity edits.
      </p>

      <ErrorNote error={query.error} />

      {query.loading ? (
        <SkeletonRows count={5} height={44} />
      ) : items.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <div className="glass-panel" style={{ padding: '0.5rem 1rem', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id}>
                  <td className="subtle" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                  <td>
                    {/* `userId` is SetNull on delete, so a log entry can outlive
                        its actor. Say so rather than rendering a blank cell. */}
                    {log.user ? (
                      <>
                        {log.user.name}
                        <div className="subtle">{titleCase(log.user.role)}</div>
                      </>
                    ) : (
                      <span className="subtle">deleted user</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-cyan">{titleCase(log.action)}</span>
                  </td>
                  <td className="subtle">
                    {log.entityType}
                    {log.entityId ? <div style={{ fontSize: '0.75rem' }}>{log.entityId.slice(0, 8)}…</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  // `AdminController` is `@Roles(Role.ADMIN)` at the class level; only alerts
  // admit AUTHORITY. An authority user therefore gets the alerts tab alone.
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<TabKey>(isAdmin ? 'overview' : 'alerts');

  const tabs: Array<{ key: TabKey; label: string }> = isAdmin
    ? [
        { key: 'overview', label: 'Overview' },
        { key: 'verification', label: 'Verification' },
        { key: 'users', label: 'Users' },
        { key: 'alerts', label: 'Alerts' },
        { key: 'audit', label: 'Audit log' },
      ]
    : [{ key: 'alerts', label: 'Alerts' }];

  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Administration' : 'Authority console'}
        subtitle={
          isAdmin
            ? 'Verify facilities, manage accounts and publish emergency alerts.'
            : 'Publish and withdraw public emergency alerts.'
        }
      />

      <DemoBanner>
        <>
          <strong>Simulated platform data.</strong> Every organisation and account below is a fictional demo
          record. Publishing an alert here notifies nobody outside this project.
        </>
      </DemoBanner>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.85rem' }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'overview' ? <OverviewTab /> : null}
      {active === 'verification' ? <VerificationTab /> : null}
      {active === 'users' ? <UsersTab currentUserId={user?.id} /> : null}
      {active === 'alerts' ? <AlertsTab /> : null}
      {active === 'audit' ? <AuditTab /> : null}
    </>
  );
}
