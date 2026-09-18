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
