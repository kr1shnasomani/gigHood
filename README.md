<div align="center">
  <img src="./frontend/public/logo.jpeg" alt="gigHood logo" width="120" />
</div>

<div align="center">

# gigHood

### AI-Powered Parametric Income Insurance for Gig Workers

</div>

## What This Repo Contains

1. FastAPI backend for worker auth, DCI/disruption indexing, policies, claims, payouts, chat, and admin analytics.
2. Next.js frontend with three surfaces:
   - public marketing site
   - worker app (dark, phone-style shell)
   - admin dashboard (light surface)
3. Supabase migration-backed schema and data contracts.

## Documentation Index

1. `README.md`: setup, environment, runbook.
2. `docs/API.md`: backend routes and endpoint contracts.
3. `docs/DATABASE.md`: schema and migration mapping.
4. `docs/CONTEXT.md`: architecture, deployment, and release context for contributors/LLMs.
5. `AGENTS.md`: coding/contribution guardrails.
6. `docs/SOLUTION.md`: product and architecture narrative.

## Repository Structure

```text
gigHood/
├── backend/
├── docs/
├── frontend/
├── supabase/
├── scripts/
├── tests/
├── docker-compose.yml
├── README.md
├── AGENTS.md
└── docs/
   ├── API.md
   ├── DATABASE.md
   ├── CONTEXT.md
   └── SOLUTION.md
```

## Prerequisites

1. Python 3.11+
2. Node.js 20+
3. npm 10+
4. Docker Desktop (optional)

## Quick Setup

### macOS/Linux

```bash
chmod +x setup.sh
./setup.sh
```

### Windows

```bat
setup.bat
```

## Environment Variables

### Backend (`backend/.env`)

1. `SUPABASE_URL`
2. `SUPABASE_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `JWT_SECRET`
5. `RAZORPAY_KEY_ID`
6. `RAZORPAY_KEY_SECRET`
7. `OPENROUTER_API_KEY`
8. `GROQ_API_KEY`
9. `FIREBASE_CREDENTIALS_PATH`
10. `BACKEND_CORS_ORIGINS` (comma-separated frontend origins)

### Frontend (`frontend/.env.local`)

1. `NEXT_PUBLIC_API_URL`
   - production API base URL
2. `NEXT_PUBLIC_API_URL_PREVIEW`
   - preview/staging API base URL
3. `NEXT_PUBLIC_VERCEL_ENV` (optional when auto-exposed by Vercel)
   - helps frontend choose preview vs production URL deterministically

## Run Locally

### Backend

```bash
# one-time setup (if venv is missing)
python3.11 -m venv venv

source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

## Local URLs

1. Frontend: `http://localhost:3000`
2. Backend API: `http://127.0.0.1:8001`
3. OpenAPI docs: `http://127.0.0.1:8001/docs`

## Docker

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

## Deployment Notes

1. Frontend supports both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_URL_PREVIEW`.
2. Resolution order in browser:
   - local host -> local backend
   - preview deployment -> `NEXT_PUBLIC_API_URL_PREVIEW` (fallback to `NEXT_PUBLIC_API_URL`)
   - production/other -> `NEXT_PUBLIC_API_URL`
3. Recommended: always set both values in Vercel (`Preview` + `Production`) to avoid accidental routing drift.
4. Admin frontend previews require a backend that mounts `/admin/*`.
5. Render backend deploys in this repo require root `.python-version` pinned to `3.11.9` to avoid Python 3.14 package build failures (`pydantic-core` source build errors).

## Python Runtime Pinning

1. This branch intentionally includes root `.python-version` set to `3.11.9`.
2. This repo does not rely on `pyproject.toml` or `runtime.txt` for Render Python selection.
3. If this file is omitted during merge, Render may auto-upgrade Python and break dependency builds.
4. When merging admin/staging into main, include `.python-version` in the merge commit to keep production runtime stable.

## Sign-Out and Redirect Behavior

1. Admin sign-out returns users to `/` (main website).
2. Worker app sign-out returns users to `/` (main website).
3. Unauthenticated worker dashboard access redirects to `/`.

## Pre-Merge Release Checklist

1. Confirm `NEXT_PUBLIC_API_URL` is set in both Vercel `Preview` and `Production` environments.
2. Confirm `NEXT_PUBLIC_API_URL_PREVIEW` is set for Vercel `Preview` (recommended).
3. Confirm admin backend (`admin` branch service) latest deploy is `live` on Render.
4. Confirm production backend (`main` branch service) latest deploy is `live` on Render.
5. Validate frontend with `npm run build` from `frontend/`.
6. Validate backend with `pytest` from repository root.
7. Ensure docs in `docs/` match code behavior before opening merge PR.

## UI Surface Contract

1. Worker routes (`/worker-app/*` and supported legacy aliases) render in dark phone shell.
2. Admin and public routes remain light and full-width.
3. Route-scoped wrapper for this behavior lives in `frontend/src/components/AppRouteShell.tsx`.

## Validation Commands

From repo root:

```bash
pytest
```

From `frontend/`:

```bash
npm run lint
npm run build
```

## Notes

1. Demo simulation endpoints are under `/workers/me/demo/*`.
2. If docs differ from runtime behavior, code + migrations are source of truth; update docs in same branch.
