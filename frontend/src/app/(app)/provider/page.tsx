'use client';

import { useState } from 'react';
import { useAuthStore } from '../../../store/auth.store';
import { useAsync } from '../../../lib/hooks';
import {
  ambulances,
  bloodBanks,
  hospitals,
  organizations,
  pharmacies,
  type AmbulanceRequest,
} from '../../../lib/endpoints';
import {
  DemoBanner,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  SkeletonRows,
  VerificationBadge,
} from '../../../components/ui';
import { BLOOD_TYPES, formatDateTime, titleCase, updatedLabel } from '../../../lib/format';
import type { AmbulanceRequestStatus, BloodType, Organization } from '../../../types';

/**
 * The provider console.
 *
 * A facility's own view of the data it publishes. Every write here goes through
 * the same endpoints the API guards with `assertOrgAccess(..., { requireApproved:
 * true })`, so a PENDING organisation gets a 403 rather than the ability to put
 * invented availability numbers into public emergency search results. The UI
 * says so up front instead of letting the user discover it via a failed save.
 */

function HospitalPanel({ org, onSaved }: { org: Organization; onSaved: () => void }) {
  const detail = org.hospitalDetail;
  const [form, setForm] = useState({
    totalBeds: detail?.totalBeds ?? 0,
    availableGeneralBeds: detail?.availableGeneralBeds ?? 0,
    availableIcuBeds: detail?.availableIcuBeds ?? 0,
    emergencyAvailable: detail?.emergencyAvailable ?? false,
    hasOxygenSupport: detail?.hasOxygenSupport ?? false,
    hasVentilators: detail?.hasVentilators ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const updated = updatedLabel(detail?.availabilityUpdatedAt);
  const overCapacity = form.availableGeneralBeds + form.availableIcuBeds > form.totalBeds;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await hospitals.updateCapacity(org.id, form);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Bed availability
        </h2>
        <span className={updated.stale ? 'badge badge-amber' : 'badge badge-cyan'}>updated {updated.text}</span>
      </div>

      <ErrorNote error={error} />
      {saved ? <div className="form-notice">Capacity published. It is live in citizen search now.</div> : null}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="Total beds">
          <input
            className="input-control"
            type="number"
            min={0}
            value={form.totalBeds}
            onChange={(e) => setForm({ ...form, totalBeds: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
        <Field label="General beds free">
          <input
            className="input-control"
            type="number"
            min={0}
            value={form.availableGeneralBeds}
            onChange={(e) => setForm({ ...form, availableGeneralBeds: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
        <Field label="ICU beds free">
          <input
            className="input-control"
            type="number"
            min={0}
            value={form.availableIcuBeds}
            onChange={(e) => setForm({ ...form, availableIcuBeds: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
      </div>

      {/* Warn rather than block: a facility may legitimately have more beds in
          use than its recorded total during a surge, and refusing the save
          would push them to stop updating at the moment it matters most. */}
      {overCapacity ? (
        <div className="form-notice">
          Free beds ({form.availableGeneralBeds + form.availableIcuBeds}) exceed the recorded total ({form.totalBeds}).
          Check the total before publishing.
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {([
          ['emergencyAvailable', 'Emergency open'],
          ['hasOxygenSupport', 'Oxygen support'],
          ['hasVentilators', 'Ventilators'],
        ] as const).map(([key, label]) => (
          <label key={key} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.88rem' }}>
            <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>

      <button className="btn-primary" type="submit" disabled={saving} style={{ justifySelf: 'start' }}>
        {saving ? 'Publishing…' : 'Publish availability'}
      </button>
    </form>
  );
}

function BloodBankPanel({ org, onSaved }: { org: Organization; onSaved: () => void }) {
  const existing = new Map((org.bloodBankInventory ?? []).map((i) => [i.bloodType, i.unitsAvailable]));
  const [units, setUnits] = useState<Record<string, number>>(
    Object.fromEntries(BLOOD_TYPES.map((t) => [t.value, existing.get(t.value) ?? 0])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await bloodBanks.updateInventory(
        org.id,
        BLOOD_TYPES.map((t) => ({ bloodType: t.value as BloodType, unitsAvailable: units[t.value] ?? 0 })),
      );
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        Blood inventory
      </h2>
      <ErrorNote error={error} />
      {saved ? <div className="form-notice">Inventory published.</div> : null}

      <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
        {BLOOD_TYPES.map((type) => (
          <Field key={type.value} label={type.label}>
            <input
              className="input-control"
              type="number"
              min={0}
              value={units[type.value] ?? 0}
              onChange={(e) => setUnits({ ...units, [type.value]: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
        ))}
      </div>

      <button className="btn-primary" type="submit" disabled={saving} style={{ justifySelf: 'start' }}>
        {saving ? 'Publishing…' : 'Publish inventory'}
      </button>
    </form>
  );
}

function PharmacyPanel({ org, onSaved }: { org: Organization; onSaved: () => void }) {
  const medicines = org.pharmacyMedicines ?? [];
  const [form, setForm] = useState({ medicineName: '', genericName: '', category: '', price: '', quantity: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await pharmacies.addMedicine(org.id, {
        medicineName: form.medicineName.trim(),
        ...(form.genericName.trim() ? { genericName: form.genericName.trim() } : {}),
        ...(form.category.trim() ? { category: form.category.trim() } : {}),
        price: Number(form.price),
        quantity: Number(form.quantity),
        inStock: Number(form.quantity) > 0,
      });
      setForm({ medicineName: '', genericName: '', category: '', price: '', quantity: '' });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const setQuantity = async (medicineId: string, quantity: number) => {
    setBusy(true);
    setError(null);
    try {
      // `inStock` is derived rather than edited separately: a row reading
      // "in stock, 0 left" is the kind of contradiction that sends someone
      // across town for nothing.
      await pharmacies.updateMedicine(medicineId, { quantity, inStock: quantity > 0 });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (medicineId: string) => {
    setBusy(true);
    setError(null);
    try {
      await pharmacies.deleteMedicine(medicineId);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <form onSubmit={add} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Add a medicine
        </h2>
        <ErrorNote error={error} />
        <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label="Medicine name">
            <input className="input-control" required value={form.medicineName} onChange={(e) => setForm({ ...form, medicineName: e.target.value })} />
          </Field>
          <Field label="Generic name">
            <input className="input-control" value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} />
          </Field>
          <Field label="Category">
            <input className="input-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Price (₹)">
            <input className="input-control" type="number" step="0.01" min={0} required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Quantity">
            <input className="input-control" type="number" min={0} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
        </div>
        <button className="btn-primary" type="submit" disabled={busy} style={{ justifySelf: 'start' }}>
          {busy ? 'Saving…' : 'Add medicine'}
        </button>
      </form>

      <div className="glass-panel" style={{ padding: '1rem 1.25rem', overflowX: 'auto' }}>
        <h2 className="section-title">Current stock ({medicines.length})</h2>
        {medicines.length === 0 ? (
          <EmptyState title="No medicines listed yet" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Price</th>
                <th>Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {medicines.map((medicine) => (
                <tr key={medicine.id}>
                  <td>
                    <strong>{medicine.medicineName}</strong>
                    {medicine.genericName ? <div className="subtle">{medicine.genericName}</div> : null}
                  </td>
                  <td>₹{Number(medicine.price).toFixed(2)}</td>
                  <td>
                    <input
                      className="input-control"
                      style={{ width: 90 }}
                      type="number"
                      min={0}
                      defaultValue={medicine.quantity}
                      disabled={busy}
                      onBlur={(e) => {
                        const next = Math.max(0, Number(e.target.value) || 0);
                        if (next !== medicine.quantity) void setQuantity(medicine.id, next);
                      }}
                    />
                  </td>
                  <td>
                    <button className="btn-secondary" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={() => remove(medicine.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Statuses a responder may move a request to, mirroring ALLOWED_TRANSITIONS. */
const NEXT_STATUSES: Record<AmbulanceRequestStatus, AmbulanceRequestStatus[]> = {
  REQUESTED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function AmbulancePanel({ org, onSaved }: { org: Organization; onSaved: () => void }) {
  const requestsQuery = useAsync(() => ambulances.listRequests(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [vehicleFor, setVehicleFor] = useState<Record<string, string>>({});

  const fleet = org.ambulanceDetails ?? [];
  const requests = requestsQuery.data ?? [];

  const advance = async (request: AmbulanceRequest, status: AmbulanceRequestStatus) => {
    setBusyId(request.id);
    setError(null);
    try {
      // Accepting an unassigned request also claims it for one of our vehicles;
      // the API rejects an ACCEPTED request that has no ambulance attached.
      const ambulanceId = vehicleFor[request.id] || request.ambulanceId || fleet[0]?.id;
      await ambulances.updateRequestStatus(request.id, {
        status,
        ...(status === 'ACCEPTED' && ambulanceId ? { ambulanceId } : {}),
      });
      requestsQuery.reload();
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  const setVehicleStatus = async (vehicleId: string, status: 'AVAILABLE' | 'BUSY' | 'OFFLINE') => {
    setBusyId(vehicleId);
    setError(null);
    try {
      await ambulances.updateVehicleStatus(vehicleId, status);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <ErrorNote error={error} />

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h2 className="section-title">Fleet</h2>
        {fleet.length === 0 ? (
          <EmptyState title="No vehicles registered" />
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {fleet.map((vehicle) => (
              <div key={vehicle.id} className="glass-card" style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{vehicle.vehicleNumber}</strong>
                <span className="subtle">{vehicle.vehicleType}</span>
                <span className="subtle">{vehicle.contactNumber}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                  {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((status) => (
                    <button
                      key={status}
                      className={vehicle.status === status ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: '0.78rem' }}
                      disabled={busyId === vehicle.id}
                      onClick={() => setVehicleStatus(vehicle.id, status)}
                    >
                      {titleCase(status)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h2 className="section-title">Dispatch queue</h2>
        {requestsQuery.loading ? (
          <SkeletonRows count={2} height={90} />
        ) : requests.length === 0 ? (
          <EmptyState title="No requests" hint="Open requests in your area and your assigned calls appear here." />
        ) : (
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {requests.map((request) => {
              const next = NEXT_STATUSES[request.status];
              return (
                <div key={request.id} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>{request.pickupAddress}</strong>
                    <span className="badge badge-cyan">{titleCase(request.status)}</span>
                  </div>
                  <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
                    {request.emergencyDescription}
                  </p>
                  <div className="subtle" style={{ marginTop: '0.35rem' }}>
                    {formatDateTime(request.createdAt)}
                    {request.citizen ? ` · ${request.citizen.name}` : ''}
                    {/* The API withholds phone/email until the request is
                        ACCEPTED, so this simply shows what it returns. */}
                    {request.citizen?.phone ? ` · ${request.citizen.phone}` : ''}
                  </div>

                  {next.length > 0 ? (
                    <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {request.status === 'REQUESTED' && fleet.length > 0 ? (
                        <select
                          className="input-control"
                          style={{ width: 'auto' }}
                          value={vehicleFor[request.id] ?? fleet[0].id}
                          onChange={(e) => setVehicleFor({ ...vehicleFor, [request.id]: e.target.value })}
                        >
                          {fleet.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.vehicleNumber} ({titleCase(vehicle.status)})
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {next.map((status) => (
                        <button
                          key={status}
                          className={status === 'CANCELLED' ? 'btn-secondary' : 'btn-primary'}
                          style={{ fontSize: '0.82rem' }}
                          disabled={busyId === request.id}
                          onClick={() => advance(request, status)}
                        >
                          {titleCase(status)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProviderPage() {
  const user = useAuthStore((s) => s.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // `/auth/me` returns the caller's organisations but not every nested relation
  // (no blood inventory, no medicines), so the selected org is re-fetched in
  // full rather than rendering a partially-populated record.
  const orgIds = (user?.organizations ?? []).map((o) => o.id);
  const activeId = selectedId ?? orgIds[0] ?? null;

  const orgQuery = useAsync(
    () => (activeId ? organizations.get(activeId) : Promise.resolve(null)),
    [activeId],
  );

  const org = orgQuery.data;

  if (orgIds.length === 0) {
    return (
      <>
        <PageHeader title="Provider console" />
        <EmptyState
          title="No organisation linked to this account"
          hint="An administrator links a facility record to a provider account. The seeded provider accounts already have one."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Provider console"
        subtitle="Publish the availability citizens see in search."
        action={org ? <VerificationBadge status={org.verificationStatus} /> : null}
      />

      <DemoBanner>
        <>
          <strong>Simulated facility.</strong> This is a fictional demo organisation. Publishing here changes only
          this project&apos;s database.
        </>
      </DemoBanner>

      {orgIds.length > 1 ? (
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <Field label="Facility">
            <select className="input-control" value={activeId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
              {(user?.organizations ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <ErrorNote error={orgQuery.error} />

      {orgQuery.loading ? (
        <SkeletonRows count={2} height={180} />
      ) : !org ? (
        <EmptyState title="Facility not found" />
      ) : (
        <>
          {/* The API enforces this with `requireApproved: true`; stating it here
              means the user is not left guessing after a 403. */}
          {org.verificationStatus !== 'APPROVED' ? (
            <div className="form-error" style={{ marginBottom: '1rem' }}>
              This facility is <strong>{titleCase(org.verificationStatus)}</strong>. Until an administrator approves
              it, availability updates are rejected and the facility does not appear in public search.
              {org.rejectionReason ? <div style={{ marginTop: '0.35rem' }}>Reason: {org.rejectionReason}</div> : null}
            </div>
          ) : null}

          {org.type === 'HOSPITAL' ? <HospitalPanel org={org} onSaved={orgQuery.reload} /> : null}
          {org.type === 'BLOOD_BANK' ? <BloodBankPanel org={org} onSaved={orgQuery.reload} /> : null}
          {org.type === 'PHARMACY' ? <PharmacyPanel org={org} onSaved={orgQuery.reload} /> : null}
          {org.type === 'AMBULANCE_PROVIDER' ? <AmbulancePanel org={org} onSaved={orgQuery.reload} /> : null}
          {org.type === 'NGO' ? (
            <EmptyState title="No availability data for NGOs" hint="NGO records are directory entries only." />
          ) : null}
        </>
      )}
    </>
  );
}
