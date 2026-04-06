# CONTEXT.md - gigHood System Context

## 1. What gigHood Is

gigHood is a parametric insurance platform designed for gig workers (delivery and mobility cohorts).
Instead of manual claim narratives, the system estimates disruption intensity by zone and time,
then applies policy and trust checks to route claims toward payout, queue, verification, or denial.

Core intent:

1. protect worker income during disruption windows
2. settle valid claims quickly
3. maintain auditable fraud and trust controls

## 2. High-Level Architecture

### Backend (FastAPI)

1. Entry: `backend/main.py`
2. Routers:
   - `workers`
   - `demo`
   - `policies`
   - `claims`
   - `location_pings`
   - `notifications`
   - `chat`
   - `admin`
3. Services: disruption, claim, payout, fraud, chat support logic in `backend/services/`
4. Scheduler: periodic/background operations in `backend/scheduler/jobs.py`

### Frontend (Next.js App Router)

The frontend contains three distinct surfaces:

1. public site
   - marketing and informational pages
2. worker app
   - mobile-first phone shell
   - dark theme
   - key routes: login/register/home/chat/payouts/profile
3. admin dashboard
   - analytics and operational controls
   - light theme

Theme/shell separation is route-scoped using `frontend/src/components/AppRouteShell.tsx`.
Worker routes are wrapped in `.worker-theme` and `.app-shell`.
Admin/public routes render outside that shell.

### Data Layer (Supabase/Postgres)

1. Migration source of truth: `supabase/migrations/`
2. Core entities:
   - workers
   - hex_zones
   - policies
   - disruption_events
   - claims
   - fraud_flags
   - premium_payments
3. Spatial and zone operations use PostGIS-enabled schema.

## 3. Primary Runtime Flows

### A. Worker Onboarding and Policy

1. OTP send/verify
2. worker registration/profile
3. policy retrieval/creation

### B. DCI and Disruption Loop

1. ingest telemetry/signals
2. compute zone DCI
3. update hex status and history
4. expose worker-facing DCI snapshot

### C. Claims and Payouts

1. identify disrupted worker-event eligibility
2. evaluate proof-of-presence and fraud indicators
3. assign resolution path (`fast_track`, `soft_queue`, `active_verify`, `denied`)
4. execute payout or queue for further review
5. reconcile via payout webhook

### D. Worker Support Chat

1. uses worker context + language preference
2. supports multiple Indian languages with safe fallback

### E. Admin Analytics

Admin routes aggregate from claims, workers, fraud flags, policies, and zones.
Representative outputs include:

1. KPI totals (active policies, premium, claims paid)
2. payout trends and summaries
3. policy tier distribution
4. fraud metrics, events, and queue

## 4. Environment and Deployment Model

### Production

1. frontend deployed on Vercel
2. backend deployed on Render
3. production frontend points to `NEXT_PUBLIC_API_URL`

### Preview / Branch Validation

1. preview frontend builds (Vercel) can use `NEXT_PUBLIC_API_URL_PREVIEW`
2. `NEXT_PUBLIC_API_URL` remains the production/default API variable
3. runtime resolver prefers preview variable for preview deployments and falls back safely to production variable
4. backend Render deploys should run on Python 3.11.9 (root `.python-version`) for dependency compatibility in this repo

Why `.python-version` exists in this branch:

1. Render/Nixpacks can auto-select a newer Python runtime when no explicit version file exists.
2. This branch hit Python 3.14 build failures while installing `pydantic-core` from source.
3. Pinning `3.11.9` keeps dependency resolution stable and avoids `maturin/cargo` build failures.
4. During merge to production branch, include `.python-version` in the merge set to avoid runtime drift.

Runtime selection is implemented in `frontend/src/lib/api.ts`:

1. localhost -> local backend
2. preview deployment -> `NEXT_PUBLIC_API_URL_PREVIEW` (fallback to `NEXT_PUBLIC_API_URL`)
3. production/other -> `NEXT_PUBLIC_API_URL`
4. fallback default -> `https://gighood-backend-live.onrender.com`

## 4.1 Frontend Environment Matrix

Use this matrix before merge:

1. Local development
   - file: `frontend/.env.local`
   - key: `NEXT_PUBLIC_API_URL`
   - typical value: `http://127.0.0.1:8001`
2. Vercel Preview
   - environment scope: `Preview`
   - key: `NEXT_PUBLIC_API_URL_PREVIEW` (recommended)
   - value: admin/staging backend URL
   - fallback key: `NEXT_PUBLIC_API_URL`
3. Vercel Production
   - environment scope: `Production`
   - key: `NEXT_PUBLIC_API_URL`
   - value: production backend URL

Important:

1. If both variables are set globally without environment scope, production can be routed incorrectly; keep values separated by Vercel env scope.
2. If preview frontend points at a missing Render URL, users see the network error raised by `frontend/src/lib/api.ts`.
3. Admin data fallback in `frontend/src/lib/admin/adminClient.ts` is intentionally limited to preview runtime + HTTP 404.

## 5. Known Branch-Specific Context

This branch includes admin router mounting in backend and preview safety in frontend.
Historically, admin preview frontends can show 404 if pointed to a backend that does not mount `/admin/*`.

Recent deployment failure root cause (Render admin backend):

1. build used Python 3.14 (`cp314` wheels)
2. `pydantic-core==2.27.2` fell back to source build via `maturin/cargo`
3. metadata generation failed during cargo registry/cache operations
4. deploy ended with `metadata-generation-failed` and `Build failed`

Mitigation in this branch:

1. keep root `.python-version` set to `3.11.9`
2. retain existing backend dependency set without forcing pydantic-core source compile path

To keep preview UX usable during missing admin routes,
`frontend/src/lib/admin/adminClient.ts` includes controlled fallback datasets for:

1. KPI cards
2. zone/risk forecast
3. payout trends/summary/recent
4. policy stats/tiers
5. fraud metrics/signals/workers/events/queue

Fallback activates only for preview runtime status 404.

## 5.2 Queue and Score Guarantees

Recent hardening added these guarantees:

1. `claims.fraud_score` is non-null (default `30`).
2. New pending claims are created with provisional `resolution_path=soft_queue` and `fraud_score=30`.
3. Admin queue `dci_score` resolves from event `dci_peak`, then weighted-sigmoid signal compute, then zone fallback.
4. Claim approver recovery path writes fallback values if processing throws.

## 5.1 Release-Candidate Production Notes

Before merge of `admin` into `main`, verify:

1. `/admin/*` endpoints required by the dashboard are available on the target backend.
2. Preview dashboard fallback data is only a resilience layer, not a substitute for backend readiness.
3. API URL values in Vercel match intended environment/backend pairs.

## 6. Worker Theme and Layout Contract

Worker UX contract:

1. dark visual language
2. constrained phone-style viewport (max width shell)
3. sticky bottom navigation behavior
4. compatibility for `/worker-app/*` and legacy aliases

Admin/public contract:

1. light visual language
2. full-width desktop-friendly layout
3. no worker shell wrapping

This prevents style leakage across surfaces and preserves expected role-based UX.

## 6.1 UI Regression Focus Areas Before Merge

1. worker routes (`/worker-app/*`, and legacy aliases) remain dark and phone-shell constrained.
2. admin routes remain light and desktop-width.
3. route transitions do not leak shell or theme classes between surfaces.
4. sign-out from admin and worker app returns to `/` (main website).
5. unauthenticated worker dashboard access redirects to `/`.

## 7. Operational Guardrails for Future Work

1. if routes change, update `API.md` in same branch
2. if schema changes, add migration first and update `DATABASE.md`
3. if deployment behavior changes, update `README.md` and this file
4. keep `AGENTS.md` synchronized with workflow rules used by contributors and coding agents
5. avoid production config changes when task scope is preview/staging-only

## 7.1 Git and Deploy Guardrails for Merge

1. merge changes from `admin` to `main` only after successful frontend build and backend tests.
2. confirm Render backend service for target branch is live before frontend release promotion.
3. avoid changing both frontend and backend env URLs during incident response unless rollback plan is prepared.
4. tag or annotate release commits with deployment intent when possible.

## 8. Suggested Quick Verification Matrix

1. backend health: `GET /`
2. worker auth: otp send/verify/register
3. worker home: DCI read and simulation flow
4. admin dashboard: kpis/zones/risk/payout/fraud endpoints
5. frontend split:
   - worker routes render dark phone shell
   - admin routes remain light/full-width
6. preview environment:
   - verify API base selection under preview host

## 8.1 Push-Readiness Checklist (Admin Branch)

1. `git status` clean except intentional docs/code updates.
2. `frontend/src/lib/api.ts` uses preview-aware dual-key strategy (`NEXT_PUBLIC_API_URL_PREVIEW` + `NEXT_PUBLIC_API_URL`).
3. docs updated to reflect runtime/env strategy and queue guarantees (`README.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/CONTEXT.md`).
4. `npm run build` succeeds in `frontend/`.
5. backend tests succeed (`pytest`).
6. Render latest admin backend deploy is `live`.
7. Vercel preview environment has correct `NEXT_PUBLIC_API_URL` value.
8. root `.python-version` is present and set to `3.11.9`.

## 8.2 Recommended Cutover Sequence

1. Freeze non-release changes on `admin`.
2. Validate checklist in section 8.1.
3. Merge `admin` -> `main`.
4. Verify backend health (`GET /`) and key admin/worker endpoints.
5. Verify production frontend smoke paths:
   - worker login/home
   - admin dashboard landing
6. Keep rollback reference commit/hash ready.

## 9. Source-of-Truth Ordering

When documentation conflicts with behavior:

1. running code is authoritative for current branch behavior
2. migrations are authoritative for schema shape
3. docs must be corrected immediately to match both
