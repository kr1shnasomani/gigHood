# AGENTS.md - gigHood Operating Manual

This file defines how coding agents should work in the `gigHood` main branch.

## 0) Universal Entry Point (All LLMs)

`AGENTS.md` is the single source of truth for agent behavior in this repository.

Platform files like `GEMINI.md`, `CLAUDE.md`, or other tool-specific instruction files must stay minimal and point back to this file.

If a platform-specific file conflicts with this file, follow `AGENTS.md` unless the platform has a hard runtime limitation.

## 1) Mission

`gigHood` is a parametric income-protection platform for gig workers.

Core product contract:

1. detect zone disruption (DCI)
2. route claims safely (`fast_track` / `soft_queue` / `active_verify` / `denied`)
3. settle payouts quickly
4. preserve fraud and trust auditability

## 2) Architecture Map

### Backend

1. entrypoint: `backend/main.py`
2. API routers: `backend/api/`
3. services/domain logic: `backend/services/`
4. scheduler/jobs: `backend/scheduler/`
5. data client + retry wrappers: `backend/db/`

### Frontend

1. app root: `frontend/src/app/`
2. worker app: `/worker-app/*` (dark, phone-style shell)
3. admin dashboard: `/admin-dashboard/*` (light, desktop layout)
4. public site: `/`

### Database

1. source-of-truth migrations: `supabase/migrations/`
2. migration index: `supabase/MIGRATIONS.md`
3. PostGIS-backed zone model

## 3) Skills Inventory (Workspace)

Agents should actively use specialized skills from `.agents/skills/` whenever the task matches.

**1. Backend & Testing Skills**
- `python-backend`: Guidelines for building FastAPI services, thin routers, and robust error handling.
- `python-testing`: Patterns for unit testing models and mocking integrations.
- `api-testing`: Standards for writing and updating API integration assertions.

**2. Frontend & UI Skills**
- `react-components` / `nextjs-development`: Next.js 14 App Router patterns, standardizing client vs server components.
- `shadcn-ui` / `frontend-design`: Creating reusable, accessible Tailwind components using strict design tokens.
- `ui-mobile` / `ui-ux-pro-max`: Emphasizes dark-phone shell optimizations for mobile worker routes.
- `web-design-guidelines` / `design-md` / `emil-design-eng`: Instructions for achieving 'Kinetic Ledger' premium aesthetics (Lexora-style lighting, typography).

**3. Data & DB Skills**
- `supabase-database` / `supabase-postgres-best-practices`: Patterns for working with Supabase models.
- `postgres-patterns`: Guidance on complex operations, PostGIS schemas, and RLS configurations.

**4. External / Workflow Skills**
- `xgboost-lightgbm`: ML pipeline definitions.
- `stitch-loop` / `remotion`: Frontend prototyping and animation loops.
- `payment-integration`: Implementing robust Razorpay payment logic.

**Skill Usage Rules:**
1. Select the closest matching skill before implementation.
2. Prefer skill-guided patterns over ad-hoc code style.
3. If multiple skills apply, combine them in order: architecture -> implementation -> testing.

## 4) MCP Usage Policy

When MCP tools are available in the active session, agents should use them instead of manual drift-prone operations.

### Supabase MCP

Use for:

1. schema inspection and migration application
2. data sanity checks and backfills
3. branch/database validation before release

Rules:

1. DDL should go through migration workflows, not one-off undocumented SQL.
2. If SQL is run manually, commit equivalent migration into `supabase/migrations/`.
3. Always document any DB contract changes in `docs/DATABASE.md`.

### Render MCP

Use for:

1. service/deploy status checks
2. runtime and logs verification during incident response
3. confirming production/preview deploy health before merge/release

Rules:

1. verify target environment before running actions,
2. avoid production-changing operations unless explicitly requested,
3. log deployment-impacting steps in docs/PR notes.

### Vercel MCP

Use for:

1. managing frontend preview deployments
2. verifying environment variables configured for Next.js features (`NEXT_PUBLIC_API_URL`)
3. retrieving crash logs, Edge function exceptions, and build failures on the frontend

Rules:

1. Confirm the target environment (Production vs Preview) when adjusting environment variables.
2. Immediately check serverless function logs output if the user reports routing/hydration errors in preview endpoints.

## 5) Runtime and Environment Guardrails

1. keep root `.python-version` pinned to `3.11.9`
2. do not remove runtime pin unless Render runtime is explicitly pinned and validated elsewhere
3. frontend API resolution strategy:
	- preview: prefer `NEXT_PUBLIC_API_URL_PREVIEW`, fallback `NEXT_PUBLIC_API_URL`
	- production: use `NEXT_PUBLIC_API_URL`
4. avoid hardcoded environment URLs in code

## 6) Engineering Rules

1. API handlers remain thin (`backend/api/*`)
2. business logic belongs in services (`backend/services/*`)
3. schema changes are migration-first
4. preserve worker-shell vs admin/public theme isolation
5. do not regress claim routing or payout invariants

## 7) Documentation Contract

For any behavior/schema/deploy change, update docs in the same change set:

1. `README.md`
2. `docs/API.md`
3. `docs/DATABASE.md`
4. `docs/CONTEXT.md`
5. `docs/SOLUTION.md` (if product/architecture narrative changes)

Conflict resolution priority:

1. running code
2. applied migrations
3. docs (must be synchronized immediately)

## 8) Memory and Context Discipline

1. maintain repository memory files under `/memories/repo/` for recurring operational lessons
2. keep `docs/CONTEXT.md` as the detailed, human-readable system memory for this branch
3. whenever an incident is fixed, capture:
	- root cause
	- mitigation
	- prevention guardrail

## 9) Validation Checklist Before Push

1. backend: `pytest`
2. backend syntax/smoke checks for touched modules
3. frontend: `npm run lint` and `npm run build` in `frontend/`
4. verify worker + admin route behavior for touched flows
5. verify docs updated and consistent with code

## 10) Safety Guardrails

1. never commit secrets or credential files
2. never bypass migrations for schema changes
3. never use destructive git commands unless explicitly requested
4. if unexpected unrelated repo changes appear, stop and confirm with the user before proceeding
