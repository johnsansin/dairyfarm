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

## Warm redesign & superadmin panel (2026-09-16)

### Redesign (dashboard home, per pasted mockup)
- Warm palette in `:root`: `--green:#2E6B4E;--dark:#234F3B;--sage:#C98A2E;--ink:#21281F;--muted:#5E6A57;--cream:#FBF8F1;--line:#E6E2D6;--white:#fff;--primary-soft:#E5F0E7;--accent-soft:#FBEDD6;--danger:#B7452F;--sky:#DDEAE3`; `--font-head:'Sora','Manrope'`, `--font-body:'Inter','DM Sans'`. Google `@import` extended with Sora+Inter; 319 old green-hex tokens remapped; `Manrope` headings → Sora.
- Header (`components/header.tsx` + `.dashboard-shell` block in `app/globals.css`): 62px white topbar, 34px menu button, brand-mark + wordmark, search pill, active-farm pill, language pill, round bell, user-button pill with `.profile-avatar` initial.
- Overview (`components/farm-workspace.tsx`, `ov-*` block): banner with greeting + yield-delta message and farm name, "Record milk" CTA, 4 KPI cards (today's milk with delta vs yesterday, amber icon), 30-day chart with 5-bar bars + top-day highlight, reminders with urgent dot, quick links that switch the active tab.
- Responsive breakpoints 980/720/480. Dark variants for the `ov-*`/`.dashboard-shell` blocks are still owed (light theme matches the mockup now).

### Superadmin control panel
- Migration `database/015_superadmin.sql` (applied): `users.is_superadmin`, `users.is_active`, `farms.is_active`, `admin_audit_logs` table.
- `backend/src/index.ts`: `authenticated` returns `is_superadmin`,`is_active`; suspended accounts get 403; admin router mounted at `/api/v1/admin` behind `authenticated`.
- `backend/src/modules/admin.ts`: `requireSuperadmin` guard (403 `Admin access required`); `GET /stats`, `GET /farms`, `GET /organizations`, `GET /users` (searchable/paginated; `users` exposes `last_seen` from latest session expiry, no `sessions.created_at`); `POST /farms/:id/status`, `POST /users/:id/status` (self-suspend blocked, sessions deleted on suspend), `POST /users/:id/superadmin` (self-demote blocked). Every action writes an `admin_audit_logs` row.
- Farm suspension enforced in `operations.ts` and `app.ts` middlewares (403 "This farm is currently suspended. Contact the administrator.").
- Frontend `app/superadmin/page.tsx` + `app/superadmin/superadmin.css`: back button, admin branding + language pill, tabs Overview/Farms/Organizations/Users, stats cards, searchable tables with status chips and suspend/activate + promote/revoke actions, pager, light + dark themes, guest/denied guards.
- Entry: header user-menu gains "Admin panel"/"ایڈمن پینل" when `user.is_superadmin` (new `onAdmin` prop wired in `app/dashboard/page.tsx`).
- `app/robots.ts` disallows `/superadmin`; sitemap unchanged (explicit list).
- Verification: typecheck clean (frontend+backend), production builds clean, backend unit tests 4/4, live API checks — search on users/orgs/farms returns rows (count/rows `$1`/`$3` placeholder split fixed), farms listing de-duplicated via single-owner LATERAL join, suspend/reactivate farm flips `is_active` and returns 403 on operational endpoints while suspended, non-admin gets 403 on `/admin/*`, self-suspend and self-demote are rejected, suspended user is logged out (sessions deleted) and `/_auth/me` 401s, audit log rows recorded, `/superadmin` and `/dashboard` return 200 under systemd (`dairymonitor-backend.service`, `dairymonitor-frontend.service`).

## Superadmin completion — filters, settings, activity, search, sign-out (2026-09-16)

- Filters active: `GET /admin/farms?status=all|active|suspended` and `GET /admin/users?status=…&role=…` (literal clauses); segmented controls in the Farms/Users toolbars now drive them (backend rebuilt + restarted; smoke-tested live).
- Superadmin visual redesign (warm mockup): sticky frosted topbar, 216px white sidebar (created a `.admin-sidebar`, `.admin-nav-*` navigation) with brand mark and icon nav (Overview/Farms/Organizations/Users/Activity/Settings, left-accent active item), topbar-right cluster = global search pill + activity bell + sign-out + language pill, KPI cards with left accent bar, redesigned records tables (green uppercase headers on `--primary-soft`, row hover, tabular numbers, dot chips, pill action buttons, expandable per-user farm drill-down), pager, empty/denied states, mobile breakpoints (sidebar → horizontal pill bar), dark overrides for every piece.
- Notification bell: `GET /admin/activity?limit=…` backs a header bell with unread badge (localStorage `dm_admin_act_seen`), dropdown of the 12 latest actions with icon + admin + relative time, "View full activity log" jumps to the Activity tab.
- Global search: `GET /admin/search?q=` (users by name/email, farms by name/city/owner via the LATERAL owner join, capped 6+6) feeds a debounced header search with grouped dropdown; choosing a result switches to Users/Farms tab and pre-fills that tab's search.
- Settings tab + migration `016_admin_settings.sql` (applied): `admin_settings` key/jsonb table; `GET /admin/settings` (SMTP password masked via `passwordSet`), `POST /admin/settings` (smtp/backup sections, zod-validated, keeps old SMTP password when left blank), `POST /admin/settings/smtp/test` (raw `net` EHLO handshake), `POST /admin/backup` (dumps all 34 public tables as COPY-from-stdin CSV blocks under `backend/backups/`, returns file name/tables/rows/size), `GET /admin/backups`, `GET /admin/backups/:file` (res.download). Backup settings (enabled/hour PKT/keep days) are persisted but scheduling itself is not yet wired to a cron.
- Sign-out: topbar logout button calls existing `POST /api/v1/auth/logout` then routes to `/signin` (fixes: superadmin could not sign out — the panel previously had none).
- Docs/verification note: frontend still uses a plain text backup file format in `backend/backups/` (no `pg_dump` on this host); restore is manual via `psql -f`. All new endpoints smoke-tested live (settings round-trip, backup create + list + download 200/291KB, activity rows, search results). Operator footgun: any `pkill -f 'node dist/src/index.js'` / `pkill -f 'next start --hostname'` run from a shell whose own command line contains that string will kill the shell too — use bracket patterns `pkill -f '[n]ode dist/src/index.js'`. Also `credentials:'include'` must be the object form `{credentials:'include'}` — the bare form is a labeled-statement syntax error.

## Superadmin notifications (only new farms/accounts) + input focus fix (2026-09-16)

- Bell now notifies **only** on new Dairy Farm or new Account creation. Migration `017_platform_notifications.sql` (applied): `platform_notifications` (id/type `CHECK (farm.created|user.created)`/target_id/target_name/detail jsonb/created_at + created_at DESC index). `src/modules/notifications.ts` exports `addNotification(client,type,targetId,targetName,detail)`; invoked inside the register handler (`user.created`) and the farms POST handler (`farm.created`) within their transactions.
- New `GET /admin/notifications?limit=` in the admin router (superadmin-only) returns latest rows DESC. Verified live: registering `Notif Test` and creating `Notif Farm` (needs `currency`) produced `user.created` + `farm.created` rows.
- Frontend: bell now polls `/api/v1/admin/notifications` (on mount + every 30s, cap 12), renders type-specific rows ("New account"/"New farm" + target name + detail + relative time), keeps the unread badge via existing `dm_admin_act_seen` timestamp; the Activity tab still reads the full `/admin/activity` log. `actLoading` state removed.
- Input focus bug fixed: `Seg`, `Pager`, `SearchInput` (superadmin) and `IconInput` (auth forms) were defined inside the component body, so each keystroke re-render created a new component function → React unmounted/remounted the input and dropped focus after one character. Hoisted all four to module scope (now pure, receive `page/setPage/ur` etc. as props) so their identity is stable across renders. Typecheck + build clean; `/superadmin`, `/dashboard`, `/signin` 200.
- Superadmin account menu (top right): static `admin-who` text and standalone logout icon replaced by an `.admin-user` pill showing avatar + login name that opens an account dropdown head (name/email) with **Update profile** and **Sign out** (existing `POST /api/v1/auth/logout`). Update profile opens a modal (email read-only, editable full name, optional new password requiring current password) saving via existing `PUT /api/v1/auth/profile` + `POST /api/v1/auth/change-password`, then refreshes `me.name`. Verified live (name PUT round-trip 200). Mobile: name collapses to the avatar; dropdown becomes a bottom sheet.
- Egg production module added: migration `018_eggs.sql` (applied) creates `eggs` table (date, batch text, eggs int, broken int, notes + farm/date indices); shared module `key:'eggs'` (en "Egg production", ur "انڈوں کی پیداوار") added to both `backend/shared/modules.ts` and `frontend/shared/modules.ts`; `farm-workspace.tsx` sidebar gains `eggs` under the HERD group with `<Egg/>` icon. Records create/edit/view through the existing generic `RecordModule` UI. Verified live: POST a record (240 eggs, 5 broken) 201, list 200, negative eggs rejected 400. Test user/farm cleaned.
- Egg sales added: migration `019_egg_sales.sql` (applied) creates `egg_sales` (integer quantity, rate/egg → generated total, buyer, payment status, reference, notes, + farm/date index); migration `020_egg_sales_entry_type.sql` (applied) extends the `journal_entries.entry_type` CHECK with `'EggSale'`. Backend `GET/POST /api/v1/farms/:id/egg-sales` mirror milk-sales (buyers permission, future-date guard, farm-scoped buyer) and auto-create the `4001 "Egg sales"` income account + ledger journal entry. Frontend `farm-transactions.tsx` gains a third `Egg sales` tab (`<Egg/>`) with its own record modal (quantity in whole eggs, rate per egg). Verified live: 300 eggs @ 25 → total 7500.00 + ledger entry, income account auto-created; fractional quantity rejected 400. Test data cleaned.
