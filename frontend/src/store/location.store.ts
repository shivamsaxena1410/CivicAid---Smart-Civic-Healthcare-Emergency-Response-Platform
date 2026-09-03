import { create } from 'zustand';

/**
 * The search origin shared by every facility screen.
 *
 * Kept in one store so switching from "hospitals near me" to "blood banks near
 * me" does not silently change the origin, and so the radius the user picked on
 * one screen still applies on the next.
 */

/** Centre of the seeded demo dataset. See backend/prisma/seed.ts. */
export const DEMO_ORIGIN = {
  lat: 12.9592,
  lng: 77.6499,
  label: 'Demo city centre (seed origin)',
};

export const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

interface LocationState {
  lat: number;
  lng: number;
  radiusKm: number;
  label: string;
  /** True once the browser geolocation API has actually answered. */
  isPrecise: boolean;
  locating: boolean;
  error: string | null;
  setRadius: (radiusKm: number) => void;
  setManual: (lat: number, lng: number, label?: string) => void;
  useDemoOrigin: () => void;
  locate: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  lat: DEMO_ORIGIN.lat,
  lng: DEMO_ORIGIN.lng,
  radiusKm: 15,
  label: DEMO_ORIGIN.label,
  isPrecise: false,
  locating: false,
  error: null,

  setRadius: (radiusKm) => set({ radiusKm }),
  setManual: (lat, lng, label) =>
    set({ lat, lng, label: label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, isPrecise: false, error: null }),
  useDemoOrigin: () =>
    set({ lat: DEMO_ORIGIN.lat, lng: DEMO_ORIGIN.lng, label: DEMO_ORIGIN.label, isPrecise: false, error: null }),

  locate: () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      set({ error: 'This browser does not expose a location API.' });
      return;
    }
    set({ locating: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        set({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          label: 'Your current location',
          isPrecise: true,
          locating: false,
          error: null,
        }),
      (err) =>
        set({
          locating: false,
          // Deliberately keeps the previous origin. Silently resetting to the
          // demo centre after a denied permission would show results for a
          // place the user is not in, without saying so.
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied — still searching from the previous origin.'
              : 'Could not determine your location — still searching from the previous origin.',
        }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  },
}));
