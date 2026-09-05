'use client';

/**
 * Provenance labelling.
 *
 * The homepage puts real OpenStreetMap places and seeded fictional
 * organisations on the same screen, sometimes on the same map. Whenever that
 * happens the reader must be able to tell which is which without being told
 * twice, so every data-bearing chapter renders one of these.
 *
 * `live` — genuinely exists; sourced from a named third party.
 * `demo` — fictional, and any availability figure attached to it is invented.
 */

export type Provenance = 'live' | 'demo';

export function ProvenanceLabel({
  kind,
  source,
  fetchedAt,
  className = '',
}: {
  kind: Provenance;
  /** Who the data actually came from, e.g. "OpenStreetMap". Required for `live`. */
  source?: string;
  /** ISO timestamp from the API; rendered as a local HH:MM. */
  fetchedAt?: string | null;
  className?: string;
}) {
  const time = fetchedAt ? formatClock(fetchedAt) : null;

  return (
    <p className={`cc-ch-provenance cc-ch-provenance--${kind} ${className}`.trim()}>
      <span className="cc-ch-provenance__dot" aria-hidden />
      {kind === 'live' ? (
        <>
          <strong>Live data</strong>
          <span>
            {source ?? 'third-party source'}
            {time ? ` · fetched ${time}` : ''}
          </span>
        </>
      ) : (
        <>
          <strong>Simulated</strong>
          <span>Fictional organisations; availability figures are invented for this demo.</span>
        </>
      )}
    </p>
  );
}

/**
 * The API returns two different time shapes: a UTC instant with a `Z`
 * (`fetchedAt`) and an upstream local-time reading without a zone
 * (`observedAt`, e.g. "2026-09-05T04:45"). `new Date()` treats the second as
 * local, which is what the upstream meant by it, so both render correctly.
 */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
