# AGENTS.md — gigHood

## 1. Project Context

**gigHood** is an AI-powered parametric income insurance platform for India's 15M+ gig delivery workers (Zepto, Blinkit, Swiggy Instamart). It auto-detects zone-level earning collapse using the **Demand Collapse Index (DCI)** — a multi-signal spatial ML model computed per H3 hex cell every 5 minutes — and pays workers via UPI within 90 seconds, with zero paperwork and 7-layer fraud defense.

See `README.md` for full product vision and problem context.

---

## 2. Source of Truth

| Document | Role |
|:---|:---|
| `IMPLEMENTATION.md` | **Authoritative technical specification** — architecture, modules, data models, pipeline stages, phased roadmap, testing plan |
| `README.md` | Product intent, business context, and user-facing system descriptions |
| `TODO.md` | **Ordered engineering roadmap** — 18 phases, ~120 atomic tasks; defines what to build next |
| `MEMORY.md` | **Persistent project state** — current phase, what is built, what is pending; update after each phase |
| `RULES.md` | **Operational guardrails** — specific do/don't rules and prohibited actions for agent sessions |

**Agents must follow `IMPLEMENTATION.md` for all technical decisions.** If there is a conflict between `README.md` and `IMPLEMENTATION.md`, `IMPLEMENTATION.md` wins.

---

## 3. Development Workflow

1. **Start every session** by reading `MEMORY.md` to understand current project state.
2. **Pick the next task** from `TODO.md` — work sequentially, do not skip phases.
3. **Before writing any code**, read the relevant section(s) of `IMPLEMENTATION.md` for the module you are implementing.
4. **Read `RULES.md`** for a full list of operational guardrails and prohibited actions.
5. **Work module-by-module** as defined in `IMPLEMENTATION.md` Section 3. Do not mix concerns across modules.
6. **Build minimal working implementations first**, then add error handling, retries, and robustness.
7. **Verify against the testing plan** in `IMPLEMENTATION.md` Section 8 before considering a module complete.
8. **After completing a phase**, update `TODO.md` (mark tasks `[x]`) and update `MEMORY.md` (change phase status, update next task).

### Phase Order (from `TODO.md`)

| Phase | Focus |
|:---|:---|
| 0 | Repo & environment setup |
| 1 | Database schema & Supabase migrations (10 tables) |
| 2 | H3 Spatial grid module |
| 3 | Signal ingestion (5 fetchers) |
| 4 | DCI computation engine |
| 5 | APScheduler integration |
| 6 | Auth module (OTP + JWT) |
| 7 | Policy engine (XGBoost risk profiler + premium bander) |
| 8 | Weekly premium debit scheduler job |
| 9 | Razorpay payment service |
| 10 | Claims automation pipeline |
| 11 | 7-layer fraud engine |
| 12 | FCM notification service |
| 13 | Worker mobile app (React Native) |
| 14 | Admin dashboard (Next.js) |
| 15 | AI chat assistant |
| 16 | Forecasting + weekly retrain jobs |
| 17 | Integration testing & validation |

See `TODO.md` for all atomic tasks within each phase.

---

## 4. Agent Skills

Reusable skills are in `.agents/skills/`. **Check for a relevant skill before implementing complex functionality.** Prefer using an existing skill over recreating patterns from scratch.

| Skill | Use When |
|:---|:---|
| `supabase-postgres-best-practices` | Writing migrations, enabling RLS, designing table schemas |
| `postgres-patterns` | Writing complex SQL queries, indexes, transactions |
| `supabase-database` | Supabase client queries, RLS policy enforcement, migrations |
| `python-backend` | FastAPI route design, async patterns, dependency injection |
| `python-testing` | pytest fixtures, unit tests, mocking external APIs |
| `xgboost-lightgbm` | Training the Risk Profiler model, hyperparameter tuning, SHAP values |
| `api-testing` | Integration testing FastAPI endpoints |
| `nextjs-development` | Admin Dashboard pages, routing, server components |
| `ui-mobile` | React Native screens, navigation, mobile UX patterns |
| `payment-integration` | Razorpay webhook handling, idempotency, sandbox testing |
| `shadcn-ui` | Admin Dashboard UI components |
| `react-components` | Shared frontend component patterns |
| `frontend-design` | Design system, color palette, layout patterns |
| `web-design-guidelines` | Accessibility, responsive design, typography |

---

## 5. Implementation Rules

- **Do not invent new architecture.** Follow the 5-layer architecture defined in `IMPLEMENTATION.md` Section 2.
- **Respect module boundaries.** Each module listed in Section 3 has defined inputs, outputs, and connections — do not cross them.
- **Use the defined tech stack** (FastAPI, React Native, Next.js, Supabase/PostGIS, H3, XGBoost, APScheduler, Razorpay).
- **Do not introduce new libraries** without justification. If a skill already covers a pattern, use it.
- **Avoid large refactors** unless a phase explicitly requires restructuring.
- **DCI formula is fixed:** `DCI_h = σ(0.45·W + 0.25·T + 0.20·P + 0.10·S)` — do not change weights without updating the ML optimization logic simultaneously.

---

## 6. File Structure Discipline

Follow the project structure from `IMPLEMENTATION.md` Section 6.1:

```
gigHood/
├── backend/              # FastAPI — signal fetchers, DCI engine, policy, claims, fraud
│   ├── api/              # Route handlers
│   ├── services/         # Business logic (dci, fraud, policy, payout)
│   ├── models/           # Pydantic schemas
│   └── scheduler/        # APScheduler jobs
├── mobile/               # React Native (Expo) — worker app
├── admin/                # Next.js — admin dashboard
├── supabase/
│   └── migrations/       # SQL migrations only, applied via Supabase CLI
└── ml/                   # XGBoost training scripts, model artefacts
```

- Do not create modules outside this structure.
- All schema changes go through `supabase/migrations/` — never mutate via raw SQL in application code.

---

## 7. Testing Expectations

- Write **unit tests alongside every new module** using `pytest` (use the `python-testing` skill).
- **DCI formula test:** Validate `σ(0.45·W + 0.25·T + 0.20·P + 0.10·S)` produces expected results against worked examples in `IMPLEMENTATION.md` Section 8.3.
- **Fraud score test:** Validate the 4-path routing logic routes claims correctly based on compound score thresholds.
- **Pipeline integration test:** After Phase 4, run the end-to-end signal → DCI → trigger → claim → payout flow using mocked external APIs.
- Use the `api-testing` skill for FastAPI endpoint integration tests.

---

## 8. Safe Modification Guidelines

- **Do not modify the database schema** (Section 5 of `IMPLEMENTATION.md`) unless a phase explicitly requires it. If you must, create a new migration file — never alter existing ones.
- **Do not change DCI signal weights** (α, β, γ, δ) outside the ML optimization module.
- **Do not alter fraud gate thresholds** without updating the 4-path routing logic consistently.
- **If you modify a pipeline stage**, check all downstream stages for consistency (e.g., changing PoP output format must be reflected in the Claim Approver).
- **Prefer additive changes** — new columns, new endpoints — over modifications to existing ones.

---

## 9. Agent Execution Strategy

When given a task, follow this sequence:

```
1. Read MEMORY.md — understand current state and what is already built
2. Read TODO.md — identify the exact task to implement
3. Read IMPLEMENTATION.md Section 3 — get module inputs/outputs/connections
4. Read RULES.md — confirm no guardrails apply to this task
5. Check .agents/skills/ for a relevant skill
6. Implement minimal working functionality
7. Write unit tests using the examples from IMPLEMENTATION.md Section 8
8. Verify the module connects correctly to adjacent modules
9. Mark task [x] in TODO.md and update MEMORY.md
```

**Do not write code without first reading MEMORY.md and identifying the exact TODO.md task.**
