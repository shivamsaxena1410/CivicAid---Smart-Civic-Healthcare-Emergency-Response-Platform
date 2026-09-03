'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { OrgType } from '../types';

/**
 * Leaflet map for facility results.
 *
 * Loaded through `next/dynamic` with `ssr: false` by its callers: Leaflet
 * touches `window` at import time, so prerendering this on the server throws.
 */

export interface MapPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type?: OrgType;
  distanceKm?: number | null;
  detail?: string;
  href?: string;
}

const TYPE_COLOR: Record<string, string> = {
  HOSPITAL: '#3b82f6',
  BLOOD_BANK: '#f43f5e',
  PHARMACY: '#10b981',
  AMBULANCE_PROVIDER: '#f59e0b',
  NGO: '#8b5cf6',
};

/**
 * Marker icons are built as inline SVG data URLs rather than the default
 * Leaflet PNG sprites, whose paths break under a bundler unless the images are
 * re-pointed. This also colour-codes by facility type for free.
 */
function pinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 26 38">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.2 13 25 13 25s13-15.8 13-25C26 5.8 20.2 0 13 0z" fill="${color}" stroke="#0b1120" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="5" fill="#0b1120"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -34],
  });
}

const originIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#06b6d4;border:3px solid #0b1120;box-shadow:0 0 0 4px rgba(6,182,212,0.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Keeps the viewport in sync when the origin or the radius changes. */
function ViewSync({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    // Rough fit: each zoom level halves the visible span. Cheaper and steadier
    // than fitBounds over a result set that changes on every keystroke.
    const zoom = radiusKm <= 2 ? 14 : radiusKm <= 5 ? 13 : radiusKm <= 15 ? 12 : radiusKm <= 25 ? 11 : 10;
    map.setView([lat, lng], zoom);
  }, [lat, lng, radiusKm, map]);
  return null;
}

export default function FacilityMap({
  points,
  lat,
  lng,
  radiusKm,
  height = 420,
}: {
  points: MapPoint[];
  lat: number;
  lng: number;
  radiusKm: number;
  height?: number;
}) {
  const markers = useMemo(
    () => points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    [points],
  );

  return (
    <div style={{ height, marginBottom: '1rem' }}>
      <MapContainer center={[lat, lng]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <ViewSync lat={lat} lng={lng} radiusKm={radiusKm} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* The search radius, drawn so the results list and the map agree about
            what "nearby" means. */}
        <Circle
          center={[lat, lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#06b6d4', weight: 1, fillColor: '#06b6d4', fillOpacity: 0.06 }}
        />
        <Marker position={[lat, lng]} icon={originIcon}>
          <Popup>Search origin</Popup>
        </Marker>

        {markers.map((point) => (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            icon={pinIcon(TYPE_COLOR[point.type ?? ''] ?? '#06b6d4')}
          >
            <Popup>
              <strong>{point.name}</strong>
              {point.detail ? <div style={{ marginTop: 4 }}>{point.detail}</div> : null}
              {point.distanceKm !== null && point.distanceKm !== undefined ? (
                <div style={{ marginTop: 4, opacity: 0.75 }}>{point.distanceKm.toFixed(2)} km away</div>
              ) : null}
              {point.href ? (
                <a href={point.href} style={{ color: '#22d3ee', display: 'block', marginTop: 6 }}>
                  View details →
                </a>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
