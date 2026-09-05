'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useChapterScroll } from './scroll';
import { ProvenanceLabel } from './Provenance';
import { useDemoOrganizations } from './useLiveData';
import type { OrgType } from '../../types';

/**
 * Chapter 3 — Facilities → Healthcare discovery.
 *
 * Pinned. A spatial, slightly-rotated grid of the seeded demo organisations.
 *
 * This is the counterpart to `MapToFacilitiesChapter`, and the contrast is the
 * point: those places are real, these are invented. Only these carry
 * availability figures — beds, units, stock — because only a fictional hospital
 * can be given a bed count without lying. The provenance banner is not a
 * disclaimer bolted on at the end; it is why the two chapters exist separately.
 */

const FILTERS: Array<{ label: string; value: OrgType | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Hospitals', value: 'HOSPITAL' },
  { label: 'Blood banks', value: 'BLOOD_BANK' },
  { label: 'Pharmacies', value: 'PHARMACY' },
];

/** Deterministic per-index tilt: random would reshuffle on every render. */
const tiltFor = (i: number) => [-1.8, 1.2, -0.9, 2, -1.4, 0.8][i % 6];
const liftFor = (i: number) => [0, 10, 4, 12, 2, 8][i % 6];

export function FacilitiesToDiscoveryChapter({ id = 'discover' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useChapterScroll(ref);
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState<OrgType | 'ALL'>('ALL');

  const { data, loading } = useDemoOrganizations(6);
  const shown = filter === 'ALL' ? data : data.filter((org) => org.type === filter);

  const gridY = useTransform(progress, [0, 0.4], [50, 0]);
  const gridOpacity = useTransform(progress, [0, 0.3], [0, 1]);

  return (
    <section ref={ref} className="cc-ch cc-ch--tall" id={id} aria-labelledby="cc-ch-disc-title">
      <div className="cc-ch__pin cc-ch-disc__pin">
        <div className="cc-ch-disc__head">
          <div>
            <p className="cc-ch-eyebrow">
              <span className="cc-ch-eyebrow__dot" aria-hidden />
              03 / Discovery
            </p>
            <h2 id="cc-ch-disc-title" className="cc-ch-h2">
              Care is a
              <br />
              <span>shorter walk away.</span>
            </h2>
          </div>
          <ProvenanceLabel kind="demo" className="cc-ch-disc__provenance" />
        </div>

        <div className="cc-ch-disc__filters" role="group" aria-label="Filter by facility type">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`cc-ch-chip${filter === f.value ? ' is-active' : ''}`}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <motion.div
          className="cc-ch-disc__grid"
          style={reduced ? undefined : { y: gridY, opacity: gridOpacity }}
        >
          {loading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 150 }} />)
          ) : shown.length === 0 ? (
            <p className="cc-ch-fac__empty">No seeded organisations match that filter.</p>
          ) : (
            shown.map((org, i) => (
              <motion.article
                key={org.id}
                className="cc-ch-disc__card"
                style={reduced ? undefined : { rotate: tiltFor(i), y: liftFor(i) }}
                whileHover={reduced ? undefined : { rotate: 0, y: liftFor(i) - 6 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <span className="cc-ch-disc__type">{org.type.replace(/_/g, ' ').toLowerCase()}</span>
                <h3>{org.name}</h3>
                {org.distanceKm !== null && org.distanceKm !== undefined ? (
                  <small>{org.distanceKm.toFixed(1)} km from your search area</small>
                ) : null}
                <Link className="cc-ch-btn cc-ch-btn--small" href={`/discover/${org.id}`}>
                  View details <ArrowRight size={15} />
                </Link>
              </motion.article>
            ))
          )}
        </motion.div>
      </div>
    </section>
  );
}
