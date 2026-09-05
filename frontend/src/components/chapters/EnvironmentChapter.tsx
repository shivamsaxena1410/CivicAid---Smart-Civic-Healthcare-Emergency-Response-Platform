'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { MapPin, Wind } from 'lucide-react';
import { useChapterScroll } from './scroll';
import { ProvenanceLabel, formatClock } from './Provenance';
import { useLiveEnvironment } from './useLiveData';

/**
 * Chapter 4 — Environment.
 *
 * Pinned. One oversized temperature fills the frame, then slides up to make
 * room for the air-quality reading.
 *
 * Every number here is a real observation from Open-Meteo for the reader's
 * chosen coordinates. When the upstream call fails the panel says "unavailable"
 * — it never falls back to a plausible-looking constant, because a hardcoded
 * "28°C" under a "live" label is simply a false statement.
 *
 * The index is the **US EPA AQI**, which is what Open-Meteo computes. India's
 * CPCB AQI uses different breakpoints and would give a different number for the
 * same air, so the footnote naming the scale is not optional decoration.
 */

const AQI_TONE: Array<{ ceiling: number; tone: string }> = [
  { ceiling: 50, tone: 'good' },
  { ceiling: 100, tone: 'moderate' },
  { ceiling: 150, tone: 'sensitive' },
  { ceiling: 200, tone: 'unhealthy' },
  { ceiling: 300, tone: 'very-unhealthy' },
  { ceiling: Infinity, tone: 'hazardous' },
];

const toneFor = (aqi: number) => AQI_TONE.find((t) => aqi <= t.ceiling)?.tone ?? 'hazardous';

export function EnvironmentChapter({ id = 'environment' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useChapterScroll(ref);
  const reduced = useReducedMotion();
  const { data, loading, error } = useLiveEnvironment();

  const tempScale = useTransform(progress, [0, 0.35], [0.86, 1]);
  const tempY = useTransform(progress, [0.35, 0.75], ['0%', '-22%']);
  const aqiRaw = useTransform(progress, [0.4, 0.7], [0, 1]);
  const aqiSpring = useSpring(aqiRaw, { stiffness: 120, damping: 14 });
  const aqiOpacity = useTransform(aqiSpring, [0, 1], [0, 1]);
  const aqiY = useTransform(aqiSpring, [0, 1], [50, 0]);

  const weather = data?.weather ?? null;
  const air = data?.airQuality ?? null;

  return (
    <section ref={ref} className="cc-ch cc-ch--tall" id={id} aria-labelledby="cc-ch-env-title">
      <div className="cc-ch__pin cc-ch-env__pin">
        <div className="cc-ch-env__head">
          <p className="cc-ch-eyebrow">
            <span className="cc-ch-eyebrow__dot" aria-hidden />
            04 / Live conditions
          </p>
          <h2 id="cc-ch-env-title" className="cc-ch-h2">
            Know the air
            <br />
            <span>you’re breathing.</span>
          </h2>
        </div>

        <motion.div
          className="cc-ch-env__temp"
          style={reduced ? undefined : { scale: tempScale, y: tempY }}
        >
          {loading ? (
            <span className="cc-ch-env__pending">—</span>
          ) : weather ? (
            <>
              {Math.round(weather.temperatureC)}
              <span className="cc-ch-env__unit">°C</span>
            </>
          ) : (
            <span className="cc-ch-env__pending" title="Upstream observation unavailable">
              n/a
            </span>
          )}
        </motion.div>

        {weather ? (
          <p className="cc-ch-env__feels">
            Feels like {Math.round(weather.feelsLikeC)}°C · {weather.humidityPct}% humidity ·{' '}
            {Math.round(weather.windKmh)} km/h wind
          </p>
        ) : null}

        <motion.div
          className="cc-ch-env__aqi"
          style={reduced ? undefined : { opacity: aqiOpacity, y: aqiY }}
        >
          {air ? (
            <>
              <strong className={`cc-ch-env__aqi-value is-${toneFor(air.usAqi)}`}>{air.usAqi}</strong>
              <span className="cc-ch-env__aqi-meta">
                <span className="cc-ch-env__aqi-scale">US EPA AQI</span>
                <em>{air.category}</em>
                {air.pm25 !== null ? <small>PM2.5 {air.pm25} µg/m³</small> : null}
              </span>
            </>
          ) : loading ? null : (
            <span className="cc-ch-env__aqi-meta">
              <em>Air quality unavailable</em>
              <small>The upstream reading could not be fetched. No figure is shown.</small>
            </span>
          )}
        </motion.div>

        <div className="cc-ch-env__foot">
          <p className="cc-ch-env__where">
            <MapPin size={14} aria-hidden /> {data?.place?.label ?? data?.location ?? 'Locating…'}
          </p>
          <p className="cc-ch-note cc-ch-env__caveat">
            <Wind size={13} aria-hidden /> The index shown is the US EPA AQI, which is what
            Open-Meteo computes — not the Indian CPCB index.
          </p>
          <ProvenanceLabel
            kind="live"
            source={data?.sources?.join(' · ') ?? 'Open-Meteo'}
            fetchedAt={data?.fetchedAt}
          />
          {air ? (
            <p className="cc-ch-note">Observed {formatClock(air.observedAt)}</p>
          ) : error ? (
            <p className="cc-ch-note">Upstream unreachable.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
