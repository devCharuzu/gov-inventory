# PhilFIDA Inventory System

Inventory and asset management for PhilFIDA regional offices. The production architecture is intentionally small: a Vite/React frontend, a FastAPI serverless API on Vercel, and Supabase Postgres for persistent data.

## Architecture

- `frontend/` — React/Vite single-page application.
- `backend/app/` — FastAPI API, authentication, reports, and domain logic.
- `api/index.py` — Vercel ASGI entry point.
- `supabase/migrations/` — versioned production database schema.
- Local development defaults to `backend/gov_inventory.db` (SQLite).
- Production stores report PDFs in Supabase instead of the Vercel filesystem, which is ephemeral.
- Each issued regional administrator account has its own isolated inventory, settings,
  signatories, audit history, counters, and report archive. PDF headers are derived
  from the signed-in account's region and cannot be changed to another region.

## Run locally

Requirements: Node.js/npm and Python 3.

The frontend lockfile is committed so the Vercel build can use a reproducible `npm ci` installation.

```bash
./start-local.sh
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). For frontend hot reload, run the backend on port 8000 and then run `npm ci && npm run dev` in `frontend/`; Vite proxies `/api` requests to the backend.

The API is available under `/api`, health is available at `/api/health`, and interactive API documentation is available at `/docs`.

## Configuration and secrets

Copy the example file when configuring a local environment:

```bash
cp backend/.env.example backend/.env
```

For local SQLite development, leave `DATABASE_URL` unset or use the SQLite default. For production-like local testing, use Supabase Dashboard → Connect → Direct → Transaction pooler → URI. For this project, the template is `postgresql+psycopg://postgres.rvqsekwderfgcgmvicgo:<URL_ENCODED_DATABASE_PASSWORD>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require`. Replace only the password placeholder and URL-encode special characters. A URL that still contains an example placeholder is rejected in production and safely falls back to SQLite in development.

Required production settings:

- `DATABASE_URL` — Supabase Transaction pooler URI using `sslmode=require`.
- `SECRET_KEY` — a new random value with at least 32 characters.
- `ENVIRONMENT=production`.
- `AUTO_CREATE_SCHEMA=false` — the schema is deployed by the migration, not by a cold start.
- `CORS_ORIGINS` — the Vercel production URL, and any explicitly approved preview URL.
- `INITIAL_ADMIN_PASSWORD` — optional fallback for a local empty database; production accounts are seeded by the regional migration.

Do not put database credentials, `SECRET_KEY`, an `sb_secret_` key, or any other server-only secret in a `VITE_` variable. Vite variables are bundled into browser JavaScript. The real `.env` files are ignored by Git and must never be committed. If a secret was shared in chat or another insecure place, rotate it before production.

## Supabase database

The migration at `supabase/migrations/20260918071957_regional_multi_tenant_reset.sql` creates the regional inventory tables, number counters, report storage, indexes, foreign keys, and deny-by-default RLS policies. It seeds the ten regional administrator usernames supplied for this deployment. The production API connects with the Postgres pooler; the browser does not connect directly to Supabase.

The requested reset removed the previous cloud inventory rows and login accounts. Local SQLite data, if present, is separate and is not uploaded automatically.

The configured runtime connection uses the dedicated `inventory_app` role, not
the database owner. The migration grants access through role-specific RLS
policies that require the authenticated region context. API publishable/secret
keys are not needed by this architecture. Keep the generated runtime URL in the
ignored `backend/.env` and Vercel's sensitive production environment variables.

To verify a deployment with temporary records, run
`backend/venv/bin/python scripts/verify_deployment.py https://gov-inventory.vercel.app`.
This reads credentials from the ignored environment file, tests stock and PDF
workflows, and removes its temporary records. Login audit entries and allocated
document numbers are retained.

## Vercel deployment

The Vercel project must use the repository root as its Root Directory. The committed `vercel.json` installs and builds the frontend from `frontend/`, while `api/index.py` exposes the FastAPI API under `/api/*`.

In Vercel Project Settings → Environment Variables, add the production values above. Use server-only variables without `VITE_` prefixes. Redeploy after changing environment variables. The first production health check is:

```text
https://<your-vercel-domain>/api/health
```

The expected response is a JSON object with `status: "ok"` and the configured environment. A healthy response only verifies the function and database connectivity; log in and exercise item creation, stock-in, stock-out, report download, and backup before handover.

## Administrator handover

The administrator only needs the Vercel URL, their issued regional username, and
the temporary password provided separately by the developer. The first login
shows a password-change prompt. Keep deployment credentials, Supabase
credentials, and the temporary account password in the organization’s password
manager; never commit them to this repository.
