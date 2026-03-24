# gigHood — Agent Rules

Operational rules for all AI coding agents working on this repository. Follow these rules in every session, without exception.

---

## R1 — Read Before You Write

Before writing any code, you must read:

1. `MEMORY.md` — understand the current project state and what has already been built
2. `TODO.md` — identify the current phase and the specific task you are implementing
3. `IMPLEMENTATION.md` Section 3 — read the module spec (inputs, outputs, connections) for the module you are about to implement
4. `AGENTS.md` — review agent skills and workflow rules

Do not write code based on assumptions. If you are unsure about a specification, re-read `IMPLEMENTATION.md` before proceeding.

---

## R2 — Follow the Roadmap in Order

- Work through `TODO.md` sequentially, phase by phase.
- Do not start a phase until all tasks in the previous phase are complete.
- Do not skip tasks. Every task in `TODO.md` exists because it is a dependency for something downstream.
- If a task is partially complete, finish it before starting a new one.

**Why this matters:** The gigHood system has strict dependency layers (e.g., schema → spatial → signals → DCI → triggers → claims). Out-of-order implementation causes integration failures.

---

## R3 — IMPLEMENTATION.md Is Law

- `IMPLEMENTATION.md` is the single source of technical truth.
- Do not deviate from the architecture, module boundaries, data model, or pipeline logic defined there.
- Do not introduce new libraries, new modules, or new design patterns unless `IMPLEMENTATION.md` explicitly requires them.
- If something seems unclear, re-read the relevant section. Do not invent a solution.

**Specifically locked (do not change without explicit instructions):**
- DCI formula: `σ(0.45·W + 0.25·T + 0.20·P + 0.10·S)`
- DCI thresholds: `>0.85 = DISRUPTED`, `0.65–0.85 = ELEVATED`, `≤0.65 = NORMAL`
- 4-path fraud routing logic (Fast Track / Soft Queue / Active Verify / Denied)
- Fraud score layer weights (Layer 1: 30pts, Layer 2: 40pts, Layer 4: 20pts, Layer 5: 25pts)
- Payout formula: `(avg_daily_earnings ÷ 8) × disrupted_hours`
- Tier coverage caps: ₹600/700/800 per day
- Payout maturation cap: ≤ 2.5× 4-week average daily payout

---

## R4 — One Task Per Session

- Implement one checklist task from `TODO.md` at a time.
- A task is complete when its code is written, its unit tests pass, and it integrates correctly with what came before.
- Do not bundle multiple tasks into one large change.
- Do not refactor unrelated code while implementing a task.

---

## R5 — Module Boundaries Are Hard Walls

Each service in `backend/services/` has defined inputs, outputs, and connections (see `IMPLEMENTATION.md` Section 3). Do not:

- Call a service from a layer it is not supposed to interact with
- Move business logic into API route handlers
- Share mutable state directly between services (use the database as the shared state layer)
- Let a downstream module reach back into an upstream module

**Correct flow:** Signal fetchers → DCI engine → Trigger monitor → Claim approver → Payment service. No skipping, no reversals.

---

## R6 — Database Safety

- All schema changes must be written as new migration files in `supabase/migrations/` — never alter existing migration files.
- Never mutate schema from application code (no `CREATE TABLE` or `ALTER TABLE` in Python).
- Migrations must be numbered sequentially and applied in order.
- Enable RLS on every table. Use the `supabase-postgres-best-practices` skill for policy patterns.
- Do not query without filtering by the correct owner/worker context where applicable.

---

## R7 — Preserve Mocked Data Boundaries

The following are intentionally mocked in the MVP. Do not attempt to replace them with real integrations:

- Traffic signal source (mock — Google Maps is not free)
- Platform order activity (mock — no real Zepto/Blinkit API access)
- Social/government alert feed (mock — no real-time API exists)
- Razorpay (sandbox mode only — no live UPI transactions)

When implementing these mocks, make them deterministic and clearly labelled (e.g., function name `mock_platform_order_activity()`).

---

## R8 — Write Tests Alongside Code

- Every new service function must have at least one unit test written in the same session.
- Use the exact input/output examples from `IMPLEMENTATION.md` Section 8.1 and 8.3 as test cases.
- Use the `python-testing` skill for pytest patterns and the `api-testing` skill for endpoint tests.
- Tests must pass before marking a task as complete in `TODO.md`.

---

## R9 — Use Agent Skills

Before implementing any complex pattern, check `.agents/skills/` for a relevant skill:

- Writing FastAPI routes → `python-backend`
- Writing SQL or migrations → `postgres-patterns`, `supabase-postgres-best-practices`
- Training XGBoost → `xgboost-lightgbm`
- Writing pytest tests → `python-testing`
- Building Next.js pages → `nextjs-development`
- Building React Native screens → `ui-mobile`
- Integrating payments → `payment-integration`

Using an existing skill is always preferred over inventing a new pattern from scratch.

---

## R10 — Update MEMORY.md After Each Phase

When a phase from `TODO.md` is complete:

1. Mark completed tasks in `TODO.md` as `[x]`
2. Update `MEMORY.md` — change the phase status from ⬜ to ✅ and update the "Next Task" section
3. Note any important implementation decisions that differ from the plan

This ensures future agents have accurate state and do not duplicate work.

---

## R11 — Never Do These Things

| Prohibited Action | Reason |
|:---|:---|
| Change the DCI formula or weights outside the ML retrain pipeline | Breaks calibrated scoring |
| Modify existing migration files | Corrupts schema version history |
| Add a new table without a migration file | Schema becomes untracked |
| Write business logic in API route handlers | Violates module boundary rules |
| Use `SELECT *` in production queries | Returns unintended data; use explicit column lists |
| Hardcode API keys or secrets in any source file | Security violation |
| Skip writing tests for a new module | Violates R8 |
| Implement a later phase before completing the current one | Violates dependency order |
| Introduce a new framework or major library without justification | Deviates from defined tech stack |
| Modify another module while implementing a task | Creates untracked side effects |

---

## R12 — Clarify, Don't Assume

If a task in `TODO.md` is ambiguous:

1. Re-read the referenced section of `IMPLEMENTATION.md` first
2. Check `MEMORY.md` for any decisions that have already resolved the ambiguity
3. Check Section 9 of `IMPLEMENTATION.md` (Risks / Ambiguities) — many edge cases are pre-resolved there
4. If still unclear, implement the minimal safe interpretation and leave a comment explaining the assumption
