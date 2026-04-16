# CONTEXT.md - gigHood Full System Memory

This file is the high-fidelity operating context for contributors and coding agents.

## 1) Product Purpose

`gigHood` is an AI-assisted parametric income protection platform for gig workers.

Design objective:

1. detect local earning disruption via DCI
2. trigger reliable claim routing with fraud guardrails
3. execute payouts quickly
4. preserve auditability and operational resilience

## 2) End-to-End System Topology

### Backend (FastAPI)

Code roots:

1. app entry: `backend/main.py`
2. router layer: `backend/api/*.py`
3. domain services: `backend/services/*.py`
4. scheduler jobs: `backend/scheduler/*.py`
5. data access and retries: `backend/db/*.py`
6. schemas: `backend/models/schemas.py`

Mounted router prefixes:

1. `/workers`
2. `/policies`
3. `/claims`
4. `/location-pings`
5. `/notifications`
6. `/chat`
7. `/admin`

### Frontend (Next.js App Router)

Code roots:

1. app entry/layout: `frontend/src/app/`
2. shared route wrapper: `frontend/src/components/AppRouteShell.tsx`
3. API base resolver: `frontend/src/lib/api.ts`
4. admin data client: `frontend/src/lib/admin/adminClient.ts`

Surfaces:

1. public website: `/`
2. worker app: `/worker-app/*` (dark, phone shell)
3. admin dashboard: `/admin-dashboard/*` (light, desktop)

### Database (Supabase + PostGIS)

Migration roots:

1. ordered SQL files: `supabase/migrations/`
2. migration policy/index: `supabase/MIGRATIONS.md`

Core entities:

1. `workers`
2. `hex_zones`
3. `policies`
4. `signal_cache`
5. `dci_history`
6. `location_pings`
7. `disruption_events`
8. `claims`
9. `fraud_flags`
10. `premium_payments`

## 3) Core Runtime Flows

### A. Worker lifecycle

1. OTP send -> OTP verify
2. profile completion + city/platform metadata
3. policy creation/activation

### B. DCI lifecycle

1. signal ingestion (`weather`, `aqi`, `traffic`, `platform`, `social`)
2. zone-level DCI compute
3. zone status + history update
4. worker dashboard consumption

### C. Claim lifecycle

1. disruption event opens
2. pending claims created for exposed policyholders
3. PoP and fraud evaluation
4. route assignment: `fast_track`, `soft_queue`, `active_verify`, `denied`
5. payout execution for eligible routes
6. webhook/reconciliation updates

### D. Fraud and trust lifecycle

1. fraud score + flags attached to claims
2. route-specific actions and escalation
3. trust score updated from outcomes
4. admin fraud analytics and queue views

### E. Admin analytics lifecycle

1. KPIs from policy/premium/claim aggregates
2. payout trends and summaries
3. policy tier distribution
4. fraud queue with DCI + path + score context
5. fraud relationship monitor backed by Neo4j network graph (`/admin/fraud/network-graph`)

## 4) Environment and Deployment Context

### Production topology

1. frontend: Vercel
2. backend: Render
3. production API variable: `NEXT_PUBLIC_API_URL`

### Preview topology

1. preview API variable: `NEXT_PUBLIC_API_URL_PREVIEW`
2. fallback to `NEXT_PUBLIC_API_URL` when preview variable missing
3. admin fallback data used only in preview runtime + 404 for missing admin routes

### Python runtime pinning

Root `.python-version` is authoritative and currently set to `3.11.9`.

Reason:

1. no explicit pin can allow Render/Nixpacks to auto-select newer Python,
2. Python 3.14 caused `pydantic-core` source-build failures in prior deploys,
3. 3.11.9 keeps dependency builds stable.

Operational rule:

1. do not remove `.python-version` unless Render service runtime is explicitly pinned and validated,
2. keep this file included in merge/release commits.

## 5) Recent Reliability Hardening (Merged)

### Fraud queue data quality

1. admin queue now derives `dci_score` by priority:
   - `disruption_events.dci_peak`
   - weighted sigmoid from event `trigger_signals` (`0.45W + 0.25T + 0.20P + 0.10S`)
   - zone fallback `hex_zones.current_dci`
2. queue now derives render-safe non-null fraud score values.

### Claim defaults and backfill

1. `claims.fraud_score` default set to `30`
2. `claims.fraud_score` backfilled and `NOT NULL`
3. pending null paths normalized to `soft_queue`
4. denied null paths normalized to `denied`
5. event `dci_peak` backfilled where missing

### Neo4j fraud graph integration

1. claims ingestion now writes claim graph triplets to Neo4j:
   - `(:Worker)-[:USES_DEVICE]->(:Device)`
   - `(:Worker)-[:CLAIMED_IN]->(:Hex_Zone)`
2. device fingerprint is derived from worker device attributes (`device_model`, `sim_carrier`, `sim_registration_date`, `platform_id`).
3. admin endpoint `GET /admin/fraud/network-graph` returns graph JSON (`nodes`, `links`, `meta`).
4. fraud monitor UI now consumes this endpoint and renders live network links when present.
5. when no network links exist yet, the UI shows an explicit empty-state message.
6. graph node risk filters (`CRITICAL/HIGH/MEDIUM/LOW`) are now computed from live backend node fields (`risk_level`, `fraud_score`) rather than frontend type defaults.

Migration references:

1. `018_backfill_claim_scores_and_event_dci_defaults.sql`
2. `019_drop_redundant_pk_indexes.sql`

### ML runtime legitimacy wiring

1. DCI engine now loads active signal weights from `dci_weights` with TTL cache and cold-start fallback.
2. Weekly Sunday retraining now includes:
   - risk profiler retrain
   - fraud model retrain (`backend/ml/train_fraud_model.py`)
   - DCI weight optimization and persistence (`backend/services/dci_weight_trainer.py`)
3. Fraud scorer now runs hybrid inference:
   - rules-based layer stack
   - model probability layer from `fraud_model.pkl`
4. Network ring detection now uses recent claims/event evidence and shared worker fingerprints, not deterministic hash scoring.

### Frontend session routing

1. admin sign-out redirects to `/`
2. worker sign-out redirects to `/`
3. unauthenticated worker route guard redirects to `/`

### UX/loading improvements

1. route-level loading boundaries added for worker and admin app shells
2. nav prefetching added for smoother tab/page switching
3. worker geolocation lookup now uses multi-attempt fallback (high accuracy -> balanced retry -> cached fix) to reduce claim-time timeout failures on weak devices/networks.

### DCI/claim consistency hardening

1. worker DCI API now derives `dci_status` directly from the returned numeric DCI to prevent stale status labels.
2. demo claim processing refreshes stale zone snapshots before disruption eligibility checks.
3. demo claim processing falls back to latest `dci_history` score when zone snapshot DCI is temporarily missing.
4. DCI cycle now uses a bounded weather+AQI composite to prevent inflated default scores in fresh/mock-heavy zones.
5. new worker zones return a normal bootstrap DCI baseline until enough live signals are available for stable computation.

## 6) Theming and Shell Contract

Worker contract:

1. dark visual system
2. phone-shell width/spacing
3. bottom-nav behavior preserved

Admin/public contract:

1. light visual system
2. desktop/full-width layout
3. no worker shell leakage

## 7) Documentation Sync Contract

When behavior changes, update in the same branch/commit set:

1. `README.md`
2. `docs/API.md`
3. `docs/DATABASE.md`
4. `docs/CONTEXT.md`
5. `docs/SOLUTION.md` (if architecture narrative changes)

Source-of-truth order:

1. running code
2. applied migrations
3. docs

## 8) Operational Guardrails

1. migration history is immutable; use forward migrations for fixes/cleanup
2. never bypass migrations with undocumented DDL
3. do not hardcode environment URLs
4. avoid production infrastructure changes without explicit user approval
5. stop and confirm when unrelated unexpected repo changes are detected
6. Neo4j connectivity must be configured via env only (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, optional `NEO4J_DATABASE`)

## 9) Ready-to-Run Checklist (Main Branch)

Backend:

1. `python --version` inside repo venv is 3.11.x
2. `pip install -r backend/requirements.txt` succeeds
3. `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001` starts

Frontend:

1. `cd frontend && npm ci` succeeds
2. `npm run lint` has no errors
3. `npm run build` succeeds
4. `npm run dev` boots at `http://localhost:3000`

Integration smoke:

1. root health endpoint responds
2. worker and admin routes load with correct shells
3. admin queue renders DCI/fraud/path for recent claims

## 10) Memory Practice

1. durable project memory belongs in this file and `/memories/repo/`
2. every incident fix should record:
   - root cause
   - corrective change
   - prevention rule

## 11) Neo4j Troubleshooting Runbook

1. If fraud graph panel is empty, first verify claim ingestion has run for recent claims.
2. Validate Neo4j schema presence in query page:
   - `CALL db.labels() YIELD label RETURN label ORDER BY label;`
   - `CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType;`
3. If labels/relationships are missing, run claim processing once and retry.
4. If backend logs show unknown label/property warnings, ensure backend is running latest code with pre-check guard in `backend/services/neo4j_graph.py`.
5. Confirm env settings are loaded correctly:
   - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, and optional `NEO4J_DATABASE`.
