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
2. `API.md`: backend routes and endpoint contracts.
3. `DATABASE.md`: schema and migration mapping.
4. `CONTEXT.md`: architecture and deployment context for future contributors/LLMs.
5. `AGENTS.md`: coding/contribution guardrails.
6. `SOLUTION.md`: product and architecture narrative.

## Repository Structure

```text
gigHood/
├── backend/
├── frontend/
├── supabase/
├── scripts/
├── tests/
├── docker-compose.yml
├── README.md
├── API.md
├── DATABASE.md
├── CONTEXT.md
├── AGENTS.md
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
   - preview/staging API base URL for Vercel previews

## Run Locally

### Backend

```bash
source venv/bin/activate
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

1. Production frontend should use `NEXT_PUBLIC_API_URL`.
2. Preview frontend can use `NEXT_PUBLIC_API_URL_PREVIEW` to target an isolated backend.
3. Admin frontend previews require a backend that mounts `/admin/*`.
4. Root runtime pin files are intentionally not tracked to match original repo conventions.

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
