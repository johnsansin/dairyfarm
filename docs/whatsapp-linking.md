# Per-farm WhatsApp linking

Farm owners can open **Settings → WhatsApp → Link WhatsApp**. On their phone,
open WhatsApp **Settings / ⋮ → Linked devices → Link a device**, then scan the
QR shown in the farm's settings. Once linked, the number and account name appear.
The QR refreshes automatically and expired codes are hidden.

Each farm has a separate Baileys socket and encrypted authentication state.
Only an active owner of that farm can view the QR or link/unlink the account;
delegated settings permissions do not grant access to WhatsApp credentials.
A farm has one linked number at a time. Unlink before changing numbers.

This feature establishes and maintains the connection. It does not send messages,
sync chat history into application records, or enable automated replies. There
are no message-sending endpoints in this change.

## Operation

- Session state is persisted in PostgreSQL and restored on backend startup.
- Temporary disconnects use bounded reconnect attempts. Logged-out or invalid
  sessions require a new QR scan.
- Unlink removes encrypted credentials. If the phone was offline during unlink,
  also remove the DairyMonitor device from WhatsApp's Linked devices list.
- The pairing attempt expires after three minutes if no phone connects.
- Connections are paused if the farm or linking owner's access becomes inactive.
- One backend worker owns a farm's socket using PostgreSQL advisory locks on a
  dedicated connection. Deploy behind one backend instance / sticky routing;
  QR images are transient and held only by the worker owning that connection.

## Configuration

Set `WHATSAPP_AUTH_KEY` in the backend environment to 32 random bytes encoded in
base64. Keep it stable across restarts and deployments. All workers sharing a
database must use the same key. Keep a protected copy separate from database
backups; losing the key requires unlinking and re-pairing affected numbers.

The deployment Compose file passes this variable through to the backend. If it
is absent or invalid, the UI reports that linking is unavailable. Credentials
are encrypted using AES-256-GCM with the farm, session generation, key type and
key ID bound as authenticated context. Unlink/expired-session cleanup fences off
stale socket writes. API responses never include auth keys; QR responses are
owner-only and use the application's no-store cache policy.

Migration: `023_whatsapp_connections.sql`.
Dependency: official `@whiskeysockets/baileys` pinned to `7.0.0-rc14` (the npm
latest tag at implementation time), loaded through dynamic import on Node 22.

Implementation follows the upstream [connection/auth-state guide](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/connecting.md)
and [socket configuration guide](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/configuration.md).
Baileys is a WhatsApp Web connector, not the official WhatsApp Business Cloud API.

## Verification

- Backend unit tests cover encryption, tamper detection, and cross-farm/session
  decryption rejection.
- `scripts/verify-whatsapp.ts` requires disposable `WA_TEST_DATABASE_URL`,
  `WA_TEST_API_URL`, and `WA_TEST_ORIGIN` values. It verifies API permissions,
  farm isolation, encryption, QR isolation, duplicate-connect prevention,
  worker leases, Signal-key serialization, restart/reconnect, logout, unlink,
  and stale-write prevention with an injected socket transport.
- Set `WA_TEST_NETWORK=1` to also test a real Baileys QR handshake with WhatsApp
  on a disposable farm. This does not link a phone or send messages.
- `frontend/tests/whatsapp.spec.ts` checks the UI using deterministic transport
  responses, including QR expiration, linked-number display, unlink and farm
  switching, plus mobile overflow and desktop/mobile screenshots.
- A real QR handshake passed during implementation. Final pairing and operation
  with the owner's phone require the owner to scan the QR; this cannot be
  completed by server-side tests alone.

## Live deployment

Deployed on 2026-10-11 at `http://192.168.2.213:3000`. Migration 023
was applied after a private database snapshot, and a persistent encryption key
was configured outside source control. Production builds and type checks passed.
The settings page and backend health returned HTTP 200; unauthenticated WhatsApp
access returned HTTP 401. Database, backend and frontend services are active
and enabled. Phone pairing remains an owner action.
