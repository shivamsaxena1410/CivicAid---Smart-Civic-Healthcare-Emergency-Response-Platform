# CivicConnect — Continuation Plan (Post-Hand­over)

## Summary

**Goal:** Continue CivicConnect from its current state without redesigning the
architecture. Commit the uncommitted external-data layer, wire it into the
frontend, then build the cinematic citizen homepage the user asked for. Leave
the existing authenticated dashboard, role consoles, and admin pages intact —
they are the working surface for signed-in users; the new experience is the
front door.

**Scope (in order):**
1. Land the uncommitted `live` module (Overpass / Nominatim / Open-Meteo) and
   the `motion` dependency.
2. Add the thin frontend surface for that module (`endpoints.live`, types).
3. Replace `frontend/src/app/page.tsx` with the cinematic citizen experience:
   Hero → Location/Map → Nearby Real Facilities (OSM) → Healthcare Discovery
   (demo orgs, clearly labeled) → Live Environment → Emergency → Civic Services
   → Final CTA. Use `motion` for scroll-driven storytelling. Respect
   `prefers-reduced-motion`.
4. Small backend completeness pass: confirm the `live` module compiles, add a
   few unit tests, lock its rate limits.
5. Leave P1 / P2 as already-shipped; only touch them if a gap is found.

**Key design decisions (locked in this plan, see "Decisions" for trade-offs):**

- **The homepage (`/`) is a public, scroll-driven citizen experience.** The
  existing `/dashboard` remains the signed-in landing for any role. The
  redirect-on-mount behavior at `/` is removed; instead `/` shows the
  experience and authenticated users see a discreet "Open dashboard" link in
  the top-left so the cinematic page does not strand signed-in staff.
- **The page is one continuous document, not eight stacked sections.**
  Inspired by the interaction model at `drone.riotters.com` but designed
  originally for CivicConnect. The scroll position drives meaningful
  transformations between chapters — pinned storytelling moments, sections
  that morph into the next, large type that changes scale and position,
  the map emerging from the hero, facilities appearing progressively as
  the user scrolls past a pinned list, and an emergency chapter with a
  strong visual transformation. Card grids are replaced with spatial,
  overlapping compositions. Smooth continuity between chapters is the
  priority; small fade/slide accents are secondary.
- **Visual language is a Jitter-inspired light theme** (the user-supplied
  reference). See "Visual design system" below for the full token set. The
  homepage becomes the project's **light/clean presentation surface**;
  the existing authenticated `(app)` shell stays dark (the user did not
  ask for it to change). This is a deliberate split: presentation on `/`,
  work in `/(app)/*`. It is the same pattern as a marketing site that
  links into a dark-mode product.
- **Real OSM facility data and live environment data are surfaced at `/` from
  the `live` module.** The existing paged, simulated-availability discovery
  flow stays at `/discover` for users who want the full PostGIS-backed list.
- **No new backend dependencies. No new architectural patterns.** The `live`
  module is the only new code path, and it is already complete.
- **No WebGL / Three.js.** Cinematic effects come from `motion`'s
  `useScroll` / `useTransform` / spring presets, CSS sticky positioning,
  CSS `@scroll-timeline` where it helps, and the new Jitter-inspired
  tokens. Keeps the bundle small and the page accessible.
- **Provenance stays explicit.** A persistent banner (in the spirit of the
  existing `DemoBanner`) tells the reader which numbers are real and which
  are simulated on every relevant chapter.

**Non-goals (do not do in this plan):**
- No redesign of the existing dashboard, NavBar, role consoles, admin, or
  provider pages.
- No new external APIs beyond the three already used (OSM, Nominatim,
  Open-Meteo). No API keys, no paid services.
- No microservices. No new auth flow. No migration changes.
- No new P0 security work — it is already complete across commits
  `177da1f` (P0-A), `9ea8e6c` (P0-B/C/D), `6f44501` (P0-E/F), and
  `f603678` (throttle tiers + `any` sweep).
- No additional Tailwind/Turbopack reconfiguration; current setup is working.

---

## Current State (what is already true)

### Already committed and working
| Area | Commit | Notes |
|---|---|---|
| AuthenticatedUser contract + helpers | `177da1f` | `isActive`/`isVerified`, `assertOrgAccess`, `ToBoolean`, `requireApproved`, `CurrentUser` throws on missing. |
| IDOR / PII closure, body validation, publish gate, PostGIS proximity | `9ea8e6c` | P0-B/C/D + PostGIS in one commit. |
| Fail-fast startup, no mock auth, real refresh rotation, smoke test | `6f44501` | P0-E/F. |
| Per-route throttle tiers, no `any` escapes | `f603678` | P0+ hardening. |
| Prisma config + env loading | `144dca7` | `prisma.config.ts` is the CLI source of truth. |
| Initial migration with PostGIS generated column, provenance | `c6d86f0` | geography `Point`, GiST index, `isSimulated`, `dataSource`, unique refresh-hash. |
| Honest seed (fictional DEMO orgs, `isSimulated: true`) | `04cba3b` | Radius tests 2/5/15 km verified. |
| Frontend: auth, dashboard, discovery, facility flows | `d4a95c6` | All `(app)` routes exist. |
| Frontend: provider console + admin/authority views | `8f310c0` | |
| Baseline inherited state | `b7e87aa` | |
| Deny-by-default auth, blocked self-registration | `f9ff3ad` | |
| Schema: PostGIS geography + provenance + unique refresh hash | `e68024f` | |

### Uncommitted (sitting in the working tree)
| File | Status |
|---|---|
| `backend/src/modules/live/{live.module,live.controller,environment.service,geocode.service,overpass.service,ttl-cache}.ts` | Complete, all four controller routes throttled and `@Public()`, no Prisma dep, DTOs validated, 24h/30m/30m caches. |
| `backend/src/modules/live/dto/live-query.dto.ts` | `@IsLatitude`/`@IsLongitude`, radius cap 25 km. |
| `backend/src/app.module.ts` | `LiveModule` imported and added to the module list. |
| `frontend/package.json` + `package-lock.json` | `motion@^13.2.0` added. |
| `backend/tsconfig.build.tsbuildinfo` | Incremental build cache; safe to commit or `.gitignore` per team preference. |

The `live` module compiles under `npx tsc --noEmit` (no diagnostics). It has
no tests yet — see "Tests" below.

### Current `/` behavior
`frontend/src/app/page.tsx` is a 26-line client component that redirects
signed-in users to `/dashboard` and everyone else to `/login`. It is the
single thing that has to be replaced to deliver the cinematic homepage.

### Existing frontend affordances worth reusing
- `useLocationStore` (lat/lng/radiusKm, `DEMO_ORIGIN = 12.9592, 77.6499`,
  `RADIUS_OPTIONS`).
- `useAuthStore` and `AuthGate` (session restore exactly once).
- `useAsync` / `useDebounced` hooks.
- `MapPanel` (Leaflet, dark Carto tiles, `MapPoint` type) — already used on
  `/discover` and will be used for the map section.
- CSS tokens in `globals.css`: `--accent-cyan`, `--accent-emerald`,
  `--accent-blue`, `--accent-rose`, `--accent-amber`, `--accent-purple`;
  `.glass-panel`, `.glass-card`, `.btn-primary`, `.btn-secondary`,
  `.btn-danger`, `.badge-*`, `.demo-banner`, `.skeleton`, `.form-error`.
- `DemoBanner` component — used in every existing screen that surfaces
  fabricated numbers.

### Things explicitly **not** in scope
- No re-architecting of `live` (its design is already good: cache + throttling
  + UA strings + attribution + bounded retries).
- No migration of the dashboard to motion — the user wants a single excellent
  experience, not a sweeping rewrite.
- No new external SDKs.

---

## Proposed Architecture

### Visual design system (Jitter-inspired, homepage only)

The user-supplied reference is Jitter (`jitter.video`) — a light, clean,
rounded, colorful product site. The Crèche Tank dark reference is also
provided; we treat it as an **atmosphere influence only** (cinematic,
premium feel), not as the literal palette. The homepage therefore becomes
a **light presentation surface**, while the existing authenticated `(app)`
shell remains the dark work surface. This split is intentional and
preserves every existing screen untouched.

**Tokens to introduce on `/` (and `/` only):**

```css
:root {
  /* Backgrounds */
  --j-bg:           #ffffff;
  --j-bg-soft:      #f2f1f3;   /* Jitter button/block tone */
  --j-bg-muted:     #e5e4e7;
  --j-bg-tint:      #e6f4ff;   /* accent tint for hero backplate */

  /* Text */
  --j-text:         #19171c;   /* never pure #000000 */
  --j-text-muted:   #666666;

  /* Accents */
  --j-primary:      #01b2fd;   /* civic cyan, the brand CTA */
  --j-primary-ink:  #ffffff;   /* text on primary */
  --j-secondary:    #a981ff;   /* secondary purple, used for civic chapter */
  --j-secondary-ink: #17082c;
  --j-accent-mint:  #10b981;   /* used for environment / live data, kept from existing palette */
  --j-accent-rose:  #d94e3b;   /* emergency chapter only */
  --j-accent-amber: #f5ff63;   /* Jitter badge tone, used sparingly as a highlight chip */

  /* Borders & surfaces */
  --j-border:       #f2f1f3;
  --j-border-strong:#e5e4e7;

  /* Radii */
  --j-radius-pill:  9999px;
  --j-radius-card:  50px;      /* default card */
  --j-radius-card-sm: 40px;
  --j-radius-card-xs: 20px;
  --j-radius-pill-btn: 50px;

  /* Spacing — 8px grid */
  --j-s-1: 8px;   --j-s-2: 16px;  --j-s-3: 24px;
  --j-s-4: 32px;  --j-s-5: 40px;  --j-s-6: 60px;
  --j-s-7: 80px;  --j-s-8: 120px;

  /* Shadows (tinted, never pure black) */
  --j-shadow-low:  0 1px 0 0 #fff, -1px 0 0 0 #fff;            /* Jitter "rim" */
  --j-shadow-card: 0 9px 21px 0 rgba(25,23,28,.10),
                   0 38px 38px 0 rgba(25,23,28,.09),
                   0 85px 51px 0 rgba(25,23,28,.05),
                   0 152px 61px 0 rgba(25,23,28,.01),
                   0 237px 66px 0 rgba(25,23,28,0);
  --j-shadow-high: 0 2px 5px 0 rgba(0,0,0,.04),
                   0 10px 10px 0 rgba(0,0,0,.04),
                   0 22px 13px 0 rgba(0,0,0,.02),
                   0 40px 16px 0 rgba(0,0,0,.01),
                   0 62px 17px 0 rgba(0,0,0,0);

  /* Typography */
  --j-font-display: "TWK Lausanne", "Inter Display", "Helvetica Neue", sans-serif;
  --j-font-body:    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --j-font-mono:    "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

  /* Type scale (clamp-based so it shrinks on mobile) */
  --j-t-display: clamp(4.5rem, 14vw, 14rem);   /* 72 → 224 */
  --j-t-h1:      clamp(3.5rem, 9vw, 8.75rem);   /* 56 → 140 */
  --j-t-h2:      clamp(2.5rem, 6vw, 6.25rem);   /* 40 → 100 */
  --j-t-h3:      clamp(1.75rem, 3vw, 1.625rem);/* 28 → 26 (Jitter H3 is 26) */
  --j-t-body:    clamp(1rem, 1.2vw, 1.25rem);  /* 16 → 20 */
  --j-t-small:   clamp(0.85rem, 0.9vw, 0.875rem);
  --j-t-caption: 0.8125rem;

  /* Motion easing — copy Jitter's overshoot curve */
  --j-ease-overshoot: linear(0, .255, .4449, .6018, .7355, .8513, .9525,
    1.0413, 1.1195, 1.1881, 1.2484, 1.3011, 1.3468, 1.3862, 1.4198, 1.4479,
    1.4709, 1.4892, 1.503, 1.5126, 1.5182, 1.52, 1.5189, 1.5156, 1.5101,
    1.5025, 1.4929, 1.4817, 1.469, 1.4552, 1.4406, 1.4254, 1.4099, 1.3943,
    1.3787, 1.3633, 1.3481, 1.3333, 1.3188, 1.3048, 1.2912, 1.278, 1.2653,
    1.253, 1.2412, 1.2298, 1.2188, 1.2083, 1.1981, 1.1883, 1.1789, 1.1698,
    1.1611, 1.1528, 1.1447, 1.137, 1.1296, 1.1225, 1.1156, 1.1091, 1.1028,
    1.0967, 1.0909, 1.0854, 1.0801, 1.075, 1.0701, 1.0654, 1.061, 1.0567,
    1.0526, 1.0488, 1.0451, 1.0415, 1.0382, 1.035, 1.032, 1.0292, 1.0265,
    1.0239, 1.0215, 1.0193, 1.0172, 1.0152, 1.0134, 1.0117, 1.0101, 1.0086,
    1.0073, 1.0061, 1.005, 1.004, 1.0032, 1.0024, 1.0018, 1.0012, 1.0008,
    1.0004, 1.0002, 1, 1);
}
```

**Font loading:** `TWK Lausanne` is a paid Klim Type Foundry face. We must
not bundle it. The plan instead uses Inter Display (free) for the display
role — it is the closest free substitute at the same weight 800 / tight
tracking the Jitter site uses. Inter is already available; we add
`@fontsource-variable/inter` so we can use weight 800 cleanly. The body
font is the existing Inter already shipped by the app. If the user later
wishes to license TWK Lausanne, the swap is a one-token change in
`globals.css` plus two `@font-face` declarations.

**Tokens used by the existing `(app)` shell are NOT replaced.** The two
surfaces share the same `@import` of `tailwindcss` and `leaflet/dist/...`
but pull different CSS custom properties. To prevent the homepage from
leaking the dark theme into the global `body` background, the homepage
page component renders its own `<main>` with `background: var(--j-bg)` and
the existing `body.bg-mesh` continues to apply only to the `(app)` shell
via a wrapper class on `(app)/layout.tsx` (or by scoping the dark mesh
background to that subtree). This is a one-line scoping change.

### Frontend: new citizen homepage
Replace `frontend/src/app/page.tsx`. Move the redirect-only logic to a
backward-compat shim only if we discover a deep link that depended on it
(none in the codebase does).

The new page is **one continuous scroll-driven document, not eight stacked
sections**. Each "chapter" overlaps the next. The scroll position is the
narrative engine: it drives camera-equivalent moves (zoom on a map, scale on
typography, parallax of background plates, reveal of pinned lists). Visual
quality and the scroll narrative take priority over the number of small
animations. Card grids are replaced with spatial, overlapping compositions.
The entire page lives in the Jitter-inspired light palette described above.

**Chapter sequence (all pinned except Hero enter and Final exit):**

0. **Hero enter** — single viewport. White background with a soft `--j-bg-tint`
   radial wash. Display headline "CivicConnect" at `--j-t-display` (up to
   224 px), Inter Display, weight 800, tracking -4.5 px, color `--j-text`.
   Sub-line in `--j-text-muted` at `--j-t-body`. One pill CTA
   (`--j-radius-pill-btn`, `background: var(--j-primary)`, white text, 50 px
   radius): "Try the citizen experience". A subtle scroll hint at the
   bottom: a small label "Scroll" and a 24 px line that gently scales on
   `y` with the page scroll. **No card grids.** The hero is mostly
   typographic, the way Jitter's hero is. Reduced motion → static.

1. **Hero → Map transition** — pinned. The hero headline scales down (`useTransform`
   1 → 0.7) and slides up (`y` 0 → -120), becoming the page's persistent
   masthead. The white background receives a `--j-bg-tint` wash that grows
   into the upper portion of the screen. A real Leaflet map of
   `DEMO_ORIGIN` (12.9592, 77.6499) **grows from a small `--j-bg-muted`
   pill in the lower-left to a full-bleed light-themed map at the right
   of the viewport**, with the radius circle already drawn. `useScroll`
   drives the headline scale and the map `scale` 0.4 → 1 with `opacity`
   0 → 1. The map is the new CartoCDN `light_all` tiles (a one-line URL
   change) so the cartography reads as light cartography, not dark.
   `prefers-reduced-motion` → static composition.

2. **Map → Facilities** — pinned. The map slides slightly to the left and
   shrinks to a side panel sized ~40% of the viewport. A vertical column
   of **real OSM facilities** (from `live.facilities`) appears on the
   right, each card a `--j-bg-soft` rounded rectangle at
   `--j-radius-card` (50 px) with the Jitter card shadow. Each facility
   name is in `--j-t-h3` Inter Display, the category chip uses
   `--j-primary` (HOSPITAL/PHARMACY/CLINIC) or `--j-secondary` (BLOOD_BANK)
   or `--j-accent-rose` (AMBULANCE_STATION). As the user scrolls, cards
   **slide in from below with a staggered `motion` spring** using
   `--j-ease-overshoot` so the appearance is felt, not seen. The closest
   facility is emphasised by scale (1 → 1.05) and a slightly elevated
   shadow. The list is pinned across multiple viewports so the reader can
   read every name. The ODbL attribution is rendered as a fixed
   bottom-left label in `--j-text-muted` at `--j-t-caption`.

3. **Facilities → Healthcare discovery** — pinned, then released. The OSM
   list blurs and slides upward. A second, larger **spatial composition
   layered over the map** appears: a 3×2 grid of demo organisations
   (`organizations.search`) on `--j-bg-muted` cards with `--j-radius-card`,
   but **each card is offset by a small `rotate(-2deg … 2deg)` and
   `translate(0 … 12px)`** so the composition feels spatial, not tabular
   (this is the Jitter "playful" energy applied honestly to a serious
   topic). A pill-shaped `DemoBanner` sits in the upper-right in
   `--j-bg-tint` with a small `--j-accent-amber` chip on its leading edge
   — the provenance is never lost. Category filters are pill chips in
   the upper-right, clickable, with `--j-primary` selected state. Each
   card's CTA is the Jitter pill button: 50 px radius, `--j-primary`
   background, white text, 18 px Inter 600.

4. **Healthcare → Environment** — pinned. The demo grid dissolves outward.
   The page background fades to white. **A single, oversized temperature
   number** in `--j-t-display` Inter Display weight 800 color
   `--j-text` scales in to fill ~60% of the viewport width. Scrolling,
   that number slides up (`y` 0 → -30%) and a smaller AQI number slides
   in below it with a `useSpring` (stiffness 120, damping 14) using
   `--j-ease-overshoot` so the change is felt. The AQI chip colour maps
   to its category (Good `--j-accent-mint`, Moderate `--j-primary`,
   Unhealthy `--j-accent-rose`). The place name from
   `live.geocode/reverse` is a fixed lower-left label in `--j-text-muted`
   at `--j-t-body`. The fetched-at timestamp is a fixed lower-right label
   `Live · HH:MM` in `--j-text-muted` at `--j-t-caption`. The honest
   "US EPA AQI, not the Indian CPCB index" footnote is always visible
   in `--j-t-small`.

5. **Environment → Emergency** — pinned, the most dramatic transformation.
   The white page crossfades to a high-contrast `--j-accent-rose`-on-white
   composition (the emergency chapter uses the Crèche Tank's red accent
   because red is the right colour here, even on a light surface). A
   large "In an emergency" headline at `--j-t-h1` weight 800 color
   `--j-accent-rose` **types itself in** (`staggerChildren` on
   per-character spans, 0.04 s gap, `--j-ease-overshoot` so each
   character overshoots its rest position slightly). The background
   receives a slow 4-second rose-tinted radial pulse (not strobing). Two
   CTAs land below: "Request an ambulance" (primary pill, `--j-accent-rose`
   background, white text) and "Find a hospital now" (outline pill,
   `--j-accent-rose` border, `--j-accent-rose` text). On scroll-out the
   composition **flattens** back to a static emergency badge (a single
   row, no overshoot), so the user does not feel trapped.

6. **Emergency → Civic services** — pinned. The rose composition
   crossfades to white with a faint `--j-secondary` wash (the Jitter
   purple used for the secondary chapter). A 2-up spatial composition of
   **schemes** (left card, slightly forward via `translateY(-8px)`,
   `--j-bg-soft` background) and **complaints** (right card, slightly
   back, `--j-bg-muted` background) appears. Each tile is wide and
   low-aspect (`aspect-ratio: 16/7`), reading parallel. A single line
   under the composition says "These are the services citizens
   actually use." in `--j-text-muted` at `--j-t-body`.

7. **Civic services → Final CTA** — pinned. The 2-up dissolves; a single
   centered composition holds the page. The "CivicConnect" wordmark at
   `--j-t-h1` weight 800 scales back up to `--j-t-display`, completing
   the visual loop with the opening hero. Below it: a one-line
   "Built for citizens, by the people who run it." in `--j-text-muted`
   at `--j-t-body`. The closing CTAs are the Jitter pill style:
   "Register as a citizen" (primary, `--j-primary` background, white
   text) and "Open the dashboard" (outline, `--j-text` border, `--j-text`
   text) for signed-in users, or "Sign in" (outline) for guests. On
   scroll past, the chapter releases and the page ends.

8. **Scroll progress rail** — fixed, right edge, desktop only. A 2 px
   vertical rail in `--j-border-strong` with 8 chapter ticks in
   `--j-border`. The active tick lights up in the chapter's accent
   (`--j-primary` for hero/map/discovery, `--j-accent-mint` for
   environment, `--j-accent-rose` for emergency, `--j-secondary` for
   civic/final). On mobile, the rail collapses to a 2 px top-edge
   progress bar in `--j-primary`. The rail is purely informational on
   first build (click-to-jump can come later).

**Engineering primitives used by the page:**

- A single `useScroll({ target: pageRef, offset: ['start start', 'end end'] })`
  at the page root exposes a `scrollYProgress` that every chapter reads.
  Each chapter computes its own `useTransform` ranges so chapters do not
  have to know about each other.
- Each chapter is rendered inside a `position: relative` container of a
  precise `min-height` (typically `200–400vh`) and uses
  `position: sticky; top: 0; height: 100vh` for its inner content. This is
  the standard "pinned storytelling" pattern: outer div scrolls for the
  length of the chapter, inner div stays pinned, scroll progress drives the
  visual change.
- `useReducedMotion()` (from `motion/react`) returns the static composition
  variant for the entire page; every `useTransform` and `useSpring` is
  bypassed in that branch.
- The Leaflet map is loaded inside the hero→map chapter and kept mounted
  across the next two chapters (the map is in a sticky layer that survives
  scroll), so we do not re-fetch tiles and the user sees a continuous
  cartographic surface from the moment the map appears. When the user
  scrolls out, the map stays as a faint lower-third plate, never removed.
- Per-chapter `next/dynamic` import is **not** used at the chapter level
  (it would unmount pinned content). The MapPanel keeps its existing
  dynamic import for the Leaflet bundle, but the page itself is one tree.
- Tokens come from the new `--j-*` block above. We add a tiny `.cinematic-*`
  utility set (display type shortcuts, sticky chapter positioning, ambient
  gradient keyframes) — no second design system.

**Page composition rule (do not violate):** every chapter is a child of a
single scroll container. No nested `overflow: scroll`. No full-page
`position: fixed` overlays. The fixed elements are limited to the scroll
rail, the top-left open-dashboard affordance, and the per-chapter
provenance label.

### Frontend: live endpoints + types
Add to `frontend/src/lib/endpoints.ts` and `frontend/src/types/index.ts`:

```ts
// endpoints.ts (additions)
export const live = {
  environment: (params: { lat: number; lng: number }) =>
    http.get<LiveEnvironment>(`/live/environment${qs(params)}`).then(r => r.data),
  reverseGeocode: (params: { lat: number; lng: number }) =>
    http.get<ReverseGeocodeResult>(`/live/geocode/reverse${qs(params)}`).then(r => r.data),
  facilities: (params: { lat: number; lng: number; radiusKm?: number }) =>
    http.get<LiveFacilityResult>(`/live/facilities${qs(params)}`).then(r => r.data),
};
```

```ts
// types/index.ts (additions)
export type LiveFacilityCategory =
  | 'HOSPITAL' | 'CLINIC' | 'PHARMACY' | 'BLOOD_BANK' | 'AMBULANCE_STATION';

export interface LiveFacility {
  osmRef: string;
  name: string;
  category: LiveFacilityCategory;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  hasEmergency: boolean;
}
export interface LiveFacilityResult {
  facilities: LiveFacility[];
  fetchedAt: string;
  attribution: string;
  radiusKm: number;
}

export interface ReverseGeocodeResult {
  label: string;
  street?: string; city?: string; state?: string;
  pincode?: string; country?: string;
}

export interface LiveEnvironment {
  location: string;
  fetchedAt: string;
  weather: { temperatureC: number; feelsLikeC: number; humidityPct: number;
             windKmh: number; weatherCode: number; observedAt: string } | null;
  airQuality: { usAqi: number; category: string; pm25: number | null;
                pm10: number | null; observedAt: string } | null;
}
```

These mirror the backend interfaces in `live/{overpass,geocode,environment}.service.ts`
without inventing new fields.

### Frontend: motion usage policy
Use `motion/react` (the v13 surface that ships with `motion@13.2.0`):
- `useScroll` + `useTransform` are the primary tools. They drive every
  pinned-chapter transformation: hero scale, map grow-in, facility
  reveal, headline slide, type scale changes, gradient crossfades.
- `useSpring` is used sparingly — emergency chapter heading, the closing
  wordmark loop-back, and the per-facility card spring. The spring's
  easing is `--j-ease-overshoot` so the rest position overshoots like
  Jitter. No springs on every element.
- `useReducedMotion()` (built into motion) is checked once at the page
  root. When `prefers-reduced-motion: reduce` is set, every chapter
  renders a **static composition** that shows the same information in a
  flat, scrollable stack. No transforms, no springs, no scroll-driven
  scale. The page is still a single continuous document; it just stops
  being cinematic.
- `useInView` / `whileInView` are used only for elements outside pinned
  chapters (the few "release" moments when a chapter unsticks). Inside
  chapters, scroll progress does the work, not viewport entry.
- No `AnimatePresence`-heavy re-mounts; the page is a single document.

### Frontend: routing
- `/` — new cinematic page. Public. White Jitter-themed surface.
- `/login` and `/register` — unchanged (stay on the dark theme so a guest
  signing in does not see a theme flip).
- `(app)/dashboard` and every other `(app)/*` route — unchanged. The NavBar
  continues to mount inside `(app)/layout.tsx`; the homepage is outside the
  group and renders no NavBar. The `(app)` shell keeps the existing dark
  mesh background. The transition between the light `/` and the dark
  `(app)` is a deliberate "presentation → work" split.

### Backend: nothing architectural changes
- The `live` module is the only new code path. It is wired into
  `app.module.ts` already (uncommitted).
- No new Prisma models, no migration.
- No new throttle tier; per-route `@Throttle` on `live` is set (15/min for
  Overpass, 30/min for env and reverse-geocode).

---

## End-to-End Flow

```
Visitor opens / (cold)
  → page.tsx renders the cinematic document
  → first paint: hero enter (static, no fetch)
  → chapter 1 (Hero → Map): hero headline begins transforming, the map
    starts fetching /api/v1/live/facilities and /api/v1/live/geocode/reverse
    in parallel; the map fades in once tiles and the OSM response arrive
  → chapter 2 (Map → Facilities): facilities from the OSM response
    progressively appear; the map continues to fly to the nearest
  → chapter 3 (Facilities → Healthcare): demo orgs from
    /api/v1/organizations load and overlap the map as a second
    composition with the DemoBanner
  → chapter 4 (Environment): /api/v1/live/environment resolves; the
    temperature and AQI numbers settle in
  → chapter 5 (Emergency): pure visual transformation, no fetch
  → chapter 6 (Civic services): /api/v1/schemes (light fetch, not paged)
    for the two featured schemes
  → chapter 7 (Final CTA): no fetch
  → chapter 8 (Scroll progress rail): no fetch, just a fixed overlay

Signed-in user lands on / from elsewhere
  → same document; the top-left "Open dashboard" link is rendered
  → signing in does not redirect away from / unless the user clicks it
```

All fetches are triggered on chapter entry (the moment its outer container
starts entering the viewport). The hero chapter and the closing chapters
make no network calls. The live module's server-side caches make the three
`/api/v1/live/*` calls cheap after the first visit.

---

## State, Ownership, Concurrency, Failure, Recovery

- **Session/auth state.** `useAuthStore` is the single source of truth,
  hydrated by `AuthGate` once. The cinematic page reads it to know whether
  to show the guest CTAs or the "Open dashboard" affordance. The page does
  not mutate the auth store.
- **Location state.** `useLocationStore` is the only owner of
  `lat/lng/radiusKm/label`. The cinematic page calls `locate()` only on
  user gesture (a button), never on mount — silent geolocation on a
  landing page is hostile UX.
- **Live data.** Each section owns its own `useAsync` call against the
  `live` endpoint group. Failures render an in-section "Live data
  unavailable" badge (using the existing `.subtle` style); they do not
  throw, do not block other sections, and do not bubble to the global
  error envelope.
- **Caching.** Server-side caches are per-process TTL; in the browser we
  rely on the server cache and avoid a redundant React Query layer for
  three read-only endpoints.
- **Concurrency.** No two live sections share a request; they are
  independent. The map section debounces location changes (existing
  `useDebounced` hook).
- **Reduced motion.** When `prefers-reduced-motion: reduce` is set, the
  page becomes a static, fully-readable, scannable version of the same
  eight sections. No content is gated behind animation.
- **Failure modes.**
  - Overpass timeout: section 3 shows "Live facility data temporarily
    unavailable" and links to `/discover` for the simulated list.
  - Open-Meteo timeout: section 5 shows "—" placeholders, not 0 °C.
  - Nominatim timeout: location label falls back to the lat/lng string.
  - All three already produce `null` / graceful fallbacks in
    `environment.service.ts` and `geocode.service.ts`; no frontend
    catch-and-retry is needed.

---

## Phased Implementation

### Phase 0 — Land the uncommitted work (≈30 min)
- Stage and commit the `live` module + `app.module.ts` change as one commit.
- Stage and commit `frontend/package.json` + `package-lock.json` (`motion`).
- Run `cd backend && npx tsc --noEmit` to confirm clean.
- Run `cd frontend && npm run lint` and `npm run build` to confirm clean.
- (Decide whether to keep `tsconfig.build.tsbuildinfo` in git; current
  state has it tracked. Leave as-is — that is the team policy.)

### Phase 1 — Frontend live surface (≈30 min)
- Add `LiveFacility`, `LiveFacilityResult`, `ReverseGeocodeResult`,
  `LiveEnvironment`, `LiveFacilityCategory` to `frontend/src/types/index.ts`.
- Add the `live` group to `frontend/src/lib/endpoints.ts`.
- Add a smoke test in the existing pattern (a small `live.smoke.ts` next to
  `api.ts` or a single `useAsync` against `live.environment` in the homepage
  hero — both are sufficient).

### Phase 2 — Cinematic citizen homepage (≈5-8 hr)
- Build the page as one client component per chapter
  (`HeroChapter`, `HeroToMapChapter`, `MapToFacilitiesChapter`,
  `FacilitiesToDiscoveryChapter`, `EnvironmentChapter`, `EmergencyChapter`,
  `CivicChapter`, `FinalCtaChapter`) composed in
  `frontend/src/app/page.tsx`. One chapter per file keeps each pinned
  section's `useScroll` / `useTransform` readable.
- The page owns a single `useScroll` source, but each chapter reads its
  own `useTransform` range from a shared `ScrollContext` (a small
  context that exposes the root `scrollYProgress`). This is the standard
  scrollytelling primitive; it keeps chapters decoupled.
- Reuse `MapPanel` (no rewrite) but feed it points from
  `live.facilities` and from `organizations.search` on the same canvas,
  distinguished by a `dataSource: 'OSM' | 'DEMO'` field on the
  `MapPoint`-shaped wrapper. Extend the existing `TYPE_COLOR` map with
  pastel variants for OSM points so the visual provenance is consistent
  with the on-page banner.
- The map stays mounted across three chapters to preserve continuity
  (no tile re-fetch, no flash of unstyled map).
- Add a `.cinematic-*` set of utility classes to `globals.css` for
  typography scale (`--type-display: clamp(3rem, 8vw, 7rem)`),
  `position: sticky; height: 100vh` chapter pattern, ambient gradient
  keyframes, and a `prefers-reduced-motion: reduce` short-circuit that
  flattens every chapter to a single-viewport block.
- Visual quality bar (re-read before shipping each chapter):
  1. Does scrolling produce a **visible** transformation, or only a
     decorative one? If only decorative, redesign.
  2. Are there **two states at minimum** (entering and exiting the
     chapter) that look meaningfully different? If not, the chapter is
     flat and should be merged with the next.
  3. Does the chapter **communicate its content** if motion is disabled?
     If not, add a static fallback composition.
  4. Is the chapter **pinned** in a way that gives the reader time to
     read? If a chapter is shorter than 1.5 viewports, the reader
     cannot read it; pad it with deliberate content or stretch the
     transitions.
  5. Is the chapter **continuous** with the next? No white flashes, no
     new background colour introduced without a transition.

### Phase 3 — Verify
- `cd backend && npx tsc --noEmit`
- `cd frontend && npm run lint && npm run build`
- Manual: scroll the homepage at desktop (1280×800) and mobile (390×844).
- Manual: toggle `prefers-reduced-motion` in DevTools and re-scroll.
- Manual: `curl` `/api/v1/live/environment?lat=12.96&lng=77.65` and
  `/api/v1/live/facilities?lat=12.96&lng=77.65&radiusKm=5` from the
  browser network tab to confirm the wire.

---

## Tests and Acceptance Criteria

### Backend
- `cd backend && npm test` — existing suite must remain green.
- New: a minimal unit test for `OverpassService.categorize` (the only
  function in the live module with non-trivial branching). Mock the
  `fetch` global. No live network call.
- New: a unit test for `TtlCache` eviction order and the bounded-sweep
  path.
- New: a unit test for `EnvironmentService.category()` (the AQI bucket
  function) — boundary at 50/100/150/200/300.
- Manual acceptance:
  - `GET /api/v1/live/environment?lat=12.96&lng=77.65` returns 200 with a
    `weather` and an `airQuality` block (or nulls on upstream outage).
  - `GET /api/v1/live/facilities?lat=12.96&lng=77.65&radiusKm=5` returns
    `facilities[]` with `attribution: "© OpenStreetMap contributors (ODbL)"`.
  - `?radiusKm=999` returns 400 from `class-validator` (Max 25).
  - The throttle returns 429 after the 15th Overpass request inside a
    minute from the same IP.

### Frontend
- `cd frontend && npm run lint` — clean.
- `cd frontend && npm run build` — clean.
- Existing route tests / smoke (if any) stay green.
- New: a single RTL test that mounts the homepage with all `live.*` and
  `organizations.search` responses mocked, asserts the eight section
  headings appear, and confirms no `console.error` fired.
- Manual acceptance:
  - `/` is a single continuous document. Scrolling top-to-bottom on a
    fresh browser with no prior session produces a coherent narrative:
    hero, map emerging, facilities appearing, demo discovery, environment
    numbers, emergency, civic, closing loop. No visible "section breaks"
    — every transition is a transformation.
  - At least four chapters are **pinned** (sticky inner, scrolling
    outer). The user can pause on each and the visual is stable. The
    map is mounted continuously across chapters 1–3 and never flashes
    on re-mount.
  - Large type actually changes scale/position with scroll (not just
    fades). Verify by scrubbing slowly: the hero headline moves; the
    temperature and AQI numbers move; the closing wordmark grows.
  - Facilities progressively appear (one or two per viewport-scroll) on
    the pinned facilities chapter. They do not all appear at once and
    they do not all animate identically.
  - The emergency chapter is visually distinct: a strong rose composition
    with a crossfade from the previous white-on-dark, a typed-in
    headline, and a deliberate flattening on scroll-out.
  - Toggling `prefers-reduced-motion` removes every transformation
    while keeping every chapter visible and readable in a single
    flat-scrolling stack. No content is hidden.
  - The "OpenStreetMap" attribution is visible without scroll-jacking
    (per ODbL).
  - The `DemoBanner` is visible on the Healthcare Discovery chapter.
  - The location chapter has a "Use my location" button (gesture-gated
    geolocation) and a "Use the demo city centre" fallback.
  - Authenticated user lands on `/` and sees an "Open dashboard" affordance
    that routes to `/dashboard` without losing scroll position.
  - Mobile (390 × 844): the experience is intentionally designed, not
    a shrunken desktop. The scroll rail collapses to a top-edge bar.
    Pinned chapters still pin; large type clamps down with the
    `clamp()` scale.
  - **Visual language matches the Jitter-inspired tokens**: white
    background (`--j-bg`), `--j-text` (#19171c) text, `--j-primary`
    (#01b2fd) CTAs, `--j-secondary` (#a981ff) secondary accents, large
    display headlines weight 800 in Inter Display, cards at
    `--j-radius-card` (50 px) with the tinted Jitter shadow. The dark
    `(app)` shell is unchanged — `/` is light, `/(app)/*` is dark.
  - The transition between the light `/` and the dark `(app)` does not
    flash. The `(app)/layout.tsx` body is wrapped so the existing
    `body.bg-mesh` background applies only to the `(app)` subtree.
  - The "Open dashboard" affordance routes to `/dashboard` without
    scroll loss. Once inside `(app)`, the dark theme takes over and
    the home is one click away in the NavBar.
  - No 4xx/5xx in the network panel on a clean load from a guest.
  - `motion` and `@fontsource-variable/inter` are the only new frontend
    dependencies; package.json diff shows only those two and their
    transitive lockfile entries.

---

## Open Decisions / Risks

| # | Risk / open question | Decision in this plan | If user disagrees, ask in next turn |
|---|---|---|---|
| 1 | Should the homepage replace `/dashboard` for citizens? | No. `/dashboard` stays; `/` becomes the public citizen experience. The dashboard is still the post-login landing for every role. | Ask whether signed-in citizens should bypass `/` and go straight to `/dashboard`. |
| 2 | Should the cinematic page be auth-gated? | No. It is public. Auth is only needed for ambulance requests, complaints, and provider/admin consoles, all of which already redirect. | None — the live data the page consumes is `@Public()` by design. |
| 3 | How prominent should the demo-vs-real label be? | A persistent thin banner above the demo-orgs section, modelled on the existing `DemoBanner`. Each live section carries a one-line "Source: OpenStreetMap / Open-Meteo" sub-label. | Ask whether to also add a per-number provenance stamp on cards. |
| 4 | `motion@13.2.0` is the version installed by the uncommitted change. Is that the right one? | Use it. It exports `useScroll`/`useTransform`/`useSpring`/`whileInView`/`useReducedMotion` from `motion/react`. No need to bump. | If the user wants a specific version, ask before install. |
| 5 | Should I keep the existing redirect at `/` for the next 24h behind a feature flag? | No. The new page is a strict superset of what `/` currently does (visitors get a real page instead of a redirect to `/login`). No flag needed. | None. |
| 6 | The user mentioned `/anthropic-skills:token-optimization`. That skill is not present in the local skill registry. | Operate as if the equivalent guidance were the rule: read only what is needed, prefer diffs over full reads, batch related changes, run lint/build only at the end of a phase. | If the user can point to the actual skill location, switch. |
| 7 | Graphify output exists (`graph.json`, ~811 nodes / 1469 links around `c6d86f0`) but the Graphify skill is not registered. | Do not attempt to re-invoke it. Use it as static context if needed, otherwise rely on the file tree (which I already mapped). | If the user wants Graphify re-run, schedule that as a separate task. |
| 8 | `tsconfig.build.tsbuildinfo` is modified in the working tree. | Leave it tracked. The build will regenerate it. | If the user prefers `.gitignore`, change in a one-liner. |
| 9 | Should emergency CTA buttons deep-link with `?next=` to preserve intent after sign-in? | Yes. Use the existing pattern from `api.ts` (which already appends `?expired=1` on refresh failure). Extend `RequireAuth` to honour `?next=` if not already done. | If the existing `RequireAuth` already handles this, no change. |
| 10 | Should the live module appear in the public Swagger? | Yes, the controller already has `@ApiTags('Live Data')` and per-route `@ApiOperation`. Verify it is reachable when `SwaggerModule` is set up in `main.ts` (it should be). | None. |
| 11 | TWK Lausanne is the Jitter display font. It is a paid Klim face. | Use Inter Display (free, already shipped) as the display face. Inter is already loaded by the app; we add `@fontsource-variable/inter` so we can use weight 800 cleanly. The body font is Inter. | If the user wants the exact Klim font, ask for a license and pause until it arrives. |
| 12 | The user shared **two** design references (Jitter light, Crèche Tank dark) and said "mixture of these". The existing app is dark. | Primary visual language: Jitter light (clean, rounded, cyan + purple, bold display type, 8 px grid, 40–50 px radii). The Crèche Tank dark teal/rose accent influences the emergency chapter colour (`--j-accent-rose`) and the cinematic mood. The existing dark `(app)` shell stays unchanged — presentation on `/`, work in `/(app)/*`. | If the user wants the **entire app** to switch to the Jitter light theme, treat that as a follow-on design system migration outside this plan's scope. |
| 13 | Copying the plan file to the project root. | After exiting Plan Mode, write a copy of `plan.md` to the repo root (`C:\Users\saxen\OneDrive\Documents\AntiGravity work\CivicConnect\plan.md`) so it is visible alongside `AGENTS.md`, `README.md`, and `PROJECT_STATUS.md`. Keep the canonical version at the artifacts path; the root copy is a convenience. | None. |

---

## What I will do after `ExitPlanMode`

1. **Copy this plan to the repo root** as `plan.md` (alongside
   `AGENTS.md`, `README.md`, `PROJECT_STATUS.md`) so the design
   specification is visible to anyone opening the project. The canonical
   plan stays at the artifacts path; the root copy is a convenience.
2. Commit the uncommitted `live` module + `motion` install as one or two
   small commits.
3. Add `frontend/src/types/index.ts` additions and the `live` group in
   `endpoints.ts`.
4. Add the Jitter-inspired `--j-*` token block to `globals.css` and the
   `@fontsource-variable/inter` (or equivalent) install. Scope the
   existing dark `body.bg-mesh` to the `(app)` shell so the homepage's
   white background does not inherit a dark mesh.
5. Build the cinematic citizen homepage chapter by chapter, in this
   order, and **stop after each one to verify the quality-bar checks**
   in Phase 2 step 5:
   - Hero enter
   - Hero → Map (the map emerges from the hero, light carto tiles)
   - Map → Facilities (facilities progressively appear on a pinned list,
     Jitter card style)
   - Facilities → Healthcare discovery (demo grid overlaps the map, with
     the small `DemoBanner` chip)
   - Environment (oversized temperature and AQI numbers transform)
   - Emergency (strong crossfade, typed-in headline, deliberate flatten
     on scroll-out)
   - Civic services (2-up spatial composition, Jitter purple wash)
   - Final CTA (wordmark loop-back to the hero scale)
   - Scroll progress rail (fixed, right edge / top edge on mobile)
6. Add the small backend unit tests listed in the Tests section.
7. Run `tsc`, `lint`, `build` once at the end of each chapter. Manually
   scroll the page at desktop and mobile, and once with reduced motion
   on, before moving to the next chapter.
8. Update `PROJECT_STATUS.md` with the new chapters and the cinematic
   homepage in the activity log.

DONE / REMAINING / BLOCKER will be reported at each major milestone in the
format the user requested.
