import { Injectable, Logger } from '@nestjs/common';
import { TtlCache, geoCellKey } from './ttl-cache';

/**
 * Real healthcare facilities from OpenStreetMap, via the Overpass API.
 *
 * These are genuine, externally-sourced places — a hospital returned here
 * exists. They are deliberately NOT written into the `organizations` table:
 * that table carries bed counts, blood units and medicine stock which are
 * invented for this demo, and putting a real hospital in it would be one join
 * away from presenting fabricated availability as fact. So this endpoint
 * returns location, category and whatever contact tags OSM happens to hold —
 * and never an availability figure.
 *
 * Overpass is volunteer-run infrastructure with a published usage policy, hence
 * the 24-hour cache: facility locations change on the order of months, and a
 * scroll-driven homepage must not issue one query per visitor.
 */

export type LiveFacilityCategory =
  | 'HOSPITAL'
  | 'CLINIC'
  | 'PHARMACY'
  | 'BLOOD_BANK'
  | 'AMBULANCE_STATION';

export interface LiveFacility {
  /** Stable OSM reference, e.g. "node/240116678". Not a CivicConnect id. */
  osmRef: string;
  name: string;
  category: LiveFacilityCategory;
  latitude: number;
  longitude: number;
  distanceKm: number;
  /** Only present when OSM actually holds the tag. Never fabricated. */
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  /** True when tagged emergency=yes — an OSM claim, not a verified fact. */
  hasEmergency: boolean;
}

export interface LiveFacilityResult {
  facilities: LiveFacility[];
  fetchedAt: string;
  /** Present so the UI can attribute the data, which the ODbL licence requires. */
  attribution: string;
  radiusKm: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const CACHE_TTL_MS = 24 * 60 * 60_000;
const TIMEOUT_MS = 30_000;
const MAX_RESULTS = 60;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

@Injectable()
export class OverpassService {
  private readonly logger = new Logger(OverpassService.name);
  private readonly cache = new TtlCache<LiveFacilityResult>(CACHE_TTL_MS, 200);

  async findNearby(lat: number, lng: number, radiusKm: number): Promise<LiveFacilityResult> {
    const key = `${geoCellKey(lat, lng, 2)}:${radiusKm}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const elements = await this.query(lat, lng, radiusKm * 1000);
    const result: LiveFacilityResult = {
      facilities: this.normalize(elements, lat, lng),
      fetchedAt: new Date().toISOString(),
      attribution: ATTRIBUTION,
      radiusKm,
    };

    // An empty list from a failed query would poison the cache for a day, so
    // only a successful query (even one legitimately finding nothing) is stored.
    if (elements !== null) this.cache.set(key, result);
    return result;
  }

  private async query(lat: number, lng: number, radiusM: number): Promise<OverpassElement[] | null> {
    // `out center` collapses ways and relations (most large hospitals are
    // building polygons, not points) to a single representative coordinate.
    const ql = `[out:json][timeout:25];
(
  nwr["amenity"~"^(hospital|clinic|doctors|pharmacy|ambulance_station)$"](around:${radiusM},${lat},${lng});
  nwr["healthcare"~"^(hospital|clinic|doctor|pharmacy|blood_donation)$"](around:${radiusM},${lat},${lng});
);
out center ${MAX_RESULTS * 3};`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'CivicConnect/1.0 (academic project; single-user demo)',
        },
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
      const body = (await res.json()) as { elements?: OverpassElement[] };
      return body.elements ?? [];
    } catch (err) {
      const reason =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `timed out after ${TIMEOUT_MS / 1000}s`
            : err.message
          : 'unknown error';
      this.logger.warn(`Overpass query failed (${reason}); returning no live facilities`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private normalize(
    elements: OverpassElement[] | null,
    originLat: number,
    originLng: number,
  ): LiveFacility[] {
    if (!elements) return [];

    const seen = new Set<string>();
    const out: LiveFacility[] = [];

    for (const el of elements) {
      const tags = el.tags ?? {};
      const name = tags.name?.trim();
      // An unnamed point is not something a person can be directed to, and OSM
      // has many of them (a pharmacy counter inside a mapped supermarket, say).
      if (!name) continue;

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat === undefined || lon === undefined) continue;

      const category = this.categorize(tags);
      if (!category) continue;

      // Large facilities are frequently mapped twice — once as a building way
      // and once as an entrance node — so collapse on name + ~100 m cell.
      const dedupeKey = `${name.toLowerCase()}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      out.push({
        osmRef: `${el.type}/${el.id}`,
        name,
        category,
        latitude: lat,
        longitude: lon,
        distanceKm: this.haversineKm(originLat, originLng, lat, lon),
        address: this.address(tags),
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        website: tags.website ?? tags['contact:website'] ?? null,
        openingHours: tags.opening_hours ?? null,
        hasEmergency: tags.emergency === 'yes',
      });
    }

    return out.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_RESULTS);
  }

  private categorize(tags: Record<string, string>): LiveFacilityCategory | null {
    const amenity = tags.amenity;
    const healthcare = tags.healthcare;

    if (healthcare === 'blood_donation' || amenity === 'blood_bank') return 'BLOOD_BANK';
    if (amenity === 'ambulance_station') return 'AMBULANCE_STATION';
    if (amenity === 'pharmacy' || healthcare === 'pharmacy') return 'PHARMACY';
    if (amenity === 'hospital' || healthcare === 'hospital') return 'HOSPITAL';
    if (amenity === 'clinic' || amenity === 'doctors') return 'CLINIC';
    if (healthcare === 'clinic' || healthcare === 'doctor') return 'CLINIC';
    return null;
  }

  private address(tags: Record<string, string>): string | null {
    const parts = [
      [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
      tags['addr:suburb'],
      tags['addr:city'],
      tags['addr:postcode'],
    ].filter((p): p is string => Boolean(p && p.length));
    return parts.length ? parts.join(', ') : null;
  }

  /**
   * Straight-line distance for results that never touch the database.
   *
   * The organisation search uses PostGIS (`ST_Distance` on the generated
   * geography column) precisely so this arithmetic does not live in five
   * services. These points are third-party JSON that is never persisted, so
   * there is no geography column to query — computing it here is the only
   * option, not a reintroduction of the pattern that was removed.
   */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 100) / 100;
  }
}
