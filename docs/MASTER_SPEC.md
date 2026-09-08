# HerdIQ — Master Specification

> **Product name:** HerdIQ — AI-powered operating system for modern dairy farms.
> **Current codebase brand:** DairyMonitor ONLINE (`dairymonitor.online`).
> **Status:** Master specification (living document). Version 1.0.
> **Date:** 2026-09-07

This is the single source of truth for building HerdIQ. It defines every phase, every
deliverable, the acceptance criteria, and the ordering rule: **a phase must not start
until the previous phase passes all its tests.**

---

## 1. Vision & Product Definition

HerdIQ is an AI-powered operating system for modern dairy farms. It replaces
paper-ledger and spreadsheet-based herd management with a role-aware, multi-tenant,
offline-capable web + mobile platform that runs the entire dairy workflow end to end:

- **Know every animal** — full herd register, history, health, breeding.
- **Make every litre count** — milk recording, quality, buyers, revenue.
- **Stay ahead of care** — vaccinations, treatments, due tasks, AI reminders.
- **Understand your feed** — inventory, purchasing, feed efficiency.
- **See the financial picture** — revenue, costs, profit per litre, payroll.
- **Turn records into insight** — reports, KPIs, benchmarks, and the Farm Copilot.

### Competitive framing (benchmarked against DairyManager.net / Kingshay)

DairyManager.net is a UK-centred **dairy costings and benchmarking** SaaS:
monthly feed-efficiency, health/fertility, antimicrobial usage and cost-of-production
reports; tiered packages (Starter/Regular/Premium/Premium Plus); 2-month free trial;
2500+ herds; offline *costings* (not live herd CRUD) data entry; veteran support team.

HerdIQ's differentiation for the Pakistan/South-Asia market:

| Dimension | DairyManager.net | HerdIQ (target) |
|-----------|------------------|-----------------|
| Language | English (UK) | Bilingual English + Urdu, RTL support |
| Currency | GBP | PKR (default) + USD/GBP/EUR/AED/SAR |
| Species | Cattle | Cattle + buffalo (+ goats/sheep planned) |
| Data entry | Monthly costings ledger | Live per-animal operational CRUD |
| Mobility | Limited | PWA + full offline sync |
| Intelligence | Quarterly consultant reports | Real-time Farm Copilot + AI insights |
| Cost model | £24–£54/mo bundled tiers | Subscription SaaS, per-farm/device licensing |

HerdIQ wins on: bilingual depth, live operational workflow (not just global costings),
buffalo support, offline-first mobile, and always-on AI copilot.

---

## 2. Architecture (overarching)

### 2.1 Components

```
Browser / PWA (Next.js 16, React 19, App Router)
        │  same-origin fetch via /api proxy (next.config rewrites)
        ▼
Express 5 API (server/)  — owns ALL auth, validation (zod), permissions, DB
        │  pg.Pool; parameterized SQL; advisory-lock migrations
        ▼
PostgreSQL 17
        ├─ multi-tenancy: farms = tenant boundary, farm_members RBAC
        ├─ operational modules (backend/shared/modules.ts → generated SQL)
        ├─ audit_logs, optimistic-locking version columns
        └─ (planned) stock_movements, invoices, ledger, notifications, etc.
```

- **Frontend:** Next.js renders UI only. No DB access. Talks to the Express API
  through the same-origin `/api/:path*` rewrite.
- **Backend:** Express owns request validation, authorization, business rules and
  all SQL. Single REST API surface for both the web app and the PWA/mobile client.
- **Database:** PostgreSQL is authoritative. Schema generated from a single
  TypeScript source of truth (`backend/shared/modules.ts`) via `backend/scripts/generate-schema.ts`.
- **Auth:** DB-backed opaque HttpOnly cookie sessions (SHA-256-hashed tokens), not JWTs.
- **Tenant:** `farms` is the tenant. Every query is farm-scoped with membership
  verification (application-level isolation; RLS added in production hardening).

### 2.2 Core security decisions (Phase 1 baseline)

- Server-side zod validation on **every** endpoint (no trusting client input).
- bcrypt (cost 12) password hashing; 6–72 char / ≤72-byte password policy.
- Random 32-byte session tokens, stored hashed, 7-day expiry, HttpOnly Secure cookie.
- Origin-header enforcement on all mutating requests (CSRF defense-in-depth).
- Rate limiting on auth endpoints (30 req / 15 min).
- CSV-injection-safe export, parameterized SQL, no raw string interpolation into SQL.
- 404 (not 403) on unauthorized cross-tenant access to prevent enumeration.
- Optimistic locking (`version`) to reject lost updates.
- Omnipresent audit logging of create/update/export with old/new values.

---

## 3. Deliverables checklist (the full production-ready list)

The final system must deliver **all** of the following. Status reflects the current
codebase (2026-09-07).

| # | Deliverable | Status | Phase |
|---|-------------|--------|-------|
| 1 | Complete source code | ✅ implemented (foundation + modules) | all |
| 2 | Database schema | ✅ generated from shared modules | 1 |
| 3 | Prisma migrations | ⚠️ **N/A — using pg + generated SQL** (see note) | 1 |
| 4 | Seed / demo data | ⏳ planned | 9/final |
| 5 | REST APIs | ✅ foundation + 12 modules | all |
| 6 | OpenAPI documentation | ⏳ planned | 11 |
| 7 | Frontend | ✅ foundation + module UI | all |
| 8 | Backend | ✅ foundation + operations router | all |
| 9 | Authentication | ✅ custom cookie sessions | 1 |
| 10 | RBAC | ⚠️ OWNER/VIEWER only; granular per-module roles planned | 1→6 |
| 11 | Multi-tenancy | ✅ farm-as-tenant, membership isolation | 1 |
| 12 | PWA | ⏳ planned | 8 |
| 13 | Offline synchronization | ⏳ planned | 8 |
| 14 | AI assistant (Farm Copilot) | ⏳ planned (UI stub only) | 9 |
| 15 | AI insights | ⏳ planned | 9 |
| 16 | Notification system | ⏳ planned | 5+/9 |
| 17 | PDF reports | ⏳ planned | 7 |
| 18 | Excel import/export | ⏳ CSV export done; XLSX planned | 7 |
| 19 | Subscription architecture | ⏳ planned | 10 |
| 20 | Admin panel | ⏳ planned | 10 |
| 21 | Automated tests | ✅ unit + E2E (foundation) | all |
| 22 | Docker configuration | ✅ docker-compose (Postgres); full stack later | 11 |
| 23 | Environment configuration | ✅ .env + .env.example | 1 |
| 24 | Production deployment docs | ⏳ planned | 11 |
| 25 | Database backup documentation | ⏳ planned | 11 |
| 26 | Security documentation | ⏳ planned | 11 |
| 27 | API documentation | ⏳ planned | 11 |

> **Prisma note:** The decision is to keep the current `pg` driver + generated-SQL
> migration system (single source of truth `backend/shared/modules.ts`) rather than adopt
> Prisma. All "migrations" remain explicit `.sql` files under `backend/database/`, applied by
> `backend/src/migrate.ts` with advisory locking. This preserves the verified testable
> foundation and avoids a disruptive rewrite.

---

## 4. Phases

### Phase 1 — Architecture + authentication + multi-tenancy
*Goal: a secure, verified foundation that every later phase builds on.*

**Scope:**
- Next.js/Express/Postgres architecture boundaries locked.
- Custom cookie-session auth: register, login, me, logout, session revocation.
- Multi-tenancy: `farms` tenant, `farm_members` OWNER/VIEWER, isolation, audit log.
- Origin/CSRF enforcement, rate limiting, bcrypt hashing, security headers (helmet).
- Farm onboarding + dashboard shell; farm switcher; bilingual UI foundation.
- Migration runner with advisory locks + schema_migrations tracking.

**Acceptance / tests:**
- [ ] Unit tests (validation) pass.
- [ ] API integration (`backend/scripts/verify-api.ts`) passes: register, login, logout,
      session revocation, farm creation, tenant isolation, origin enforcement,
      validation, audit logging, OWNER membership.
- [ ] E2E (Playwright): public site + RTL toggle; full register → farm → isolate →
      logout → login flow.
- [ ] Typecheck + lint clean.
- [ ] No cross-tenant data leak verified.
- [ ] Docs: architecture + this master spec.

**Entry to Phase 2 requires:** all Phase 1 tests green.

---

### Phase 2 — Animals + herd
**Scope:** Complete the animal/herd module: full register, per-animal history,
health/weight/breeding timeline, QR tag support, purchase/date lineage, search,
filtering, pagination, bulk import.

**Key deliverables:** animals CRUD hardened; `AnimalHistory` timeline; herd summary
on Overview; tag/QR uniqueness; search/filters; XLSX import of a herd roster.

**Tests:** relation validation (no future purchase date, purchase-after-birth,
animal-in-farm), history correctness, ownership enforcement, seeding helpers.

---

### Phase 3 — Milk
**Scope:** Milk recording (per session), production totals, quality (fat/SNF),
destination tracking (Tank/Calves/Discarded/Farm use), milk-withdrawal enforcement
from health records, daily/monthly totals, trends.

**Key deliverables:** milk CRUD; production summary + trend charts; withdrawal-aware
destination; per-animal + whole-farm totals; revenue-at-buyer-linkage (feeds Phase 6).

**Tests:** session/date uniqueness, 0–200 quantity bounds, withdrawal blocking,
totals math, trend accuracy.

---

### Phase 4 — Health + breeding
**Scope:** Health events (symptoms, diagnosis, vet, meds, costs), vaccinations with
`next_due`, treatments with withdrawal windows, breeding events (heat,
insemination, pregnancy check, dry-off, calving), expected calving, calf tagging.

**Key deliverables:** health/vaccination/breeding CRUD; due-vaccination + follow-up
reminders; withdrawal enforcement feeding milk module; breeding calendar; pregnancy
forecast.

**Tests:** date ordering rules (follow-up ≥ event), withdrawal window blocking,
due-date computation, cross-module FK integrity.

---

### Phase 5 — Feed + inventory
**Scope:** Inventory (feed/medicine/vaccine/equipment/supplies), `stock_movements`
transaction ledger, weighted-average costing, minimum-stock reorder alerts,
supplier linkage, feed-efficiency feed-in to reports.

**Key deliverables:** inventory CRUD; immutable + reversing stock movements;
weighted-average cost; reorder notifications; supplier purchases.

**Tests:** stock never goes negative, unit immutability guard, weighted-average math,
reversal correctness, minimum-stock alert triggers.

---

### Phase 6 — Finance
**Scope:** Buyers, suppliers, staff, partners, invoices, partial payments, ledger,
payroll, distributions, profit-per-litre. Financial transactions immutable
(reversing entries); NUMERIC decimal-safe arithmetic.

**Key deliverables:** buyers/suppliers/staff/partners CRUD; invoicing + payment
splits; farm ledger; payroll; profit/loss rollups feeding reports.

**Tests:** ledger correctness, immutability + reversal, partial-payment math,
payroll accuracy, audit integrity.

---

### Phase 7 — Reports
**Scope:** PDF reports, XLSX import/export, KPI dashboards, benchmarking against
other herds (opt-in), printable summary packs (e.g., DairyManager-style monthly
costings wrapper).

**Key deliverables:** PDF engine, XLSX import/export, report center, KPI set
(production, fertility, health, feed, finance), benchmarking.

**Tests:** report data accuracy vs raw DB rollups, export/import round-trip, PDF
generation integrity.

---

### Phase 8 — Mobile / PWA / offline
**Scope:** Installable PWA, mobile-first UX, offline queue with sync, conflict
resolution on `version`, offline-first data entry.

**Key deliverables:** service worker + manifest, offline CRUD queue, sync + conflict
resolution, install prompts, mobile navigation.

**Tests:** offline capture then online sync, conflict rejection via `version`,
PWA audit (Lighthouse installability), E2E on mobile viewport.

---

### Phase 9 — AI Farm Copilot + AI insights
**Scope:** RAG/LLM assistant grounded in the farm's own data; proactive AI insights
(anomalies, productivity, health risk, feed efficiency, cash-flow flags).

**Key deliverables:** Copilot chat UI; grounding pipeline over farm data; insight
generation + notification of new insights; query authorisation scoped to farm + role.

**Tests:** Copilot answers stay in-farm (no cross-tenant leak), insight accuracy
against known data, graceful offline/undegraded-API fallback.

---

### Phase 10 — Subscription + SaaS
**Scope:** PaaS/licence plans, Stripe billing, usage metering, entitlements, free
trial, admin panel (users, farms, plans, revenue, support), role/permission
management (granular RBAC), team invitations + sharing.

**Key deliverables:** plans + checkout + webhook handling; entitlements enforced on
API; admin panel; invite/membership flow; granular RBAC.

**Tests:** webhook signature validation, entitlement checks on every farm route,
trial expiry, plan downgrade behavior, admin isolation.

---

### Phase 11 — IoT integrations
**Scope:** Optional webhooks/API for milking parlour, auto-ID (RFID/EID), scales,
sensors; feed this data into milk/weight modules automatically.

**Key deliverables:** typed webhook receivers, device registration, idempotent
ingestion, source attribution (manual vs IoT).

**Tests:** idempotent duplicate ingestion, cross-device isolation, malformed
payload rejection.

---

### Phase 12 — Production hardening + release
**Scope:** RLS, full E2E + load testing, backups, observability (logs/metrics),
secrets management, CI/CD, Dockerized full stack, deployment docs, security +
backup + API docs, seed/demo data, bug-zero release gate.

**Key deliverables:** everything from the deliverables checklist not yet shipped.

**Tests:** full regression suite green, load test within budget, backup/restore
drill verified, security review passed.

---

## 5. Cross-cutting requirements

### 5.1 Rules for every change
1. **Phase gating:** do not start Phase N+1 until Phase N passes all its tests.
2. When a requirement is ambiguous, choose the **most scalable and secure**
   implementation and document the decision (this file or `implementation-progress.md`).
3. Prioritise correctness, security, usability, maintainability, and real-world
   farm workflows over visual complexity.
4. Run tests, check errors, verify DB integrity, and prove the feature end-to-end
   before marking a phase complete.

### 5.2 Data integrity invariants (hold across all phases)
- Every operational record: UUID `id`, `farm_id` FK, `created_at`, `version`.
- Composite FKs `(farm_id, animal_id)` prevent cross-farm references.
- Updates check `version` and reject stale writes (409).
- Financial transactions are immutable; corrections use reversing entries.
- All money uses `NUMERIC` (decimal-safe), never floats.
- All farm-scoped queries filter by `farm_id` with membership verified.

### 5.3 Bilingualism
- Every user-facing string has EN + UR variants. Urdu enables RTL (`dir=rtl`).
- Persisted preference; default EN. New features must ship both languages.

### 5.4 Multi-tenancy + RBAC evolution
- Phase 1: OWNER (write) vs VIEWER (read-only) at farm level.
- Phase 10: expand to granular per-module roles/permissions + team invitations.

### 5.5 Non-goals (out of scope unless requested)
- Animal registries from government bodies, milk-quality lab integrations.
- On-phone native iOS/Android builds (PWA covers mobile).
- GDPR-grade consent workflows for end-farmers (still follow best practice).

---

## 6. Testing strategy

- **Unit** (Node built-in runner + `tsx --test`): validation, sqlite-free logic.
- **Integration** (`backend/scripts/verify-api.ts`): real HTTP + real DB assertions.
- **E2E** (Playwright): public site, auth, tenant isolation, LAN-specific flows.
- **Per-phase:** a dedicated spec + entry gate as defined in each phase.

---

## 7. Environments & config

- `.env` / `.env.example`: `DATABASE_URL`, `APP_ORIGIN`, `API_PORT`, `API_URL`.
- Dev DB: embedded-postgres (`npm run dev:db`) or docker-compose Postgres 17.
- Production: dockerized full stack (Phase 12), secrets via environment/secret manager.

---

## 8. Glossary

- **Tenant** — a `farms` row; the isolation boundary.
- **Farm member** — a user linked to a farm with a role.
- **Module** — one of the 12 operational record types.
- **Farm Copilot** — the AI assistant (Phase 9).
- **version** — optimistic-lock counter on every operational record.
