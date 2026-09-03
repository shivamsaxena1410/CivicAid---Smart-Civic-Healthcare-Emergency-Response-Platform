'use client';

import { useLocationStore, RADIUS_OPTIONS, DEMO_ORIGIN } from '../store/location.store';

/**
 * The origin + radius control shared by all five facility searches.
 *
 * It always states which origin is in use. A results list that says "3.2 km
 * away" is meaningless — and misleading in an emergency context — if the user
 * cannot tell whether that is from their real position or from the seeded demo
 * centre.
 */
export function LocationBar() {
  const { lat, lng, radiusKm, label, isPrecise, locating, error, setRadius, locate, useDemoOrigin } =
    useLocationStore();

  return (
    <div className="glass-card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <div className="stat-label">Searching from</div>
          <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
            {label}{' '}
            {isPrecise ? (
              <span className="badge badge-emerald">device GPS</span>
            ) : (
              <span className="badge badge-amber">approximate</span>
            )}
          </div>
          <div className="subtle" style={{ marginTop: '0.15rem' }}>
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="field-label" style={{ margin: 0 }}>
            Radius
          </span>
          <select
            className="input-control"
            style={{ width: 'auto' }}
            value={radiusKm}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            {RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>

        <button className="btn-secondary" onClick={locate} disabled={locating}>
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        {(isPrecise || lat !== DEMO_ORIGIN.lat || lng !== DEMO_ORIGIN.lng) && (
          <button className="btn-secondary" onClick={useDemoOrigin}>
            Demo centre
          </button>
        )}
      </div>
      {error ? (
        <div className="subtle" style={{ marginTop: '0.6rem', color: '#fbbf24' }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
