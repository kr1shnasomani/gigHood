<div align="center">
  <img src="./frontend/public/logo.jpeg" alt="gigHood logo" width="120" />
</div>

<div align="center">

# gigHood

### AI-Powered Parametric Income Insurance for Gig Workers

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Data%20Layer-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-Frontend-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-UI-61DAFB?style=for-the-badge&logo=react&logoColor=0B1220)
![TypeScript](https://img.shields.io/badge/TypeScript-App%20Code-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-State-7D4CDB?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Local%20Infra-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Frontend%20Hosting-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-Backend%20Hosting-46E3B7?style=for-the-badge&logo=render&logoColor=0B1220)
![APScheduler](https://img.shields.io/badge/APScheduler-Background%20Jobs-0F172A?style=for-the-badge)
![Razorpay](https://img.shields.io/badge/Razorpay-Payouts-0C2451?style=for-the-badge&logo=razorpay&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Notifications-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM%20Gateway-111827?style=for-the-badge)
![Groq](https://img.shields.io/badge/Groq-Inference-F55036?style=for-the-badge)

</div>

## What This Repo Contains

1. FastAPI backend for worker auth, DCI/disruption indexing, policies, claims, payouts, chat, and admin analytics.
2. Next.js frontend with three surfaces:
   - public marketing site
   - worker app (dark, phone-style shell)
   - admin dashboard (light surface)
3. Supabase migration-backed schema and data contracts.
4. Neo4j-backed fraud relationship graph for admin fraud monitor visualizations.

## ML Runtime Notes

1. DCI runtime weights are loaded from `dci_weights` (active row) with cold-start fallback.
2. Weekly ML job retrains three assets on Sundays:
   - risk tier model (`backend/services/risk_profiler.py`)
   - fraud model (`backend/ml/fraud_model.pkl`)
   - DCI signal weights (`backend/services/dci_weight_trainer.py` -> `dci_weights`)
3. Fraud scoring uses a hybrid model:
   - rule-layer score from telemetry + behavior checks
   - XGBoost probability score from `claim_frequency`, `zone_risk`, `location_anomaly`, `time_of_day`

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

Use example files to bootstrap local setup:

1. `cp backend/.env.example backend/.env`
2. `cp frontend/.env.example frontend/.env.local`

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
11. `NEO4J_URI`
12. `NEO4J_USER`
13. `NEO4J_PASSWORD`
14. `NEO4J_DATABASE` (optional; set for Aura instances with non-default DB name)

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

## Fraud Graph (Neo4j)

1. Graph ingestion runs during claim processing and demo claim processing.
2. Nodes projected: `Worker`, `Device`, `Hex_Zone`.
3. Relationships projected: `USES_DEVICE`, `CLAIMED_IN`.
4. Admin graph endpoint: `GET /admin/fraud/network-graph`.
5. Admin Fraud Monitor tab consumes this endpoint and renders live network links when available.
6. Manual backfill endpoint: `POST /admin/fraud/network-graph/backfill?limit=1000`.
7. Graph node fields are live-scored by backend (`fraud_score`, `risk_level`) and drive UI filter buttons.

### Verify in Neo4j Query Page

Paste these Cypher statements in Neo4j Browser / Query page:

1. Check labels and relationship types exist:

```cypher
CALL db.labels() YIELD label RETURN label ORDER BY label;
CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType;
```

2. Check projected counts:

```cypher
MATCH (w:Worker) RETURN count(w) AS workers;
MATCH (d:Device) RETURN count(d) AS devices;
MATCH (z:Hex_Zone) RETURN count(z) AS zones;
MATCH ()-[r:USES_DEVICE]->() RETURN count(r) AS uses_device_edges;
MATCH ()-[r:CLAIMED_IN]->() RETURN count(r) AS claimed_in_edges;
```

3. Inspect sample graph triplets:

```cypher
MATCH (w:Worker)-[:USES_DEVICE]->(d:Device), (w)-[:CLAIMED_IN]->(z:Hex_Zone)
RETURN w.id AS worker_id, d.fingerprint AS device_fingerprint, z.id AS zone_id
LIMIT 25;
```

4. Validate syndicate detection logic directly:

```cypher
MATCH (d:Device)<-[:USES_DEVICE]-(w:Worker)-[:CLAIMED_IN]->(z:Hex_Zone)
WITH d,
     collect(DISTINCT w.id) AS workers,
     collect(DISTINCT z.id) AS zones
WHERE size(workers) > 1 AND size(zones) > 1
RETURN d.fingerprint AS device_fingerprint, workers, zones
ORDER BY size(workers) DESC, size(zones) DESC;
```

5. If query page shows no labels/relationships, trigger backfill and retry:

```bash
curl -X POST "http://127.0.0.1:8001/admin/fraud/network-graph/backfill?limit=1000"
curl "http://127.0.0.1:8001/admin/fraud/network-graph"
```

### One-go Neo4j verification script

Paste and run this full block in Neo4j Query page:

```cypher
CALL db.labels() YIELD label RETURN 'LABEL' AS kind, label AS value ORDER BY value;
CALL db.relationshipTypes() YIELD relationshipType RETURN 'REL' AS kind, relationshipType AS value ORDER BY value;

MATCH (w:Worker) RETURN count(w) AS workers;
MATCH (d:Device) RETURN count(d) AS devices;
MATCH (z:Hex_Zone) RETURN count(z) AS zones;
MATCH ()-[r:USES_DEVICE]->() RETURN count(r) AS uses_device_edges;
MATCH ()-[r:CLAIMED_IN]->() RETURN count(r) AS claimed_in_edges;

MATCH (w:Worker)-[:USES_DEVICE]->(d:Device), (w)-[:CLAIMED_IN]->(z:Hex_Zone)
RETURN w.id AS worker_id, d.fingerprint AS device_fingerprint, z.id AS zone_id
LIMIT 25;

MATCH (d:Device)<-[:USES_DEVICE]-(w:Worker)-[:CLAIMED_IN]->(z:Hex_Zone)
WITH d,
     collect(DISTINCT w.id) AS workers,
     collect(DISTINCT z.id) AS zones
WHERE size(workers) > 1 AND size(zones) > 1
RETURN d.fingerprint AS device_fingerprint, workers, zones,
       size(workers) AS worker_count, size(zones) AS zone_count
ORDER BY worker_count DESC, zone_count DESC;
```

### About the large backend terminal warnings

1. Those warnings happen when the query references labels/relationships before they exist in a fresh Neo4j graph.
2. The backend now pre-checks schema presence (`Worker`, `Device`, `Hex_Zone`, `USES_DEVICE`, `CLAIMED_IN`) before running the syndicate query.
3. If projection is not ready yet, the endpoint returns an empty graph payload cleanly instead of flooding terminal warnings.

## Notes

1. Demo simulation endpoints are under `/workers/me/demo/*`.
2. If docs differ from runtime behavior, code + migrations are source of truth; update docs in same branch.
