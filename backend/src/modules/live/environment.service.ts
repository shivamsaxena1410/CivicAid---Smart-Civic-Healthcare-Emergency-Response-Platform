import { Injectable, Logger } from '@nestjs/common';
import { TtlCache, geoCellKey } from './ttl-cache';

/**
 * Live environmental data via Open-Meteo (free, no key, no auth).
 *
 * Open-Meteo's air-quality model updates hourly on a ~11 km grid, so a
 * 30-minute server-side cache is indistinguishable from live for a human
 * reading a number, and it keeps a scroll-heavy homepage from issuing one
 * upstream request per visitor.
 *
 * Values are passed through unchanged together with the upstream observation
 * timestamp; nothing is interpolated or invented. The index reported is the
 * **US AQI** because that is what Open-Meteo computes — India's CPCB AQI is not
 * offered by this API, so labelling the number as one would be false.
 */

export interface LiveEnvironment {
  location: string;
  fetchedAt: string;
  weather: {
    temperatureC: number;
    feelsLikeC: number;
    humidityPct: number;
    windKmh: number;
    /** WMO weather interpretation code; the UI maps it to a label and icon. */
    weatherCode: number;
    observedAt: string;
  } | null;
  airQuality: {
    /** US EPA AQI as computed by Open-Meteo. Not the Indian CPCB index. */
    usAqi: number;
    category: string;
    pm25: number | null; // µg/m³
    pm10: number | null; // µg/m³
    observedAt: string;
  } | null;
}

interface ForecastResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

interface AirQualityResponse {
  current?: {
    time: string;
    us_aqi: number | null;
    pm2_5: number | null;
    pm10: number | null;
  };
}

const CACHE_TTL_MS = 30 * 60_000;
const TIMEOUT_MS = 8_000;
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);
  private readonly cache = new TtlCache<LiveEnvironment>(CACHE_TTL_MS);

  /** US EPA AQI breakpoint categories — the scale the returned number is on. */
  private category(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for sensitive groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very unhealthy';
    return 'Hazardous';
  }

  async get(lat: number, lng: number, placeLabel: string): Promise<LiveEnvironment> {
    const key = geoCellKey(lat, lng, 1);
    const cached = this.cache.get(key);
    // The cached payload is keyed on a ~11 km cell but the caller's place label
    // is more precise, so re-stamp it rather than reporting a neighbour's name.
    if (cached) return { ...cached, location: placeLabel };

    const [forecast, air] = await Promise.all([
      this.fetchJson<ForecastResponse>(
        `${FORECAST_URL}?latitude=${lat}&longitude=${lng}` +
          '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
          '&timezone=auto',
      ),
      this.fetchJson<AirQualityResponse>(
        `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lng}` +
          '&current=us_aqi,pm2_5,pm10&timezone=auto',
      ),
    ]);

    const current = forecast?.current;
    const quality = air?.current;
    const aqi = quality?.us_aqi;

    // A failed upstream call yields `null`, never a plausible-looking number.
    // The UI is expected to say "unavailable" rather than show a placeholder.
    const result: LiveEnvironment = {
      location: placeLabel,
      fetchedAt: new Date().toISOString(),
      weather: current
        ? {
            temperatureC: current.temperature_2m,
            feelsLikeC: current.apparent_temperature,
            humidityPct: current.relative_humidity_2m,
            windKmh: current.wind_speed_10m,
            weatherCode: current.weather_code,
            observedAt: current.time,
          }
        : null,
      airQuality:
        quality && aqi !== null && aqi !== undefined
          ? {
              usAqi: aqi,
              category: this.category(aqi),
              pm25: quality.pm2_5 ?? null,
              pm10: quality.pm10 ?? null,
              observedAt: quality.time,
            }
          : null,
    };

    // Only cache a usable answer: caching a total outage for 30 minutes would
    // keep showing "unavailable" long after the upstream recovered.
    if (result.weather || result.airQuality) this.cache.set(key, result);
    return result;
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      const reason =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `timed out after ${TIMEOUT_MS / 1000}s`
            : err.message
          : 'unknown error';
      this.logger.warn(`Open-Meteo request failed (${reason}); reporting unavailable`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
