/**
 * A tiny TTL cache for third-party responses.
 *
 * Overpass and Nominatim are volunteer-run services with published usage
 * policies; hitting them once per page view would be abusive and would also
 * make the homepage as slow as the slowest mirror. Values are cached per
 * process, which matches the throttler's in-memory storage and is honest for a
 * single-container deployment.
 *
 * Entries are evicted lazily on read plus a bounded sweep on write, so a long
 * uptime with many distinct coordinates cannot grow the map without limit.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (v.expiresAt <= now) this.store.delete(k);
      }
      // Still full after dropping expired entries: evict the oldest insertion,
      // which Map iteration order gives us for free.
      if (this.store.size >= this.maxEntries) {
        const oldest = this.store.keys().next();
        if (!oldest.done) this.store.delete(oldest.value);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

/**
 * Rounds a coordinate to a coarse grid so that nearby requests share a cache
 * entry. Two people 50 m apart do not need two separate Overpass queries.
 *
 * 2 decimal places is roughly a 1.1 km cell at the equator.
 */
export function geoCellKey(lat: number, lng: number, precision = 2): string {
  return `${lat.toFixed(precision)}:${lng.toFixed(precision)}`;
}
