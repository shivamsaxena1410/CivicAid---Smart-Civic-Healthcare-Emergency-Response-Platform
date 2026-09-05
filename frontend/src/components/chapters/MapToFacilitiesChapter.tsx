'use client';

import { useMemo, useRef } from 'react';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { Ambulance, Cross, Droplet, Pill, Stethoscope } from 'lucide-react';
import { MapPanel, type MapPoint } from '../MapPanel';
import { useLocationStore } from '../../store/location.store';
import { useChapterScroll } from './scroll';
import { ProvenanceLabel } from './Provenance';
import { useLiveFacilities } from './useLiveData';
import type { LiveFacility, LiveFacilityCategory } from '../../types';

/**
 * Chapter 2 — Map → Facilities.
 *
 * Pinned. The map shrinks to a side panel and a column of **real** OpenStreetMap
 * facilities slides in beside it, nearest first.
 *
 * Everything in this chapter genuinely exists — these are the same rows an
 * Overpass query returns, with the phone numbers and addresses OSM actually
 * holds. Note what is deliberately not rendered: no bed counts, no stock, no
 * "3 ICU beds free". The live endpoint carries no availability fields at all,
 * because attaching an invented number to a real hospital is the one mistake
 * this page must never make.
 */

const CATEGORY_ICON: Record<LiveFacilityCategory, typeof Cross> = {
  HOSPITAL: Cross,
  CLINIC: Stethoscope,
  PHARMACY: Pill,
  BLOOD_BANK: Droplet,
  AMBULANCE_STATION: Ambulance,
};

const CATEGORY_LABEL: Record<LiveFacilityCategory, string> = {
  HOSPITAL: 'Hospital',
  CLINIC: 'Clinic',
  PHARMACY: 'Pharmacy',
  BLOOD_BANK: 'Blood bank',
  AMBULANCE_STATION: 'Ambulance station',
};

/** Maps an OSM category onto the map pin colours already used by FacilityMap. */
const CATEGORY_TO_ORG_TYPE: Partial<Record<LiveFacilityCategory, MapPoint['type']>> = {
  HOSPITAL: 'HOSPITAL',
  CLINIC: 'HOSPITAL',
  PHARMACY: 'PHARMACY',
  BLOOD_BANK: 'BLOOD_BANK',
  AMBULANCE_STATION: 'AMBULANCE_PROVIDER',
};

export function MapToFacilitiesChapter({ id = 'facilities' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useChapterScroll(ref);
  const reduced = useReducedMotion();

  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);
  const radiusKm = useLocationStore((s) => s.radiusKm);

  const { data, loading, error } = useLiveFacilities();
  const facilities = useMemo(() => data?.facilities.slice(0, 8) ?? [], [data]);

  const points: MapPoint[] = useMemo(
    () =>
      facilities.map((f) => ({
        id: f.osmRef,
        name: f.name,
        latitude: f.latitude,
        longitude: f.longitude,
        type: CATEGORY_TO_ORG_TYPE[f.category],
        distanceKm: f.distanceKm,
        detail: CATEGORY_LABEL[f.category],
      })),
    [facilities],
  );

  const mapX = useTransform(progress, [0, 0.4], ['0%', '-6%']);
  const mapScale = useTransform(progress, [0, 0.4], [1, 0.86]);
  const listX = useTransform(progress, [0.1, 0.5], [60, 0]);
  const listOpacity = useTransform(progress, [0.1, 0.4], [0, 1]);

  return (
    <section ref={ref} className="cc-ch cc-ch--tall" id={id} aria-labelledby="cc-ch-fac-title">
      <div className="cc-ch__pin cc-ch-fac__pin">
        <motion.div
          className="cc-ch-fac__map"
          style={reduced ? undefined : { x: mapX, scale: mapScale }}
        >
          <MapPanel points={points} lat={lat} lng={lng} radiusKm={Math.min(radiusKm, 5)} height={560} />
        </motion.div>

        <motion.div
          className="cc-ch-fac__list"
          style={reduced ? undefined : { x: listX, opacity: listOpacity }}
        >
          <p className="cc-ch-eyebrow">
            <span className="cc-ch-eyebrow__dot" aria-hidden />
            02 / Real places
          </p>
          <h2 id="cc-ch-fac-title" className="cc-ch-h3">
            These ones
            <br />
            <span>actually exist.</span>
          </h2>

          {loading ? (
            <div className="cc-ch-fac__loading" role="status">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 66 }} />
              ))}
              <span className="cc-ch-note">Querying OpenStreetMap…</span>
            </div>
          ) : error || facilities.length === 0 ? (
            // An upstream outage says so plainly rather than falling back to
            // invented placeholders, which would defeat the entire point.
            <p className="cc-ch-fac__empty">
              {error
                ? 'OpenStreetMap could not be reached just now. No facilities to show — rather than guess, this space stays empty.'
                : 'No mapped facilities within this radius. Try widening the search area.'}
            </p>
          ) : (
            <ul className="cc-ch-fac__items">
              {facilities.map((facility, i) => (
                <FacilityRow key={facility.osmRef} facility={facility} index={i} reduced={!!reduced} />
              ))}
            </ul>
          )}

          <ProvenanceLabel
            kind="live"
            source={data?.attribution ?? '© OpenStreetMap contributors (ODbL)'}
            fetchedAt={data?.fetchedAt}
          />
        </motion.div>
      </div>
    </section>
  );
}

function FacilityRow({
  facility,
  index,
  reduced,
}: {
  facility: LiveFacility;
  index: number;
  reduced: boolean;
}) {
  const Icon = CATEGORY_ICON[facility.category];

  return (
    <motion.li
      className={`cc-ch-fac__item${index === 0 ? ' is-nearest' : ''}`}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 130, damping: 18 }}
    >
      <span className={`cc-ch-fac__icon cc-ch-fac__icon--${facility.category.toLowerCase()}`}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="cc-ch-fac__body">
        <span className="cc-ch-fac__cat">{CATEGORY_LABEL[facility.category]}</span>
        <strong>{facility.name}</strong>
        <small>
          {facility.distanceKm.toFixed(1)} km away
          {facility.address ? ` · ${facility.address}` : ''}
        </small>
      </span>
      {/* Rendered only when OSM actually holds the tag — never a placeholder. */}
      {facility.phone ? (
        <a className="cc-ch-fac__call" href={`tel:${facility.phone.replace(/\s+/g, '')}`}>
          Call
        </a>
      ) : null}
    </motion.li>
  );
}
