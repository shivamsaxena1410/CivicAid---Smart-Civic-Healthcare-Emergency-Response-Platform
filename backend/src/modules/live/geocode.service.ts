import { Injectable, Logger } from '@nestjs/common';
import { TtlCache, geoCellKey } from './ttl-cache';

/**
 * Reverse geocoding via Nominatim (OpenStreetMap).
 *
 * The public instance is explicitly rate-limited to 1 request/second and asks
 * callers to identify themselves; the cache enforces the cadence by turning
 * every duplicate lookup into a zero-cost hit, and the User-Agent names this
 * project as the operator of the deployment.
 */

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

export interface ReverseGeocodeResult {
  label: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

const CACHE_TTL_MS = 30 * 60_000;
const TIMEOUT_MS = 10_000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  private readonly cache = new TtlCache<ReverseGeocodeResult>(CACHE_TTL_MS);

  async reverse(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const key = geoCellKey(lat, lng, 3);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('zoom', '16');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let result: ReverseGeocodeResult;
    try {
      // Nominatim's usage policy asks for a descriptive User-Agent; fetch's
      // default identifies only Node, so set one explicitly.
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CivicConnect/1.0 (academic project; single-user demo)' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
      const body = (await res.json()) as NominatimResponse;
      const addr = body.address ?? {};
      result = {
        label: body.display_name ?? `Unknown place (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        street: [addr.house_number, addr.road].filter(Boolean).join(' ') || undefined,
        city: addr.city ?? addr.town ?? addr.village ?? addr.suburb,
        state: addr.state ?? addr.county,
        pincode: addr.postcode,
        country: addr.country,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.warn(`Nominatim lookup for ${lat},${lng} timed out after ${TIMEOUT_MS / 1000}s`);
      } else {
        this.logger.warn(`Nominatim lookup failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
      // The cache deliberately stores a degraded result too: a district health
      // board's one cell, and what the caller should do with an unknown address
      // is show the coordinates, not hammer an API that just failed.
      result = {
        label: `Unknown place (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        city: undefined,
        state: undefined,
      };
    } finally {
      clearTimeout(timer);
    }

    this.cache.set(key, result);
    return result;
  }
}
