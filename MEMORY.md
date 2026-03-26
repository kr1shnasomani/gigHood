# gigHood — Project Memory

_Last updated: 2026-03-24. Update this file whenever a phase is completed or a major decision is made._

---

## What This Project Is

**gigHood** is an AI-powered parametric income insurance platform for India's 15M+ gig delivery workers. It automatically detects zone-level earning collapse using the **Demand Collapse Index (DCI)** — a multi-signal spatial ML model computed per H3 hex cell every 5 minutes — and pays workers via UPI in under 90 seconds, with zero paperwork.

Core innovation: DCI asks "Has earning *opportunity* collapsed?" (not just "Is it raining?"), eliminating basis risk via a sigmoid fusion of weather (W), traffic (T), platform status (P), and social disruption (S) signals.

Full product scope: `README.md` | Full technical spec: `IMPLEMENTATION.md`

---

## Current Development Phase

> **Phase 11 — Fraud Engine (7-Layer Defense)**

Phases 10 and 11 have been seamlessly executed sequentially. The backend now runs the mathematical Claim Approver routing claims identically using the 7-layer Fraud Evaluator bounding micro-deliveries and static GPS variances. It governs internal automated payouts bypassing mock stubs natively.

---

## What Exists in the Repository

| File/Directory | Status | Purpose |
|:---|:---|:---|
| `README.md` | ✅ Complete | Product vision, business context, full system narrative |
| `IMPLEMENTATION.md` | ✅ Complete | Authoritative technical spec — architecture, schemas, modules, pipeline logic, test plan |
| `TODO.md` | ✅ Complete | 18-phase, ~120-task atomic engineering roadmap ordered by dependency graph |
| `SETUP.md` & `setup.sh` | ✅ Complete | 1-click bootstrap scripts that set up local venvs, dependencies, and `.env` configs |
| `AGENTS.md` | ✅ Complete | Agent workflow rules, skill map, document hierarchy, execution strategy |
| `RULES.md` | ✅ Complete | Hard operational guardrails and prohibited actions for all agent sessions |
| `MEMORY.md` | ✅ This file | Persistent project state for future agents |
| `.agents/skills/` | ✅ Complete | 20 installed agent skills (see below) |
| `backend/` | ✅ Complete | FastAPI backend scaffold with empty API/service modules |
| `mobile/` | ❌ Not started | React Native (Expo) worker app |
| `admin/` | ❌ Not started | Next.js admin dashboard |
| `supabase/migrations/` | ❌ Not started | SQL schema migrations |
| `ml/` | ❌ Not started | XGBoost model artefacts |
| `venv/` | ✅ Complete | Python 3.11 virtual environment |
| `backend/requirements.txt` | ✅ Complete | FastAPI and data science dependencies |
| `backend/.env.example` | ✅ Complete | Required environment variables template |
| `backend/main.py` | ✅ Complete | FastAPI entry point with router registration |
| `backend/config.py` | ✅ Complete | Pydantic Settings implementation |

---

## Architecture at a Glance

5-layer system (fully specified in `IMPLEMENTATION.md` Section 2):

```
Layer 1: Signal Ingestion       → 5 fetchers (weather, AQI, traffic, platform, social)
Layer 2: Spatial Intelligence   → H3 hex grid (res 9) + DCI = σ(0.45W + 0.25T + 0.20P + 0.10S)
Layer 3: Policy Engine          → XGBoost Risk Profiler → Tier A/B/C → Weekly Premium
Layer 4: Claims Automation      → Trigger Monitor → PoP Validator → Fraud Engine → Payout
Layer 5: Payout & Presentation  → Razorpay UPI + React Native App + Next.js Admin + FCM
```

**DCI threshold:** >0.85 = DISRUPTED, 0.65–0.85 = ELEVATED WATCH, ≤0.65 = NORMAL

**Fraud defense:** 7-layer system; 4-path routing (Fast Track / Soft Queue / Active Verify / Denied) based on compound fraud score (0–150) and Gate 2 (platform order activity).

---

## Tech Stack Decided

| Layer | Technology |
|:---|:---|
| Backend API | Python + FastAPI + APScheduler |
| Database | Supabase (PostgreSQL + PostGIS) |
| Spatial | `h3-py` (Python-side H3 computation — PostGIS H3 extension not relied upon) |
| ML | XGBoost + Scikit-learn |
| Worker App | React Native (Expo) |
| Admin Dashboard | Next.js + Tailwind CSS (Vercel free tier) |
| Payments | Razorpay Sandbox (UPI) |
| Notifications | Firebase Cloud Messaging (FCM) |
| AI Chat | OpenRouter / Groq API |
| Hosting | Render free tier (backend) |

---

## Database Schema (10 Tables — Not Yet Created)

All migrations to be written in `supabase/migrations/` in order:

1. `workers` — gig worker profiles with trust_score, hex_id, UPI ID, device fingerprint
2. `hex_zones` — H3 cells with PostGIS geometry, current_dci, dci_status
3. `policies` — weekly policies with tier (A/B/C), premium, waiting period flag
4. `signal_cache` — raw + normalized signals per hex per signal type
5. `dci_history` — time-series DCI scores with W/T/P/S components
6. `location_pings` — worker PoP pings every 15min with GPS, accuracy, mock_location_flag
7. `disruption_events` — DCI threshold crossings with start/end timestamps
8. `claims` — insurance claims with fraud_score, resolution_path, razorpay_payment_id
9. `fraud_flags` — individual fraud flag records per claim
10. `premium_payments` — weekly premium debit records

Full schema (all columns, types, FKs): `IMPLEMENTATION.md` Section 5.

---

## Key Technical Decisions Made

- **H3 computed in Python** (`h3-py`), not in-database — Supabase free tier may not have H3 extension enabled
- **APScheduler runs in-process** inside FastAPI (not a separate worker) — acceptable for MVP/demo
- **All external signals except OpenWeatherMap and CPCB are mocked** — traffic, platform, and social signals are simulated
- **Gate 2 (platform order activity) is the primary hard gate** for claim approval — most critical fraud defense layer
- **DCI cold-start weights:** α=0.45, β=0.25, γ=0.20, δ=0.10 — updated weekly via XGBoost retrain
- **Waiting period:** 7 days for new workers; coverage capped at zone 50th percentile during this period
- **Razorpay sandbox only** — no live UPI transactions in MVP
- **Multi-language AI chat:** Hindi, English, Tamil, Telugu, Kannada — read-only, no policy modification

---

## Installed Agent Skills

| Skill | Use For |
|:---|:---|
| `supabase-postgres-best-practices` | RLS policies, migrations, Supabase schema |
| `postgres-patterns` | SQL queries, indexes, transactions |
| `supabase-database` | Supabase client patterns, RLS enforcement |
| `python-backend` | FastAPI routes, async patterns, dependency injection |
| `python-testing` | pytest, fixtures, mocking external APIs |
| `xgboost-lightgbm` | Risk Profiler training, hyperparameter tuning, SHAP |
| `api-testing` | FastAPI endpoint integration tests |
| `nextjs-development` | Admin dashboard pages, routing |
| `ui-mobile` | React Native screens, navigation |
| `payment-integration` | Razorpay webhooks, sandbox testing |
| `shadcn-ui` | Admin UI components |
| `react-components` | Shared frontend component patterns |
| `frontend-design` | Design system, layout |
| `web-design-guidelines` | Accessibility, typography |
| `design-md` | Generating structured markdown design documents |
| `enhance-prompt` | Improving agent prompts before execution |
| `find-skills` | Discovering and installing new skills from skills.sh |
| `remotion` | Video/animation generation (not relevant for core system) |
| `skill-creator` | Scaffolding new custom skills |
| `stitch-loop` | UI prototyping with Stitch (not relevant for core system) |

---

## Roadmap Progress

| Phase | Description | Status |
|:---|:---|:---|
| **Phase 0** | Repo & environment setup | ✅ Complete |
| **Phase 1** | Database schema & Supabase migrations | ✅ Complete |
| **Phase 2** | H3 Spatial grid module | ✅ Complete |
| **Phase 3** | Signal ingestion (5 fetchers) | ✅ Complete |
| **Phase 4** | DCI computation engine | ✅ Complete |
| **Phase 5** | APScheduler integration | ✅ Complete |
| **Phase 6** | Auth module (OTP + JWT) | ✅ Complete |
| **Phase 7** | Policy engine (XGBoost + premium bander) | ✅ Complete |
| **Phase 8** | Weekly premium debit scheduler job | ✅ Complete |
| **Phase 9** | Razorpay payment service | ✅ Complete |
| **Phase 10** | Claims automation pipeline | ✅ Complete |
| **Phase 11** | 7-layer fraud engine | ✅ Complete |
| **Phase 12** | FCM notification service | ⬜ Not started |
| **Phase 13** | Worker mobile app (React Native) | ⬜ Not started |
| **Phase 14** | Admin dashboard (Next.js) | ⬜ Not started |
| **Phase 15** | AI chat assistant | ⬜ Not started |
| **Phase 16** | Forecasting + weekly retrain jobs | ⬜ Not started |
| **Phase 17** | Integration testing & validation | ⬜ Not started |

---

## Next Task for a New Agent

**Start at Phase 12, Task 1 in `TODO.md`:**

Please execute the `Phase 12` sequence in `TODO.md` regarding FCM notifications:
1. Link Firebase push APIs cleanly mapped across trigger bounds alerting workers.
2. Build Worker App architecture in `Phase 13`.

> Before writing any code, read `MEMORY.md` → `TODO.md` → `IMPLEMENTATION.md` Section 3 → `RULES.md` in that order.
