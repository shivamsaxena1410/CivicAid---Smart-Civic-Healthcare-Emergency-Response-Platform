'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { MapPin, Navigation } from 'lucide-react';
import { MapPanel } from '../MapPanel';
import { useLocationStore } from '../../store/location.store';
import { useChapterScroll } from './scroll';

/**
 * Chapter 1 — Hero → Map.
 *
 * Pinned. A real Leaflet map grows out of a small pill in the lower-left to
 * fill the frame, while a masthead settles above it. This is the chapter that
 * establishes the map as a persistent surface: `MapToFacilitiesChapter` picks
 * it up from here, so the two read as one continuous camera move rather than
 * two sections that each happen to contain a map.
 *
 * The map is centred on the reader's chosen origin (the location store), not a
 * hardcoded coordinate, so "use my location" upstream is reflected here.
 */
export function HeroToMapChapter({ id = 'nearby' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useChapterScroll(ref);
  const reduced = useReducedMotion();

  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);
  const radiusKm = useLocationStore((s) => s.radiusKm);
  const label = useLocationStore((s) => s.label);
  const locate = useLocationStore((s) => s.locate);
  const locating = useLocationStore((s) => s.locating);

  const mapScale = useTransform(progress, [0, 0.55], [0.42, 1]);
  const mapOpacity = useTransform(progress, [0, 0.3], [0, 1]);
  const mapRadius = useTransform(progress, [0, 0.55], [220, 28]);
  const copyY = useTransform(progress, [0, 0.55], [40, 0]);
  const copyOpacity = useTransform(progress, [0, 0.25], [0, 1]);

  return (
    <section ref={ref} className="cc-ch cc-ch--tall" id={id} aria-labelledby="cc-ch-map-title">
      <div className="cc-ch__pin cc-ch-map__pin">
        <motion.div
          className="cc-ch-map__copy"
          style={reduced ? undefined : { y: copyY, opacity: copyOpacity }}
        >
          <p className="cc-ch-eyebrow">
            <span className="cc-ch-eyebrow__dot" aria-hidden />
            01 / Nearby care
          </p>
          <h2 id="cc-ch-map-title" className="cc-ch-h2">
            Start with
            <br />
            <span>what’s near.</span>
          </h2>
          <p className="cc-ch-lede">
            Set an origin and the whole page re-centres on it — the map, the facilities, and the air
            quality all follow.
          </p>

          <div className="cc-ch-map__controls">
            <button type="button" className="cc-ch-pill" onClick={locate} disabled={locating}>
              <Navigation size={15} aria-hidden />
              {locating ? 'Locating…' : 'Use my location'}
            </button>
            <span className="cc-ch-map__where">
              <MapPin size={13} aria-hidden /> {label}
            </span>
          </div>
        </motion.div>

        <motion.div
          className="cc-ch-map__stage"
          style={
            reduced
              ? undefined
              : { scale: mapScale, opacity: mapOpacity, borderRadius: mapRadius }
          }
        >
          {/* Kept mounted for the whole chapter so Leaflet never re-fetches
              tiles mid-transition, which would flash an unstyled map. */}
          <MapPanel points={[]} lat={lat} lng={lng} radiusKm={radiusKm} height={620} />
        </motion.div>
      </div>
    </section>
  );
}
