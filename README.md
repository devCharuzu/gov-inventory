# Philfida Inventory System

Local-first web application for managing government-owned assets and inventory for PhilFIDA Regional Office XIII.

The application is a React/Vite single-page app served by a FastAPI backend. The backend serves the compiled frontend from `backend/static`, stores data in SQLite, and keeps generated PDF reports in `backend/generated_reports`.

## Run locally

Requirements: Node.js/npm and Python 3.

```bash
cd gov-inventory
./start-local.sh
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The script installs missing dependencies, builds the frontend, and starts the local API/web server.

For frontend development with hot reload:

```bash
# terminal 1
cd gov-inventory/backend
venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# terminal 2
cd gov-inventory/frontend
npm ci
npm run dev
```

The development frontend runs at `http://127.0.0.1:5173` and proxies API calls to the local backend.

## First login

On a new database, sign in with username `admin` and leave the password blank. The app prompts the administrator to set a real password immediately.

## Data and configuration

- Default database: `backend/gov_inventory.db`
- Generated PDFs: `backend/generated_reports/`
- Override the database location with `DATABASE_PATH` when the data should live outside the project.
- Runtime settings can be supplied through environment variables or `backend/.env`.

The API is available under `/api`, health is available at `/health`, and interactive API documentation is available at `/docs`.

## Supabase and secret configuration

Production uses a separate Supabase Postgres project. The local SQLite database is retained only as the migration source until the cloud database has been verified.

For local configuration:

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env` with the Supabase **Transaction pooler** connection string from Dashboard → Connect and a newly generated `SECRET_KEY`. The real `.env` file is ignored by Git and must never be committed.

The API publishable key is safe for browser use when a frontend integration needs it. A key beginning with `sb_secret_` is server-only; rotate it if it has been shared, and keep it only in backend/Vercel server environment variables. It is not a database connection password, so the Postgres pooler URL and database password are still required for this FastAPI/SQLAlchemy backend.

For Vercel, add the same values in the project Environment Variables settings and scope them to the appropriate environment. Do not use `VITE_` or `NEXT_PUBLIC_` prefixes for database credentials or signing secrets; client-prefixed variables are exposed to the browser. Never place a Supabase service-role/secret key in frontend code.
