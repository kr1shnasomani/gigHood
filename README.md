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

1. A FastAPI backend for auth, DCI, policy issuance, claim routing, payouts, and chat.
2. A Next.js worker app for onboarding, dashboard, payouts, profile, and support flows.
3. Supabase migrations and runtime data contracts.

## Documentation Index

1. `README.md`: setup, runbook, structure, and contributor workflow.
2. `API.md`: current backend routes and payload contracts.
3. `DATABASE.md`: schema and migration-backed fields.
4. `SOLUTION.md`: deep product narrative and architecture explanation.
5. `AGENTS.md`: repository engineering guardrails.

## Repository Structure

```text
gigHood/
├── backend/
│   ├── api/
│   ├── services/
│   ├── scheduler/
│   └── tests/
│
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── store/
│
├── supabase/
│   └── migrations/
│
├── scripts/
├── tests/
│
├── setup.sh
├── setup.bat
├── docker-compose.yml
├── README.md
├── API.md
├── DATABASE.md
├── SOLUTION.md
└── AGENTS.md
```

## Prerequisites

1. Python 3.11+
2. Node.js 20+
3. npm 10+
4. Docker Desktop (optional)

## Quick Start (Recommended)

### Mac/Linux

1. Open terminal in repo root.
2. Run:

```bash
chmod +x setup.sh
./setup.sh
```

### Windows

1. Open Command Prompt or PowerShell in repo root.
2. Run:

```bat
setup.bat
```

The setup scripts initialize Python environment, install dependencies, and scaffold local env files.

## Environment Configuration

Create/update `backend/.env` with at least:

1. `SUPABASE_URL`
2. `SUPABASE_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `JWT_SECRET`
5. `RAZORPAY_KEY_ID`
6. `RAZORPAY_KEY_SECRET`
7. `OPENROUTER_API_KEY`
8. `GROQ_API_KEY`
9. `FIREBASE_CREDENTIALS_PATH` (or equivalent JSON secret strategy)

## Run Locally

### Backend

From repo root:

```bash
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

Windows (if using venv):

```bat
venv\Scripts\activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

In a separate terminal:

```bash
cd frontend
npm ci
npm run dev
```

## URLs

1. Frontend: `http://localhost:3000`
2. Backend API: `http://127.0.0.1:8001`
3. OpenAPI docs: `http://127.0.0.1:8001/docs`

## Docker Workflow

From repo root:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

## Worker App Routes

1. `/worker-app/login`
2. `/worker-app/register`
3. `/worker-app/home`
4. `/worker-app/payouts`
5. `/worker-app/profile`
6. `/worker-app/chat`

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

## CI/CD Overview

This repository already has GitHub Actions workflows in `.github/workflows/`.

1. `frontend.yml`
	- Runs on frontend changes.
	- Uses Node 20.
	- Executes `npm ci`, `npm run lint`, and `npm run build` inside `frontend/`.
	- This confirms frontend dependencies install and production build succeeds.

2. `backend.yml`
	- Runs on backend changes.
	- Uses Python 3.11.
	- Installs `backend/requirements.txt` and runs backend test suite.
	- This does not run local setup scripts; it performs clean CI dependency install and test execution.

3. `docker-image.yml`
	- Runs Docker build checks on backend/docker workflow changes.
	- Verifies the root `Dockerfile` builds successfully in CI.

4. `docker-publish.yml`
	- Builds and publishes Docker image(s) to GHCR on `main` and version tags.

5. `render-cd.yml`
	- Optional Render deployment trigger workflow.
	- Supports backend deploy + healthcheck only.
	- On manual run (`workflow_dispatch`), pass:
		- `backend_deploy_hook_url`
		- `backend_healthcheck_url` (optional)
	- If these inputs are not provided, deploy/healthcheck steps are skipped and logged in workflow summary.

## Notes on Real vs Demo Behavior

1. Policy and DCI endpoints use live database values.
2. Demo endpoints under `/workers/me/demo/*` are simulation routes and can produce synthetic claim flows.
3. Razorpay fallback mode is used when payout credentials are missing/invalid.