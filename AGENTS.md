# CivicConnect — AI Agent Instructions & System Rules

## Project Overview
CivicConnect is a production-grade Civic Health & Emergency Assistance Platform built with **NestJS (Backend) + Next.js (Frontend) + PostgreSQL/PostGIS (Database) + Redis (Cache/Throttler)**.

## Architectural Commandments
1. **Modular Monolith Backend:**
   - Every domain entity lives in `backend/src/modules/{entity}/`.
   - Each module contains: `{entity}.module.ts`, `{entity}.controller.ts`, `{entity}.service.ts`, and a `dto/` directory.
   - Global filters, guards, decorators, and interceptors live in `backend/src/common/`.
2. **Unified API Standards:**
   - Base prefix: `/api/v1`
   - Response envelope: `{ success: true, data: T, message?: string, meta?: PaginationMeta }`
   - Standard error response: `{ success: false, error: { code: string, message: string, details?: any }, statusCode: number }`
3. **Database & Migrations:**
   - Use **Prisma ORM** (`backend/prisma/schema.prisma`).
   - Use raw SQL queries (`$queryRaw`) ONLY for PostGIS spatial queries (`ST_DWithin`, `ST_Distance`, `ST_MakePoint`).
   - All schema mutations MUST go through `npx prisma migrate dev`.
4. **Security & Authentication:**
   - Passwords hashed with `bcrypt` (12 rounds).
   - JWT tokens: Short-lived Access Token (15 min) + Refresh Token (7 days).
   - RBAC enforced via `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN, Role.HOSPITAL, ...)`.
   - Rate limiting enforced on auth, AI, and emergency endpoints.
5. **Frontend Conventions:**
   - Next.js App Router (`frontend/src/app/`).
   - Clean, rich modern design with accessible CSS variables, dark/light theme tokens, and glassmorphic micro-interactions.
   - Interactive maps built with `leaflet` + `react-leaflet` using OpenStreetMap tiles.
   - Client state: `zustand`. Server data handling: typed Axios client with interceptors.
   - Validation: `zod` for client-side forms, `class-validator` for backend DTOs.

---

## 🚫 Forbidden Patterns
- ❌ NEVER use TypeScript `any`. Always provide strong types and interfaces.
- ❌ NEVER commit `.env` or sensitive secret keys.
- ❌ NEVER bypass `JwtAuthGuard` or `RolesGuard` on private mutation endpoints.
- ❌ NEVER output raw database error stack traces to API consumers.
- ❌ NEVER write arbitrary ad-hoc inline styles when design tokens/CSS variables exist.
- ❌ NEVER build microservices or multi-repo fragmentation for this project. Keep it a clean, modular monolith.

---

## 🛠️ Verification & Testing Commands
- **Backend Test:** `cd backend && npm test`
- **Backend E2E:** `cd backend && npm run test:e2e`
- **Frontend Build/Lint:** `cd frontend && npm run lint`
- **Prisma Validation:** `cd backend && npx prisma validate`
- **Prisma Seed:** `cd backend && npx prisma db seed`

---

## 🔄 AI Agent Workflow
1. Inspect `PROJECT_STATUS.md` before making edits.
2. Ensure backward compatibility and preserve existing architecture.
3. Make incremental, high-quality, fully-typed code changes.
4. Run tests / lint checks after writing code.
5. Update `PROJECT_STATUS.md` with completed items and next steps.
