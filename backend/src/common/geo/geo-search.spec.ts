import { describe, it, expect } from 'vitest';
import { toGeoQuery } from './geo-search';

describe('toGeoQuery', () => {
  it('returns null when either coordinate is missing', () => {
    expect(toGeoQuery({})).toBeNull();
    expect(toGeoQuery({ lat: 12.97 })).toBeNull();
    expect(toGeoQuery({ lng: 77.59 })).toBeNull();
  });

  it('accepts zero coordinates', () => {
    // The inherited guard was `if (lat && lng)`, which treats the prime
    // meridian and the equator as "no location supplied" and silently drops
    // the radius filter. This is the regression test for that.
    expect(toGeoQuery({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0, radiusKm: 15 });
    expect(toGeoQuery({ lat: 12.97, lng: 0 })).toEqual({ lat: 12.97, lng: 0, radiusKm: 15 });
  });

  it('preserves a zero radius rather than defaulting it', () => {
    expect(toGeoQuery({ lat: 12.97, lng: 77.59, radiusKm: 0 })?.radiusKm).toBe(0);
  });

  it('defaults the radius when it is absent', () => {
    expect(toGeoQuery({ lat: 12.97, lng: 77.59 })?.radiusKm).toBe(15);
  });
});
