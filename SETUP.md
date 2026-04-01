# gigHood Setup Guide

This guide provides two supported setup options:

1. Script-based local development (recommended for daily coding)
2. Docker-based development (recommended for parity)

## Defaults

1. App default language: English (`en`)
2. Backend URL: `http://127.0.0.1:8001`
3. Frontend URL: `http://localhost:3000`

## Prerequisites

1. Python 3.11+
2. Node.js 20+
3. npm 10+
4. Docker Desktop (Docker option only)

## Option A: Script-Based Local Setup

### 1) Start from project root

```bash
cd /Users/apple/Documents/Projects/gigHood
```

### 2) Bootstrap backend

Mac/Linux:

```bash
chmod +x setup.sh
./setup.sh
```

Windows:

```bat
setup.bat
```

What this does:

1. Creates `venv`
2. Installs backend dependencies
3. Prepares env template

### 3) Configure backend env

Populate `backend/.env` with:

1. `SUPABASE_URL`
2. `SUPABASE_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `GROQ_API_KEY`
5. `OPENROUTER_API_KEY`
6. `RAZORPAY_KEY_ID`
7. `RAZORPAY_KEY_SECRET`
8. `JWT_SECRET`
9. `FIREBASE_CREDENTIALS_PATH`

### 4) Run backend

Mac/Linux:

```bash
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

Windows:

```bat
venv\Scripts\activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

### 5) Run frontend

Open a second terminal:

```bash
cd /Users/apple/Documents/Projects/gigHood/frontend
npm install
npm run dev
```

Worker app routes:

1. `/worker-app/login`
2. `/worker-app/register`
3. `/worker-app/home`
4. `/worker-app/chat`
5. `/worker-app/payouts`
6. `/worker-app/profile`

Alias routes (`/login`, `/home`, etc.) redirect to `/worker-app/*`.

## Option B: Docker Setup

### 1) Start from project root

```bash
cd /Users/apple/Documents/Projects/gigHood
```

### 2) Ensure env file exists

1. Create or update `backend/.env`
2. Confirm required keys are present

### 3) Build and run

```bash
docker compose up --build -d
```

### 4) Stop containers

```bash
docker compose down
```

### 5) Clean rebuild (optional)

```bash
docker compose down -v
docker compose up --build -d
```

## Quick Verification

1. Backend docs open at `http://127.0.0.1:8001/docs`
2. Frontend opens at `http://localhost:3000`
3. Login flow works from `/worker-app/login`
4. Home route works after auth at `/worker-app/home`
5. Language selector appears on Home and defaults to English

## Common Pitfalls

1. Running backend from wrong directory
- Always run `uvicorn backend.main:app ...` from repo root

2. Running frontend from old path
- Use `frontend/`, not `frontend/worker-app`

3. Missing virtual environment activation
- Activate `venv` before backend commands

4. Expecting non-English default
- Default is English; users can change language on Home
