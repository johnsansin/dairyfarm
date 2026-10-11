# Local features and main integration

The `integrate/local-features-main` branch preserves the local features from
`bee103d` and merges GitHub main at `799696e`.

Included features: superadmin interface and APIs, platform notifications,
egg production and sales, payment/receipt tracking, and migrations 015–021.
Main's deployment configuration, migration fixes, registration connection-release
fix, and report-switching crash fix are retained.

The sign-in form conflict was resolved using the local top-level `IconInput`
component, preserving stable input identity and main's registration autofocus.
Database backups are ignored and were not committed. Environment files containing
local configuration were not copied to validation or committed.

## Validation (2026-10-11)

Validation used a temporary checkout under `/tmp`, a separate PostgreSQL instance
on port 55432, backend port 4100, and frontend port 3100. The running site's
build output and database were not modified.

- Backend unit tests: 4 passed.
- Frontend and backend TypeScript checks: passed.
- Backend production build: passed.
- Frontend production build: passed using `next build --webpack` to support
  dependencies shared with the temporary checkout.
- All 21 SQL migrations applied successfully to a fresh database via the compiled
  JavaScript migration entry point. A second run completed without reapplying them.
- Targeted API smoke checks passed: duplicate registration, egg production,
  milk/egg sales and partial receipts, overpayment rejection, payment reversal,
  purchase payment, admin access denial for a regular user, admin endpoints,
  farm suspension/reactivation, and self-suspension rejection.
- The HTTP content-security-policy test passed.
- Six browser tests could not start because Chromium lacks `libatk-1.0.so.0`.
  Installing browser system dependencies requires a sudo password unavailable
  in this session. Browser behavior, including report switching, remains unverified.

## Publication

Pushing the branch failed because GitHub rejected the stored authentication token.
After restoring GitHub authentication, push this branch and open a pull request
against `main`. No remote merge or deployment was performed.
