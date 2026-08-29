# CivicConnect — Product Requirements Document (PRD)

## 1. Executive Summary
CivicConnect is an integrated civic health, crisis coordination, and emergency assistance platform. It establishes a trusted bridge between citizens and verified healthcare entities (hospitals, blood banks, pharmacies, ambulance providers, NGOs, and municipal health authorities).

---

## 2. Core Problem Statement
Citizens encounter critical delays during acute medical emergencies and routine healthcare queries due to:
- Decentralized, unverified, and outdated bed / blood inventory data.
- Absence of real-time geospatial discovery of nearest available facilities.
- Complex or opaque government health scheme eligibility requirements.
- Lack of centralized emergency communication channels and citizen grievance reporting.

---

## 3. System Roles & RBAC Matrix
| Role | Capabilities |
|---|---|
| **CITIZEN** | Search facilities (geospatial), view live ICU/general bed counts, search blood units, find medicines, book/dispatch ambulances, submit grievance reports, interact with AI health assistant. |
| **HOSPITAL** | Update general/ICU bed occupancy, emergency room status, specialties, doctors on duty, respond to incoming triage inquiries. |
| **BLOOD_BANK** | Maintain live inventory counts for A+, A-, B+, B-, AB+, AB-, O+, O- blood units; log donation camps. |
| **PHARMACY** | Manage medicine inventories, pricing, bulk CSV stock upload, location & operating hours. |
| **AMBULANCE** | Fleet status updates (Available, Busy, Offline), accept emergency requests, update dispatch status. |
| **NGO** | Coordinate volunteer campaigns, blood donation drives, public relief distributions. |
| **AUTHORITY** | Broadcast emergency alerts (epidemic, weather, disaster), review citizen complaints, inspect compliance. |
| **ADMIN** | Platform governance, KYC/license verification of organizations, audit trail oversight, system metrics. |

---

## 4. Key Functional Requirements (FR)
- **FR-001 (Auth & RBAC):** Secure registration/login with JWT access (15m) and refresh (7d) tokens, password hashing with bcrypt, role-based guard enforcement.
- **FR-002 (Geospatial Facility Discovery):** PostGIS-powered proximity search (`ST_DWithin`, `ST_Distance`) returning sorted facilities within specified radius (km).
- **FR-003 (Hospital Capacity Management):** Live updates for ICU, general beds, ventilator support, oxygen supply status, and timestamp-based staleness flags (>24h).
- **FR-004 (Blood Bank Inventory):** Unit availability per blood group with emergency low-stock threshold alerts.
- **FR-005 (Medicine & Pharmacy Finder):** Search by generic and brand names, checking stock across nearby verified pharmacies.
- **FR-006 (Ambulance Dispatch Request):** Citizen emergency request pipeline with status tracking (REQUESTED, ACCEPTED, EN_ROUTE, COMPLETED, CANCELLED).
- **FR-007 (Government Health Schemes):** Directory of public schemes with searchable benefits, eligibility criteria, and direct application links.
- **FR-008 (Citizen Grievance / Complaints):** Structured reporting with category, facility tag, optional attachment URL, and resolution lifecycle (PENDING, UNDER_REVIEW, RESOLVED, REJECTED).
- **FR-009 (AI Health Assistant):** Informational advisory chatbot with safety disclaimers, triage classification, and localized emergency contacts.
- **FR-010 (Emergency Alerts):** Authority-broadcast high-priority announcements displayed prominently on citizen dashboards.
- **FR-011 (Admin Verification Workflow):** Organization onboarding state machine (PENDING, APPROVED, REJECTED, SUSPENDED) with license validation.
- **FR-012 (Audit Logging):** Immutable logging of all sensitive state transitions and administrative actions.

---

## 5. Non-Functional Requirements (NFR)
- **NFR-001 (Performance):** p95 API latency < 250ms; Map proximity query execution < 80ms.
- **NFR-002 (Security):** Strict OWASP Top 10 mitigation, Helmet HTTP security headers, CORS origin whitelist, parameterized SQL/ORM, rate limiting.
- **NFR-003 (Reliability):** Comprehensive error envelope with machine-readable error codes; automatic database reconnection.
- **NFR-004 (Accessibility):** Mobile-first responsive UI, WCAG AA color contrast compliance, keyboard-navigable interface.
