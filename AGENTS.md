# AGENTS.md - gigHood

## Project Context

gigHood is a parametric income-protection platform for gig workers.
It combines zone disruption indexing, policy logic, claim routing, fraud controls, and payout orchestration.

## Runtime Architecture

### Backend

1. Entry: `backend/main.py`
2. Routers: `backend/api/*`
3. Business logic: `backend/services/*`
4. Scheduled jobs: `backend/scheduler/jobs.py`

### Frontend

1. Root: `frontend/`
2. App Router: `frontend/src/app/`
3. Worker experience: dark, phone-style shell via route-scoped wrapper.
4. Admin/public surfaces: light theme, full-width layout.

### Data Layer

1. Supabase client: `backend/db/client.py`
2. Migrations: `supabase/migrations/`
3. Spatial support: PostGIS

## Product Flows To Preserve

1. OTP auth -> profile completion -> policy lifecycle
2. Signals -> DCI update -> disruption state
3. Proof-of-presence + fraud checks -> claim decision path
4. Payout execution -> webhook reconciliation
5. Worker chat uses worker context and selected language
6. Admin metrics remain read-heavy and resilient to partial data

## Multi-Environment Rules

1. Production frontend must continue using `NEXT_PUBLIC_API_URL`.
2. Preview frontend may use `NEXT_PUBLIC_API_URL_PREVIEW` for isolated backend testing.
3. Admin frontend previews should target backend builds that mount `/admin/*`.
4. Do not modify production infrastructure while debugging preview branches unless explicitly requested.

## Engineering Rules

1. Keep API handlers thin in `backend/api/`.
2. Keep domain logic in `backend/services/`.
3. Keep schema changes migration-first in `supabase/migrations/`.
4. Preserve worker route behavior under `/worker-app/*` and supported legacy aliases.
5. Avoid theme bleed between worker and admin/public surfaces.
6. Avoid hardcoded assumptions about environment URLs in frontend/backend.

## Documentation Source of Truth

Always keep these docs aligned with code changes in the same branch:

1. `README.md`
2. `API.md`
3. `DATABASE.md`
4. `CONTEXT.md`
5. `SOLUTION.md`

Conflict resolution order:

1. Running code (`backend/`, `frontend/`)
2. Applied migrations (`supabase/migrations/`)
3. Then docs must be updated immediately.

## Local Validation Checklist

Before closing implementation work:

1. `pytest` passes for backend.
2. `npm run build` passes in `frontend/`.
3. Worker auth/dashboard/chat/payout/profile flows still render.
4. Admin dashboard routes return expected shape, or documented fallback behavior is active for preview.
5. Docs reflect real behavior of mounted routes and schema.

## Safety Guardrails

1. Never commit secrets.
2. Never bypass migrations for schema changes.
3. Never silently break claim routing behavior.
4. If unexpected unrelated repo changes appear, stop and confirm with the user before proceeding.
