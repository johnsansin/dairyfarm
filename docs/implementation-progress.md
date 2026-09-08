# Implementation progress

## Workflow completion (2026-09-08)

- Roles & permissions: custom module permissions are editable in a horizontally and vertically scrollable table and are enforced by operational API routes.
- Team: staff records appear with designation, linked account, assigned role, and a clickable detail view. Owners can connect a registered account and assign a custom role.
- Farm settings: time zone is selected from the browser-supported IANA time-zone list. A new Application dropdowns tab manages extra choices while retaining required workflow states.
- Searchable choices: application selects now use one reusable searchable, keyboard-accessible picker. Animal choices display `tag — name` everywhere, falling back to tag when a name is absent.
- Photos: animal and staff add/edit forms accept PNG, JPEG, or WebP images up to 2 MB and show a preview before saving.
- Reports: the report center renders filtered records on the web with text, date, animal, and relevant status/category filters, pagination, matching CSV export, and print/PDF output capped at 10,000 records.
- Inventory: stock additions, manual consumption, movement history, weighted value, and insufficient-stock validation are implemented. Health and vaccination records accept multiple medicine/vaccine items and deduct all quantities in the same transaction as the clinical record.
- Notifications: the bell refreshes every minute and generates user-scoped reminders for accessible upcoming tasks, vaccination due dates, and low stock.
- Database migrations 007–008 add staff/account roles, dropdown overrides, stock movement history, clinical stock usage, and notification event deduplication.
- Verification: TypeScript, production build, 4 unit tests, and all 6 Playwright tests pass. The workflow integration test covers permission enforcement, staff role linking, record photos, atomic stock consumption, tag/name report labels, filtered CSV, and low-stock notifications.

## Team and notification workflow completion (2026-09-08)

- Added owner-only team role editing and member removal in the settings UI and API. Membership changes are audited; updates/removals serialize on the farm row and recheck the acting owner to protect the final owner during concurrent changes.
- Team additions validate that a custom role belongs to the selected farm, reject custom-role/OWNER combinations, normalize email, and commit membership, notification, and audit together.
- Role creation now exposes initial permission selections. System-role booleans are recognized correctly; invalid/duplicate module permissions are rejected. Fixed duplicate role creation releasing the same database connection twice.
- Notification buttons now POST, mark linked notifications read before navigation, show failures, and load the badge before the dropdown is opened. Viewers can mark their own notifications read while ordinary write restrictions remain enforced.
- Restarted the stale local API with automatic reload; it was serving older code without the organization endpoints required by the current dashboard.
- Verification: production build and TypeScript passed; unit tests 4/4 and full browser suite 4/4 passed. The expanded team browser test also passed, covering linked notifications and mark-all-read, team editing, cross-farm role rejection, removed-member isolation, and concurrent last-owner protection.
- Scope: this completes these existing workflow gaps only. Custom module permissions are still stored configuration; granular enforcement, payroll, offline sync, account recovery, and other deferred master-spec functionality remain outstanding.

The master specification (`MASTER_SPEC.md`) remains the acceptance target. Phases follow a strict gate: **a later phase does not start until the current phase passes all its tests.**

## Dashboard & application features (verified 2026-09-07)

Status: **backend + frontend implemented, typecheck/build/tests green.**

### Backend (`backend/src/modules/app.ts`, `backend/src/index.ts`, migrations 003–005)
- Notifications: list (with unread count), mark single read, mark-all read.
- Roles & permissions: GET/POST/PUT `/roles` (custom roles, per-module `none/read/write`; system roles read-only).
- Team: GET/POST `/team` (add an existing user by email as OWNER or VIEWER; sends a notification to the invitee).
- Farm settings: GET/PUT `/settings` (free-form JSON blob).
- Accounting: chart of accounts GET/POST/PUT `/coa`, journal GET/POST `/journal` (single-account entry, debit/credit NUMERIC), ledger GET `/ledger` (totals + balance per account), financial report GET `/reports/financial`.
- Animal photo upload `POST /animals/:id/photo`; staff photo upload `POST /staff/:id/photo` (data-URL, ≤ 2 MB).
- Change password `POST /api/v1/auth/change-password` (verifies current password, bcrypt cost 12, revokes all other sessions, clears cookie).
- `GET /operations/options/staff` — active farm staff for the tasks “Assigned to” dropdown.
- Tasks `assignee` migrated from free-text name to `uuid` FK → `staff` (migration `005_tasks_assignee_staff.sql`); old names remapped to staff records where a match exists.

### Frontend
- `components/header.tsx` — sticky app header: brand, **global animal search across all farms** (debounced, deep-links to `/dashboard?farm=…&animal=…`), active-farm pill selector, language toggle, **notification bell** (unread badge + dropdown, mark-all-read), **user menu** (profile/password, settings, sign out).
- `app/dashboard/page.tsx` — rewritten shell: header, workspace, **sticky footer**, profile modal.
- `components/change-password.tsx` — profile & change-password modal.
- `components/farm-workspace.tsx` — sidebar now adds **Accounting** and **Settings**; `tasks.assignee` renders a **staff dropdown** (`StaffField`), staff names resolve via `MemberName`; **animal & staff photo** shown in the detail view with upload (`PhotoField`); global-search opens the animal record detail (`focusAnimalId`).
- `components/accounting.tsx` — in-page financial report (milk sales / expenses / income / net profit + balance-sheet position), chart of accounts, journal with add-entry form, ledger table; **CSV export** and **print/PDF** via a formatted print window.
- `components/settings.tsx` — roles & permissions matrices (editable for custom roles), add-role, and team management (list members, add user by email + role).
- `app/globals.css` — appended styles for header, global search dropdown, notifications panel, user menu, footer, photo upload, accounting tables, settings layout.

### Verification
- `npx tsc --noEmit` clean; `npx next build` (6/6 static pages) clean; `npm test` 4/4 pass.
- Live API checks (logged-in demo user): notifications/roles/team/settings/coa/journal/ledger/financial/options-staff/staff-photo all 200; `PUT /roles/:id` 200; journal POST 201.
- **Custom roles now also selectable in the team “Add user” role dropdown** (assigned via `roleId`; the team list shows the role name via a new `LEFT JOIN roles` in `GET /team`).
- **Permissions table headers follow the selected language** (previously always Urdu).
- **Sticky sidebar**: `.farm-app` switched `overflow:hidden` → `overflow:clip` (clip does not create a scroll container, so `position:sticky` works); `.farm-sidebar` becomes sticky (`top:84px`, `max-height:calc(100vh - 108px)`, own scrollbar), reset to static in the horizontal-bar table layout on small screens.
- **Dark theme**: `useTheme()` hook (`components/language.tsx`) sets `data-theme` on `<html>`, persisted in localStorage `dm-theme`; Sun/Moon toggle in the header (`components/header.tsx`, wired in `app/dashboard/page.tsx`); ~99 `html[data-theme='dark']` overrides appended to `globals.css` covering the header/search/notifications/user-menu, workspace, tables, modals, forms, accounting/settings panels, the marketing homepage and the auth pages; `color-scheme: dark` keeps native dropdowns readable.
- **Photo thumbnails**: animals & staff tables now show a small rounded photo cell first (`photo-thumb-sm`), so the staff picture is visible in the list without opening the detail view.
- **Responsive shell**: header wraps to two rows (search full-width) below 960px; notifications/search/user dropdowns go full-width fixed under 560px; reduced-motion media query added.
- **Standard app frame (`2026-09-07`)**: `.workspace-main` made fluid (max-width none, 18px gutters); `.farm-app` grows to `min-height:calc(100vh - 130px)` with a **220px pinned left sidebar** (`@media(min-width:1001px)`), 4-col→2-col→1-col stat/report grids, single-column overview at ≤900px, auth page stacks (aside hidden) at ≤740px, homepage `steps`/`preview` collapse to 1 col at ≤900px, compact tables/forms/modals at ≤480px; `-webkit-appearance:none` + `touch-action:manipulation` + `text-size-adjust` for consistent iOS/Android/browser rendering.
- E2E (Playwright) still blocked in this environment by missing `libatk-1.0.so.0` (no sudo).

## Earlier phase work (Phase 1 foundation, verified 2026-09-07)

Status: **complete / verified** for the account + farm foundation slice.

- Master spec written (`docs/MASTER_SPEC.md`, all 12 phases + deliverables checklist).
- Unit tests: 4/4 passing (`npm run test`).
- API integration (`backend/scripts/verify-api.ts`): PASS — registration, login, logout,
  session revocation, farm creation, tenant isolation, origin enforcement,
  validation, audit logging, OWNER membership integrity.
- Typecheck: clean (`npm run typecheck`).
- Register flow hardened to be transactional (user + session created atomically,
  unique-violation still returns 409 without leaking a partial account).
- Operational CRUD foundation (12 modules) present from earlier work.
- E2E (Playwright): browser launch is blocked in this environment by missing
  system libraries (`libatk-1.0.so.0`, no sudo to install). Previously passed
  (`test-results/.last-run.json` = passed). Backend coverage is equivalently
  exercised by the integration script above.

Open items per spec (deferred by design): email verification/reset, MFA, granular
RBAC, team invitations, DB RLS, backups, offline sync, deployment hardening, load
testing. These are Phase 12 / later-phase items, not Phase 1 blockers.

1. Herd, animal profiles and QR; milk entry and production totals.
2. Health, vaccinations, breeding, weights and work tasks.
3. Feed/general stock with transaction history and weighted-average costing.
4. Buyers/suppliers, invoices, partial payments, cash transactions and ledger reports.
5. Staff, partners, team access, operational reports and farm insights.
6. Advanced payroll, distributions, automated notifications, offline sync, provider-backed AI, subscriptions and production operations.

Each stage must pass backend/database/API checks before completion. Provider-dependent features must explain their configuration requirements. Nothing is complete merely because a menu item exists.

## Data and permissions
All operational records have UUID identifiers, farm_id, created_at and version. Record updates check versions to reject lost updates. Composite foreign keys prevent cross-farm animal/contact references. Current OWNER membership permits writes; VIEWER permits reads. Audits store record identifiers and previous/new values. Immutable financial transactions require reversing entries rather than editing. Business calculations run in PostgreSQL NUMERIC, not frontend floating-point arithmetic.

## UI polish & record rework (2026-09-07)
- Royal indigo/violet theme applied app-wide (`--green:#4f46e5`, `--dark:#1e1b4b`, `--ink:#262a40`, `--cream:#f5f6fc`, `--line:#e2e6f0`, `--sage:#8b5cf6`); 130-color audit in globals.css, success/error states kept. Dark theme (`html[data-theme='dark']`) retinted to match.
- Sidebar now a grouped menu: FARM MENU brand, sections HERD / HEALTH / WORK & PEOPLE / SALES & PURCHASING / STOCK & FINANCE / SYSTEM with per-module icons (Dashboard, Animals, Milk, Weights, Health, Vaccinations, Breeding, Tasks, Staff, Buyers, Suppliers, Partners, Feed & inventory, Accounting, Reports, Settings, Audit log).
- Data tables upgraded: zebra striping + row hover, sortable column headers with sort arrows via `.sortable/.sort-asc/.sort-desc`, numeric columns right-aligned with tabular-nums, photo column (`.chk`) and row-actions column (`.actions-c`).
- Row actions moved to a 3-dot kebab menu (`.more-btn` + `.more-pop`) with View / Edit / Delete; View opens a record detail **page** (`.detail-card`) instead of a modal; delete confirmed before call.
- Backend: added imperative `DELETE /records/:module/:id` (transaction + FOR UPDATE, audit `module.deleted`, 404 for missing, FK 23503 -> 400 "has linked history").
- Verification: typecheck clean, `next build` 6/6 pages, integration tests 4/4, `/dashboard` 200, new classes + retheme visible in served CSS.

## Pending browser verification completed (2026-09-08)

- Resolved the previously documented browser-library blocker by running with `LD_LIBRARY_PATH=/tmp/dairymonitor-browser-libs/extracted/usr/lib/x86_64-linux-gnu`.
- Playwright now reads `.env` and uses `E2E_BASE_URL`, then `APP_ORIGIN`, then localhost. Both test suites use the configured origin; removed the fixed LAN IP. The API's origin enforcement is unchanged.
- Updated farm assertions to check the active-farm selector and logout flows to open the profile menu first.
- Added a localized accessible name and expanded state to the profile menu button, including when the username is hidden on mobile.
- Verification: `npm test` 4/4 passed; `npm run typecheck` passed; browser tests 3/3 passed (public navigation, Urdu persistence/RTL, mobile overflow, registration, farm creation, login/logout, tenant isolation, origin rejection, six-character passwords).
- This completes the explicitly recorded browser-verification blocker. Deferred master-spec phases above remain outstanding; this entry does not claim the full specification is complete.
