# CivicConnect — Civic Health & Emergency Assistance Platform

> **Production-oriented Full-Stack Civic Health Ecosystem**  
> Connecting citizens with verified hospitals, blood banks, pharmacies, ambulances, NGOs, and government health services with location intelligence and AI assistance.

---

## 🏛️ Architecture Overview

- **Frontend:** Next.js 14+ (App Router, TypeScript, React-Leaflet, Zustand, Recharts, CSS Variables & Glassmorphism Design System)
- **Backend:** NestJS (Modular Architecture, TypeScript, REST API, Swagger/OpenAPI, Passport JWT, Throttler, Interceptors)
- **Database:** PostgreSQL 16 + PostGIS extension for spatial queries (radius search, distance calculations)
- **ORM:** Prisma Client with raw SQL bindings for geospatial operators (`ST_DWithin`, `ST_Distance`)
- **Cache & Rate-Limiting:** Redis / IORedis
- **Auth:** JWT access tokens (15m) + refresh tokens (7d) + Role-Based Access Control (RBAC with 8 roles)
- **AI Engine:** Google Gemini / OpenAI integration for health informational assistant
- **Maps:** Leaflet & OpenStreetMap tiles (no costly vendor lock-in)

---

## 📁 Repository Structure

```
CivicConnect/
├── backend/                  # NestJS API Application
│   ├── src/
│   │   ├── common/           # Decorators, Guards, Interceptors, Filters, DTOs
│   │   ├── config/           # App configuration & validation
│   │   └── modules/          # Auth, Users, Organizations, Hospitals, Blood Banks, etc.
│   ├── prisma/               # Schema, Migrations, Seed script
│   └── test/                 # Unit & E2E tests
├── frontend/                 # Next.js Application
│   ├── src/
│   │   ├── app/              # App Router routes & pages
│   │   ├── components/       # UI tokens, Map components, Dashboards
│   │   ├── lib/              # API client, Auth state, Utilities
│   │   └── store/            # Zustand state stores
│   └── public/               # Static assets & icons
├── docs/                     # Full Architectural & API documentation
├── docker-compose.yml        # Local PostgreSQL + PostGIS & Redis services
├── AGENTS.md                 # Guidelines for AI Coding Agents
└── PROJECT_STATUS.md         # Active development milestones & roadmap
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20.x or v24.x
- **PostgreSQL**: PostgreSQL 16 with PostGIS extension (or use Supabase/Neon/Docker)
- **Redis**: Redis 7.x (or Upstash Redis / In-memory fallback)

### 2. Environment Setup
```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env.local
```

### 3. Database Migration & Seeding
```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

### 4. Running Locally
```bash
# Start Backend (Port 4000)
cd backend
npm run start:dev

# Start Frontend (Port 3000)
cd ../frontend
npm run dev
```

- **Frontend App:** http://localhost:3000
- **API Swagger Documentation:** http://localhost:4000/api/docs
- **API Health Check:** http://localhost:4000/api/v1/health

---

## 👥 System Roles (RBAC)

1. `CITIZEN` — Search facilities, request emergency help, check blood availability, ask AI assistant, file complaints
2. `HOSPITAL` — Manage hospital profile, real-time ICU/general bed counts, emergency status, departments
3. `BLOOD_BANK` — Manage blood inventory across all 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-)
4. `PHARMACY` — Manage medicine stocks, pricing, CSV bulk catalog upload
5. `AMBULANCE` — Fleet management, availability toggles, dispatch request status updates
6. `NGO` — Public health campaigns and volunteer coordination
7. `AUTHORITY` — Broadcast health alerts, review citizen complaints, view district analytics, publish schemes
8. `ADMIN` — Organization verification workflow, user moderation, audit logs, system-wide analytics

---

## 🛡️ License
Academic Engineering Project — Built for high-reliability civic impact.
