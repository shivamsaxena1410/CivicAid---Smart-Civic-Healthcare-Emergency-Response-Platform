'use client';

import { useState } from 'react';
import { useLocationStore } from '../../../store/location.store';
import { useAuthStore } from '../../../store/auth.store';
import { useAsync } from '../../../lib/hooks';
import { ambulances, type AmbulanceRequest } from '../../../lib/endpoints';
import { LocationBar } from '../../../components/LocationBar';
import { MapPanel } from '../../../components/MapPanel';
import { FacilityCard, Metric, MetricRow } from '../../../components/FacilityCard';
import { DemoBanner, EmptyState, ErrorNote, Field, PageHeader, SkeletonRows } from '../../../components/ui';
import { formatDateTime, titleCase } from '../../../lib/format';
import type { AmbulanceRequestStatus } from '../../../types';

const STATUS_CLASS: Record<AmbulanceRequestStatus, string> = {
  REQUESTED: 'badge badge-amber live-pulse',
  ACCEPTED: 'badge badge-cyan',
  EN_ROUTE: 'badge badge-cyan live-pulse',
  COMPLETED: 'badge badge-emerald',
  CANCELLED: 'badge badge-rose',
};

function RequestCard({ request, onCancel, cancelling }: { request: AmbulanceRequest; onCancel: () => void; cancelling: boolean }) {
  // Mirrors ALLOWED_TRANSITIONS in the backend: only these two states can move
  // to CANCELLED, so offering the button elsewhere would just produce a 400.
  const cancellable = request.status === 'REQUESTED' || request.status === 'ACCEPTED';
  return (
    <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div>
          <span className={STATUS_CLASS[request.status]}>{titleCase(request.status)}</span>
          <div style={{ marginTop: '0.45rem', fontWeight: 600 }}>{request.pickupAddress}</div>
          <div className="subtle">{formatDateTime(request.createdAt)}</div>
        </div>
        {cancellable ? (
          <button className="btn-secondary" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel request'}
          </button>
        ) : null}
      </div>

      <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.92rem' }}>
        {request.emergencyDescription}
      </p>

      {request.ambulance ? (
        <div className="glass-card" style={{ marginTop: '0.75rem' }}>
          <div className="stat-label">Assigned vehicle</div>
          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>{request.ambulance.vehicleNumber}</strong>
            <span className="subtle">{request.ambulance.vehicleType}</span>
            <a href={`tel:${request.ambulance.contactNumber}`} className="badge badge-emerald" style={{ textDecoration: 'none' }}>
              {request.ambulance.contactNumber}
            </a>
            {request.ambulance.organization ? (
              <span className="subtle">{request.ambulance.organization.name}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="subtle" style={{ marginTop: '0.6rem' }}>
          Waiting for a provider to accept. Nearby providers can see this request in their console.
        </p>
      )}
    </div>
  );
}

export default function AmbulancePage() {
  const { lat, lng, radiusKm, label } = useLocationStore();
  const user = useAuthStore((s) => s.user);

  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const providersQuery = useAsync(
    () => ambulances.search({ lat, lng, radiusKm, availableOnly: true, limit: 10 }),
    [lat, lng, radiusKm],
  );
  const requestsQuery = useAsync(() => ambulances.listRequests(), []);

  const providers = providersQuery.data?.items ?? [];
  const myRequests = requestsQuery.data ?? [];
  const openRequest = myRequests.find((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');

  const availableVehicles = providers.flatMap((org) =>
    (org.ambulanceDetails ?? [])
      .filter((v) => v.status === 'AVAILABLE')
      .map((v) => ({ ...v, orgName: org.name, distanceKm: org.distanceKm })),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setNotice(null);
    try {
      await ambulances.createRequest({
        pickupLatitude: lat,
        pickupLongitude: lng,
        pickupAddress: address.trim(),
        emergencyDescription: description.trim(),
        ...(selectedVehicleId ? { ambulanceId: selectedVehicleId } : {}),
      });
      setAddress('');
      setDescription('');
      setSelectedVehicleId('');
      setNotice('Request submitted. Providers in range can now see and accept it.');
      requestsQuery.reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (request: AmbulanceRequest) => {
    setCancellingId(request.id);
    setSubmitError(null);
    try {
      await ambulances.updateRequestStatus(request.id, { status: 'CANCELLED' });
      requestsQuery.reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <>
      <PageHeader title="Emergency ambulance" subtitle="Request a dispatch to your location and track it." />
      <DemoBanner>
        <>
          <strong>Simulated dispatch.</strong> Ambulance providers here are fictional demo records. This does not
          contact any real emergency service — in a real emergency, call your national emergency number.
        </>
      </DemoBanner>
      <LocationBar />

      <ErrorNote error={submitError} />
      {notice ? (
        <div className="form-notice" style={{ marginBottom: '1rem' }}>
          {notice}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
        <section>
          <h2 className="section-title">Request a dispatch</h2>
          {openRequest ? (
            <div className="form-notice" style={{ marginBottom: '0.75rem' }}>
              You already have an active request ({titleCase(openRequest.status)}). Cancel it before raising another.
            </div>
          ) : null}
          <form onSubmit={submit} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
            <Field label="Pickup location" hint={`Coordinates sent: ${lat.toFixed(4)}, ${lng.toFixed(4)} (${label})`}>
              <input
                className="input-control"
                required
                placeholder="Building, street, landmark"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field label="What has happened?">
              <textarea
                className="input-control"
                required
                rows={3}
                placeholder="Describe the emergency so responders can prepare."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field
              label="Preferred vehicle (optional)"
              hint="Leave unset to send the request to the open queue for any nearby provider."
            >
              <select
                className="input-control"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
              >
                <option value="">Any available ambulance</option>
                {availableVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicleNumber} — {vehicle.vehicleType} · {vehicle.orgName}
                    {vehicle.distanceKm !== null && vehicle.distanceKm !== undefined
                      ? ` (${vehicle.distanceKm.toFixed(1)} km)`
                      : ''}
                  </option>
                ))}
              </select>
            </Field>
            <button
              className="btn-danger"
              type="submit"
              disabled={submitting || !!openRequest || user?.role !== 'CITIZEN'}
              style={{ justifyContent: 'center' }}
            >
              {submitting ? 'Sending…' : 'Request ambulance'}
            </button>
            {user?.role !== 'CITIZEN' ? (
              <p className="subtle">
                Only citizen accounts can raise a request. Provider accounts accept and dispatch them from the
                provider console.
              </p>
            ) : null}
          </form>
        </section>

        <section>
          <h2 className="section-title">Your requests</h2>
          {requestsQuery.loading ? (
            <SkeletonRows count={2} height={120} />
          ) : myRequests.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {myRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  cancelling={cancellingId === request.id}
                  onCancel={() => cancel(request)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <h2 className="section-title" style={{ marginTop: '1.75rem' }}>
        Ambulance providers within {radiusKm} km
      </h2>

      <MapPanel
        lat={lat}
        lng={lng}
        radiusKm={radiusKm}
        height={300}
        points={providers.map((org) => ({
          id: org.id,
          name: org.name,
          latitude: org.latitude,
          longitude: org.longitude,
          type: org.type,
          distanceKm: org.distanceKm,
          detail: `${(org.ambulanceDetails ?? []).filter((v) => v.status === 'AVAILABLE').length} vehicles available`,
        }))}
      />

      <ErrorNote error={providersQuery.error} />

      {providersQuery.loading ? (
        <SkeletonRows count={2} height={130} />
      ) : providers.length === 0 ? (
        <EmptyState title="No providers with available vehicles in range" hint="Try a larger radius." />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {providers.map((org) => {
            const fleet = org.ambulanceDetails ?? [];
            return (
              <FacilityCard key={org.id} org={org}>
                <MetricRow>
                  <Metric
                    label="Available"
                    value={fleet.filter((v) => v.status === 'AVAILABLE').length}
                    accent="var(--accent-emerald)"
                  />
                  <Metric label="On a call" value={fleet.filter((v) => v.status === 'BUSY').length} accent="var(--accent-amber)" />
                  <Metric label="Fleet size" value={fleet.length} />
                </MetricRow>
              </FacilityCard>
            );
          })}
        </div>
      )}
    </>
  );
}
