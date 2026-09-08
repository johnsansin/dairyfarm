# dairymonitor.online

An original English/Urdu dairy management application. Initial implementation: public website, account registration/login/logout, farm creation and switching, and a protected workspace. Marketing dashboard figures are explicitly illustrative. Operational farm modules, AI, subscriptions and offline synchronization remain planned.

## Stack
Next.js / React / TypeScript frontend; separate Node.js Express API; PostgreSQL. See docs/architecture.md for boundaries, ERD, API contracts, security decisions and release gaps.

## Local development
1. `npm ci`
2. Copy `.env.example` to `.env` and configure PostgreSQL.
3. Start PostgreSQL: `npm run dev:db` for a workspace-local development server, `docker compose up -d`, or use an existing PostgreSQL server. The local runner also applies the initial schema.
4. `npm run db:migrate`
5. In separate terminals: `npm run dev:api` and `npm run dev`.
6. Open http://localhost:3000. Register your account and create a farm. No demo credentials are installed.

APP_ORIGIN must exactly match the browser origin. The Next.js /api proxy forwards requests to API_URL. Production requires HTTPS, NODE_ENV=production, a private database, unique database credentials and deployment-specific secrets. The compose password is for local development only.

## Checks
`npm test`
`npm run typecheck`
`npm run build`
`npm run test:e2e` (requires running frontend/API/database and Playwright Chromium; uses `E2E_BASE_URL`, then `.env` `APP_ORIGIN`, then localhost; the URL must match the API’s configured origin)
`npx tsx scripts/verify-api.ts` (API and PostgreSQL integrity checks)

## Deployment status
Not production-ready yet. The initial account/farm slice passed PostgreSQL-backed API and browser integration checks. Phase 1 is not yet complete against the full master specification. Public commercial launch also requires email verification/reset, stronger operational authentication controls, granular RBAC, RLS, backup/restore verification, monitoring, privacy/terms, and security review. No deployment or DNS changes have been made.

## Verification performed
- Production build and TypeScript check passed.
- Three validation tests passed.
- Two Playwright tests passed: English/Urdu persistence, RTL, mobile overflow, navigation, registration, farm creation, login/logout, tenant access rejection.
- Direct API checks passed for expired/revoked access, Origin enforcement, invalid input, farm audit events and owner membership.
- Browser screenshots are generated in test-results/.
- This environment required browser shared libraries extracted into /tmp; on a normal development machine install Playwright system dependencies.
