# CivicConnect — Till Now

A running account of what this project is, how it was planned, what got built, and what is
still open. Written against the repository as it actually stands, not against the original
plan documents (`implementation_plan.md` and `plan.md` are both stale and contradict this file
where they disagree — trust this one).

---

## 1. The idea

Public health infrastructure in India is discoverable in principle and undiscoverable in
practice. A hospital has beds; a blood bank has O-negative units; a government pharmacy has a
particular medicine in stock. All three facts exist somewhere, and none of them are reachable
by a person standing on a street at 2 a.m. who needs them. The usual fallback is a phone tree:
call, be told no, call the next one.

CivicConnect is a single civic platform that answers proximity-and-availability questions
directly: *what is near me, and does it have what I need right now?* It spans healthcare
discovery (hospitals, blood banks, pharmacies), emergency dispatch (ambulance requests),
civic grievances (complaints with a routing lifecycle), welfare access (government schemes),
and public safety (emergency alerts) — with a role system that lets the facilities themselves
publish their availability rather than having a central operator guess it.

### The constraint that shaped the whole design

A student project cannot obtain real bed counts. It also should not invent them and present
them as real — a person acting on a fabricated bed count is worse off than a person with no
information. So the architecture makes provenance a first-class, structural property rather
than a disclaimer:

- **Real facilities** come from OpenStreetMap via Overpass. They genuinely exist. Their schema
  carries **no availability fields at all** — there is no bed/stock/unit key to populate, so
  no code path can attach an invented figure to a real place.
- **Simulated facilities** are seeded `Organization` rows flagged `DataSource.SIMULATED`.
  They are fictional by construction, and they are the only records that carry availability
  numbers.

The invariant: *a real facility can never be shown carrying a simulated availability figure.*
It is enforced at the API boundary (two separate module trees, two separate response shapes),
surfaced in the UI by a shared `<ProvenanceLabel>`, and asserted by the smoke suite. This is
the one genuinely novel thing in the project, and it also happens to be the thing that makes
the demo honest.

---

## 2. The planning

Work was sequenced by blast radius rather than by feature appeal — security first, then
infrastructure, then correctness, then UI. The phase labels below are the ones used throughout
the commit history.

| Phase | Theme | Rationale |
|---|---|---|
| **P0** | Security: authz contract, IDOR/PII closure, validation, publish gate, error hygiene | A demo that leaks other users' data is not shippable at any level of polish. Fix before building on top. |
| **P1** | Essential infrastructure: strict TS, security headers, throttle tiers, Swagger gating | Cheap, and everything after it inherits the guarantees. |
| **P2** | Geospatial correctness: PostGIS replaces JS Haversine | The paginate-then-filter bug meant radius search returned wrong results. Correctness, not optimisation. |
| **P3** | Frontend vertical slices | Ten end-to-end flows, each demonstrable against the seeded database. |

Fixed decisions, not revisited: Docker Compose for Postgres+PostGIS+Redis, Prisma as the ORM,
NestJS as a modular monolith (not microservices — a four-person student team does not need a
service mesh), Next.js App Router. No new dependencies without an explicit reason.

---

## 3. Tech stack

**Backend** — NestJS 12, TypeScript strict, Prisma 6.19.3, PostgreSQL 16 + PostGIS 3.4,
Redis 7, Passport JWT with refresh-token rotation, class-validator/class-transformer,
`@nestjs/throttler`, Swagger (gated off in production), Vitest.

**Frontend** — Next.js 16 (App Router), React 19, Zustand 5, Tailwind CSS 4,
Leaflet / react-leaflet, `motion/react`, Axios, Lucide icons.

**External services** — Open-Meteo (weather + US EPA AQI), Overpass/OpenStreetMap (real
facility locations, ODbL-attributed), Nominatim (reverse geocoding), Google Gemini (optional;
the AI assistant falls back to a deterministic offline advisory when no key is configured).

**Infrastructure** — Docker Compose, `postgis/postgis:16-3.4`, `redis:7-alpine`.

---

## 4. How it is built

### Four tiers

```
CLIENT    Citizen web client · Provider console · Authority & Admin views
             ↓ HTTPS / JSON
EDGE      NestJS API gateway (/api/v1)
             global JWT guard (deny by default) · RBAC roles guard
             ValidationPipe (whitelist + forbidNonWhitelisted)
             rate-limit tiers · response envelope · exception filter w/ correlation IDs
             ↓
DOMAIN    12 feature modules + shared common/ layer
             ↓ Prisma
DATA      PostgreSQL 16 + PostGIS 3.4  ·  Redis 7
             ↓ (Live module only)
EXTERNAL  Open-Meteo · Overpass/OSM · Nominatim · Gemini
```

### Modules

`auth`, `organization`, `hospital`, `blood-bank`, `pharmacy`, `ambulance`, `complaint`,
`scheme`, `alert`, `ai-chat`, `admin`, `live`.

`live` is the only module that crosses the trust boundary to third parties, and the only one
with no database tables — its results are TTL-cached in memory and never persisted. That
isolation is what keeps the provenance invariant structural instead of aspirational.

### Shared `common/` layer

`authorization/assert-org-access.ts` (single ownership-check helper used by every write),
`decorators/` (`@CurrentUser`, `@Public`, `@Roles`, `@ToBoolean`), `dto/pagination`,
`filters/http-exception` (correlation IDs, Prisma error-code mapping, generic messages for
unexpected exceptions), `geo/geo-search.ts` (+ spec), `guards/` (jwt-auth, roles),
`interceptors/transform` (response envelope).

### Data model

14 Prisma models — `User`, `RefreshToken`, `Organization`, `HospitalDetail`,
`BloodBankInventory`, `PharmacyMedicine`, `AmbulanceDetail`, `AmbulanceRequest`,
`GovernmentScheme`, `Complaint`, `EmergencyAlert`, `AIChatHistory`, `Notification`,
`AuditLog` — and 9 enums (`Role`, `OrgType`, `VerificationStatus`, `DataSource`, `BloodType`,
`AmbulanceStatus`, `AmbulanceRequestStatus`, `ComplaintStatus`, `AlertSeverity`).

One migration: `20260902120939_init_postgis_provenance`. `Organization` carries a **generated
geography column** derived from lat/lng with a **GiST index**, so proximity search is a single
`ST_DWithin` filter ordered by `ST_Distance` — the radius filter runs before `LIMIT/OFFSET`,
which is precisely the bug the old JS Haversine implementation had.

### Frontend

20 routes under the App Router: `/` (cinematic homepage), `/login`, `/register`, `/dashboard`,
`/discover`, `/hospitals`, `/blood-banks`, `/pharmacies`, `/ambulance`, `/complaints`,
`/schemes`, `/provider`, `/admin` — all with detail `[id]` pages where applicable.

The homepage is a scroll-driven "chapter" sequence in `src/components/chapters/` — sticky-pinned
sections that release their pins entirely under `prefers-reduced-motion`. Live and simulated
data appear on the same screen in places, so every data-bearing chapter renders a
`<ProvenanceLabel>`.

---

## 5. What has been done

**Security (P0) — complete.**
Typed `AuthenticatedUser` contract with `isActive`/`isVerified`; `assertOrgAccess()` as the one
ownership gate; IDOR closure across complaints, ambulance requests and schemes (ambulance
`getRequests` previously returned every request platform-wide, with citizen phone and email);
citizen contact details withheld until a request is `ACCEPTED` or later; an ambulance
status-transition table so a completed run cannot be reopened; `PartialType()` replacing
`Partial<Dto>` (which emits `Object` design-type metadata and was silently skipping validation
on those bodies entirely); `forbidNonWhitelisted: true`; a publish gate so a self-registered
`PENDING` organisation cannot appear in emergency search results with numbers it made up;
exception filter with correlation IDs, Prisma code mapping and no message leakage; fail-fast
database connect.

**Infrastructure (P1) — complete.**
Strict TypeScript restored, test-globals errors fixed, per-route throttle tiers, Swagger gated
behind `NODE_ENV !== 'production'`, security headers set explicitly in `main.ts`, Tailwind 4
and Turbopack root configured. Lint and type warnings clean across both workspaces.

**Geospatial (P2) — complete.**
`common/geo/geo-search.ts` is the single `$queryRaw` helper: `ST_DWithin` for the radius,
`ST_Distance` for ordering and the returned `distanceKm`, `COUNT(*)` over the filtered set,
`LIMIT/OFFSET` after the spatial filter, deterministic `ORDER BY distance, id`. All five copies
of `calculateHaversineDistance` deleted. Verified against the seed: 2 km → 1 result,
5 km → 3, 15 km → 8, self-match 0.00 km.

**Frontend (P3) — complete for the MVP.**
All ten flows walk end to end against the seeded database. Features include a cinematic homepage with chapter components, facility finders with interactive maps, and role-based dashboards. Mock auth removed
(`DEMO_CREDENTIALS`, `mock_demo_jwt_token_2026`), `checkAuth` clears state on failure, the
Axios refresh interceptor retries through the `api` instance and persists the rotated token.
Demo credentials moved off the login and register pages into a bottom-left toggle, so the
forms are clean.

**Live data module — complete.**
Weather + AQI, real facility lookup, reverse geocoding, all TTL-cached, none of it persisted,
all of it attributed.

**Verification.** Vitest: 2 files, 5 tests, passing. Smoke suite (`backend/scripts/smoke.mjs`,
checked in): 53 assertions covering register → login → refresh → logout, `/auth/me`,
geospatial radius tiers, the publish gate, an authz-denied call that must 403/404, and the
provenance invariant. `prisma migrate diff` reports no drift.

**Seed.** 8 accounts across the role matrix and 8 organisations (3 hospital, 2 blood bank,
1 pharmacy, 1 ambulance provider, 1 NGO), every one `DataSource.SIMULATED` and fictional by
name. No real institution appears anywhere in it.

---

## 6. What is remaining

Nothing blocks the demo. These are the honest gaps.

**Known defect, in the hand-edited homepage — RESOLVED.** `frontend/src/app/page.tsx` previously had three
provenance problems: it rendered hardcoded `28` and `42` under a "Live environment" heading
captioned as live public data; it labeled `/organizations` database rows as
"Data layer: OpenStreetMap"; and `{ ...demoFacilities[i % demoFacilities.length] }` kept the
demo `kind`/`tone`/`icon` while overwriting only `name`, so a real seeded pharmacy could render
with a hospital icon and a "Hospital" caption. These issues have been fixed: the live environment
now displays actual weather/AQI data from Open-Meteo with proper loading states, the data layer
labeling dynamically reflects the actual data source (OSM, seed, or demo), and facility cards now
show correct icons, kinds, and tones based on the organization's actual type rather than demo
templates. The homepage now fully respects the provenance invariant enforced throughout the system.

**Deferred by choice, not oversight.**
- `helmet` is not installed; `main.ts` sets the header subset by hand instead, with a comment
  saying so. Fine for a demo, worth swapping for the real thing before any public deployment.
- Throttler storage is in-memory. `ioredis` is installed and Redis is provisioned, so moving
  to a shared store is a small change — but with a single API instance there is nothing to
  share yet.
- Test coverage is thin: 5 unit tests plus the smoke suite. The smoke suite is doing most of
  the real verification work.
- Notifications and `AuditLog` have models and are written to, but no user-facing surface.

**Stale documentation.** `implementation_plan.md` (2056 lines) still claims no implementation
has started. `plan.md` and `docs/ARCHITECTURE.md` predate the provenance split. `README.md`
says Next.js 14+ where the project is on 16. `PROJECT_STATUS.md` has been brought up to date.

**Not started.** Deployment (no hosting target chosen), CI, real-time push for alerts and
ambulance status (both currently poll), and any form of accessibility audit beyond the
reduced-motion handling and semantic markup already in place.