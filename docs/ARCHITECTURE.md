# CivicConnect — System Architecture Documentation

## 1. System Context & Overview
CivicConnect is architected as a high-throughput, modular monolith. It provides clean separation of domain concerns while maintaining extreme operational simplicity for single-node or containerized deployments.

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT TIER                            │
│    Next.js 14 (App Router, Server Components + CSR)         │
│    • Public Directory & Scheme Knowledge Portal (SSR/SEO)    │
│    • Interactive Proximity Maps (Leaflet + OpenStreetMap)   │
│    • Role Dashboards (Hospital, Blood Bank, Admin, etc.)   │
│    • Offline-Ready PWA Service Workers                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                      │
│    NestJS Core Pipeline                                     │
│    • Helmet Security Headers & CORS Origin Guard            │
│    • Global ValidationPipe (class-validator / DTOs)         │
│    • Global ThrottlerGuard (Rate Limiting)                  │
│    • JwtAuthGuard & RolesGuard (RBAC Matrix)                │
│    • Global HttpExceptionFilter & TransformInterceptor      │
├─────────────────────────────────────────────────────────────┤
│                      DOMAIN MODULES                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ AuthModule   │  │ UserModule   │  │OrganizationModule │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │HospitalModule│  │BloodBankMod  │  │ PharmacyModule    │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │AmbulanceMod  │  │ SchemeModule │  │ ComplaintModule   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ AlertModule  │  │ AIChatModule │  │ AdminModule       │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      DATA ACCESS LAYER                      │
│    Prisma ORM (PostgreSQL 16) + PostGIS Spatial Engine      │
│    • Spatial Indexing (GiST index on PostGIS geometry)      │
│    • Redis Cache & Token Blacklisting / Rate Limit State    │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   PostgreSQL 16 + PostGIS    │ │      Redis 7 Cluster       │
│   (Relational & Spatial)     │ │   (Cache & Rate Limiter)   │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 2. API Request Lifecycle
1. **Client Request:** Dispatched with `Authorization: Bearer <token>` and standardized payload.
2. **Network & Security:** Throttler checks request frequency per IP/User; Helmet enforces security headers.
3. **Authentication:** `JwtAuthGuard` extracts and verifies signature; attaches user payload to `req.user`.
4. **Authorization:** `RolesGuard` verifies user role against `@Roles(...)` metadata.
5. **Validation:** `ValidationPipe` transforms and validates payload against DTO decorators.
6. **Business Logic:** Controller routes to Service; Service executes domain logic and persistence.
7. **Geospatial Engine:** For proximity searches, queries execute `ST_DWithin(geom, ST_MakePoint(lng, lat)::geography, radius_meters)` using GiST spatial indexes.
8. **Transformation:** `TransformInterceptor` packages the result in `{ success: true, data: ..., meta: ... }`.
9. **Error Handling:** Any uncaught exceptions are trapped by `HttpExceptionFilter`, formatted consistently without leaking server internals.

---

## 3. Geospatial Architecture (PostGIS)
- All registered organizations store coordinates as `latitude`, `longitude` (Decimal), and an automated spatial point `geom geometry(Point, 4326)`.
- Proximity queries execute at native C-extension speeds in PostgreSQL using spatial index trees (`GIST`).
- Distance calculations return precise kilometer metrics dynamically to the client.
