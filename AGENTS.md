# AGENTS.md — gigHood

## Project Context

gigHood is a parametric income-protection platform for gig workers.
The system detects zone-level disruption, validates worker eligibility and trust constraints,
and routes claims to payout or verification flows.

Primary outcomes:

1. Worker protection during disruption windows
2. Fast and auditable payout routing
3. Strong fraud and policy guardrails

## Runtime Architecture

### Backend

1. FastAPI app entrypoint: `backend/main.py`
2. HTTP routes: `backend/api/*`
3. Domain logic: `backend/services/*`
4. Scheduler jobs: `backend/scheduler/jobs.py`

### Frontend

1. Canonical app root: `frontend/`
2. Next.js App Router code: `frontend/src/app/`
3. Worker app routes are under `/worker-app/*`
4. Legacy alias routes should redirect to `/worker-app/*`

### Data Layer

1. Supabase/Postgres client: `backend/db/client.py`
2. Migration source of truth: `supabase/migrations/`
3. Spatial extension: PostGIS enabled via `000_init_postgis.sql`

## Product Flows To Preserve

1. OTP auth -> worker profile -> active policy
2. Signal ingestion -> DCI update -> disruption status
3. PoP + fraud evaluation -> route claim path
4. Fast-track payout execution -> webhook reconciliation
5. Copilot chat uses worker context and selected app language

## Documentation Source Of Truth

Use and update these docs in tandem with code:

1. [README.md](README.md) for architecture intent
2. [API.md](API.md) for route contracts and payloads
3. [DATABASE.md](DATABASE.md) for schema and migration-backed fields
4. [SETUP.md](SETUP.md) for local, script, and Docker workflows

If there is a conflict:

1. Running code in `backend/` and `frontend/` wins
2. Migrations in `supabase/migrations/` win for schema
3. Then align docs immediately to code

## Engineering Rules

1. Keep route handlers thin in `backend/api/`.
2. Keep business rules in `backend/services/`.
3. Keep schema changes migration-first in `supabase/migrations/`.
4. Keep language default English unless changed by user preference.
5. Keep worker-facing routing under `/worker-app/*`.
6. Avoid hardcoded environment assumptions in frontend/backend URLs.

## Local Run Conventions

Run commands from repository root unless explicitly stated:

1. Backend: `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001`
2. Frontend: `cd frontend && npm run dev`
3. Backend tests: `pytest`
4. Frontend build validation: `cd frontend && npm run build`

## Validation Checklist Before Completion

1. Backend tests pass.
2. Frontend compiles and builds.
3. Auth, dashboard, claims, and chat critical flows still work.
4. API and DB docs match actual behavior.
5. No stale references to removed paths/files remain.

## Canonical Repository Shape

```text
gigHood/
  backend/
    api/
    services/
    scheduler/
    tests/
  frontend/
    src/
      app/
      components/
      hooks/
      lib/
      store/
  supabase/
    migrations/
  .github/
    workflows/
  README.md
  API.md
  DATABASE.md
  SETUP.md
  AGENTS.md
```

## Safety and Reliability Guardrails

1. Never commit secrets or service credentials.
2. Never bypass migration flow for schema mutations.
3. Keep claim routing behavior aligned with existing tests and contracts.
4. Prefer explicit compatibility handling over silent breaking changes.
