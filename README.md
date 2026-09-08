# DairyMonitor

DairyMonitor is split into two fully isolated applications in one repository.

## Repository layout

- `frontend/` — Next.js 16, React, UI components, public website, dashboard, and browser tests.
- `backend/` — Express API, PostgreSQL access, migrations, backend scripts, and API tests.
- `docker-compose.yml` — optional PostgreSQL infrastructure shared by local development.
- `docs/` — architecture, implementation notes, and product specification.

Each application has its own `package.json`, `package-lock.json`, `node_modules`, TypeScript configuration, environment template, and build lifecycle. Neither application imports source code or dependencies from the other.

## First-time setup

```bash
npm run install:all
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
docker compose up -d
npm run db:migrate
```

Start both applications:

```bash
npm run dev
```

Or start them independently:

```bash
npm run dev:frontend
npm run dev:backend
```

The frontend runs on port 3000 and proxies `/api/*` to the backend on port 4000. The backend alone owns authentication, validation, permissions, business workflows, and PostgreSQL access.

## Independent commands

Frontend:

```bash
cd frontend
npm ci
npm run typecheck
npm run build
npm run test:e2e
npm start
```

Backend:

```bash
cd backend
npm ci
npm run typecheck
npm test
npm run build
npm run db:migrate
npm start
```

Root convenience commands orchestrate these isolated scripts: `npm run build`, `npm run typecheck`, `npm test`, and `npm run test:e2e`.

## Configuration

Frontend variables belong in `frontend/.env`:

- `API_URL` — private backend URL used by the Next.js rewrite.
- `E2E_BASE_URL` — optional Playwright target.

Backend variables belong in `backend/.env`:

- `DATABASE_URL`
- `APP_ORIGIN`
- `API_PORT`
- `NODE_ENV`

Never commit either environment file. Production requires HTTPS, unique database credentials, backups, monitoring, and deployment-specific secrets.
