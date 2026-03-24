# gigHood — Engineering Roadmap

> **Source of Truth:** All architecture, schemas, module specs, and pipeline logic are defined in `IMPLEMENTATION.md`.
> This roadmap translates that document into an ordered, atomic task checklist for AI coding agents.
> Work phase-by-phase. Do not skip ahead. Each phase depends on the previous.

---

## Phase 0 — Repository & Environment Setup

_Prerequisite to everything. No code can be written without this foundation._

- [ ] Create root directory structure: `backend/`, `mobile/`, `admin/`, `supabase/migrations/`, `ml/`
- [ ] Create `backend/requirements.txt` with all dependencies: `fastapi`, `uvicorn`, `pydantic`, `apscheduler`, `httpx`, `python-jose`, `xgboost`, `scikit-learn`, `numpy`, `pandas`, `h3`, `shapely`, `supabase`, `asyncpg`, `razorpay`, `firebase-admin`
- [ ] Create `backend/.env.example` with all required env vars: `SUPABASE_URL`, `SUPABASE_KEY`, `OPENWEATHER_API_KEY`, `CPCB_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `FIREBASE_CREDENTIALS_PATH`, `OPENROUTER_API_KEY`, `JWT_SECRET`
- [ ] Create `backend/main.py` — FastAPI app entry point with lifespan handler and router registration skeleton
- [ ] Create `backend/config.py` — Pydantic `Settings` class loading from `.env`
- [ ] Create `backend/api/__init__.py` and empty router files: `workers.py`, `policies.py`, `claims.py`, `notifications.py`, `chat.py`, `admin.py`
- [ ] Create `backend/services/` directory with empty files: `dci_engine.py`, `signal_fetchers.py`, `spatial.py`, `policy_manager.py`, `risk_profiler.py`, `premium_bander.py`, `trigger_monitor.py`, `pop_validator.py`, `payout_calculator.py`, `claim_approver.py`, `fraud_engine.py`, `payment_service.py`, `notification_service.py`
- [ ] Create `backend/scheduler/jobs.py` — APScheduler instance (not yet wired)
- [ ] Create `backend/models/` directory with Pydantic schemas file `schemas.py` (empty for now)
- [ ] Set up Python virtual environment and install all dependencies from `requirements.txt`
- [ ] Verify FastAPI app starts: `uvicorn backend.main:app --reload`

---

## Phase 1 — Database Schema & Supabase Setup

_All modules depend on these tables existing. Schema must be stable before any service is built._

- [ ] Create Supabase project (free tier) and copy `SUPABASE_URL` and `SUPABASE_KEY` to `.env`
- [ ] Enable PostGIS extension on Supabase via the dashboard SQL editor: `CREATE EXTENSION IF NOT EXISTS postgis;`
- [ ] Write migration `supabase/migrations/001_create_workers.sql` — `workers` table with all columns from `IMPLEMENTATION.md` Section 5.1 including `trust_score`, `status` enum, `hex_id`, `device_model`, `sim_carrier`, `sim_registration_date`
- [ ] Write migration `supabase/migrations/002_create_hex_zones.sql` — `hex_zones` table with PostGIS `centroid` and `boundary` columns, `dci_status` enum
- [ ] Write migration `supabase/migrations/003_create_policies.sql` — `policies` table with `tier` enum, `status` enum, `is_waiting_period` flag, FK → `workers`
- [ ] Write migration `supabase/migrations/004_create_signal_cache.sql` — `signal_cache` table with `signal_type` enum and `JSONB raw_data`
- [ ] Write migration `supabase/migrations/005_create_dci_history.sql` — `dci_history` table with component scores `w_score`, `t_score`, `p_score`, `s_score`, FK → `hex_zones`
- [ ] Write migration `supabase/migrations/006_create_location_pings.sql` — `location_pings` table with GPS fields, `accuracy_radius`, `mock_location_flag`, FK → `workers`
- [ ] Write migration `supabase/migrations/007_create_disruption_events.sql` — `disruption_events` table with `dci_peak`, `started_at`, `ended_at`, `duration_hours`, `trigger_signals JSONB`, FK → `hex_zones`
- [ ] Write migration `supabase/migrations/008_create_claims.sql` — `claims` table with `resolution_path` enum, `fraud_score`, `pop_validated`, `razorpay_payment_id`, FKs → `workers`, `policies`, `disruption_events`
- [ ] Write migration `supabase/migrations/009_create_fraud_flags.sql` — `fraud_flags` table with `flag_type`, `score_contribution`, `details JSONB`, FK → `claims`
- [ ] Write migration `supabase/migrations/010_create_premium_payments.sql` — `premium_payments` table with `razorpay_payment_id`, FKs → `workers`, `policies`
- [ ] Apply all migrations to Supabase in order and verify all tables are created
- [ ] Create `backend/db/client.py` — initialize Supabase Python client using env vars
- [ ] Write a smoke test: query all table names from `information_schema.tables` to confirm schema is live

---

## Phase 2 — Spatial Grid Module

_Signal fetchers and DCI engine both need H3 hex grid data. Spatial must exist first._

- [ ] Implement `backend/services/spatial.py` — `lat_lng_to_hex(lat, lng, resolution=9) -> str` using `h3-py`
- [ ] Implement `get_hex_centroid(hex_id: str) -> tuple[float, float]` — returns `(lat, lng)` of hex center
- [ ] Implement `get_hex_neighbors(hex_id: str, k_rings: int = 1) -> list[str]` — returns neighboring hex IDs
- [ ] Implement `seed_hex_zones(city: str, center_lat: float, center_lng: float, radius_km: float)` — generates H3 hex grid for a city and upserts all hex boundaries into `hex_zones` table
- [ ] Implement PostGIS geometry serialization: convert H3 boundary vertices to WKT `POLYGON` for storage in `hex_zones.boundary`
- [ ] Write unit tests for `spatial.py`: verify known lat/lng → expected H3 hex ID, verify boundary polygon is valid
- [ ] Run `seed_hex_zones` for one pilot city (e.g., Bengaluru) and verify rows inserted into `hex_zones`

---

## Phase 3 — Signal Ingestion

_DCI Engine (Phase 4) reads from `signal_cache`. Signal fetchers must be built first._

- [ ] Implement `backend/services/signal_fetchers.py` — base structure with `cache_signal(hex_id, signal_type, raw_data, normalized_score)` helper that writes to `signal_cache` table
- [ ] Implement `fetch_weather(hex_id: str, lat: float, lng: float) -> float` — call OpenWeatherMap API, extract `rain.1h` (mm), `wind.speed` (km/hr), `main.temp`; normalize to W score using documented formula
- [ ] Implement `fetch_aqi(hex_id: str, city: str) -> float` — call CPCB AQI API; map AQI index to 0–1+ severity score; combine with weather W score
- [ ] Implement `fetch_traffic(hex_id: str, lat: float, lng: float) -> float` — mock implementation returning random `T score` seeded from hex_id and current hour (deterministic mock)
- [ ] Implement `fetch_platform_status(hex_id: str) -> float` — mock implementation simulating order volume drop %; return `P score` as `order_drop_pct / 100`
- [ ] Implement `fetch_social_signals(hex_id: str, city: str) -> float` — mock government alert feed; return `S score` (0 = no alert, 1 = curfew/bandh)
- [ ] Implement `run_signal_ingestion_cycle(hex_ids: list[str])` — orchestrator that calls all 5 fetchers for each hex, caches results, tracks `source_available` per signal
- [ ] Write unit tests for normalization logic: 40mm/hr rain → W ≈ 0.85; AQI 350 → elevated W component
- [ ] Write unit test for degraded mode signal counting: verify `source_available` is correctly set when an API is unreachable

---

## Phase 4 — DCI Computation Engine

_Depends on spatial (hex IDs) and signal ingestion (cached scores). Core of the system._

- [ ] Implement `backend/services/dci_engine.py` — `sigmoid(x: float) -> float` function: `1 / (1 + exp(-x))`
- [ ] Implement `compute_dci(w: float, t: float, p: float, s: float, alpha=0.45, beta=0.25, gamma=0.20, delta=0.10) -> float` — applies the formula `σ(α·W + β·T + γ·P + δ·S)`
- [ ] Implement `get_dci_status(dci: float) -> str` — returns `'normal'` (≤0.65), `'elevated'` (0.65–0.85), or `'disrupted'` (>0.85)
- [ ] Implement `run_dci_cycle(hex_ids: list[str])` — for each hex: read latest signals from `signal_cache`, check ≥3 sources available, compute DCI, write to `dci_history`, update `hex_zones.current_dci` and `dci_status`
- [ ] Implement degraded mode: if <3 signal sources available for a hex, set `dci_status='normal'`, skip computation, log the degraded hex
- [ ] Write unit tests using the exact input/output examples from `IMPLEMENTATION.md` Section 8.1: `σ(0.45×1.0 + 0.25×0.8 + 0.20×0.9 + 0.10×0.5)` = `σ(0.88)` ≈ 0.707
- [ ] Write unit tests: `σ(0)=0.5`, `σ(2)≈0.88`, `σ(-2)≈0.12`
- [ ] Write unit test: extreme inputs (W=2.0, T=1.0, P=1.5, S=1.0) → verify DCI approaches but does not trivially exceed 0.85
- [ ] Write unit test: verify disruption threshold requires σ(x)>0.85, meaning x>1.73

---

## Phase 5 — APScheduler Integration

_Signal ingestion and DCI computation must exist before scheduling. Scheduler runs both in sequence._

- [ ] Implement `backend/scheduler/jobs.py` — initialize `BackgroundScheduler` from `apscheduler`
- [ ] Register `run_signal_ingestion_cycle` job: every 5 minutes at offset T+0
- [ ] Register `run_dci_cycle` job: every 5 minutes at offset T+1 minute (after ingestion)
- [ ] Register weekly Monday 00:00 job stub for premium debit and policy renewal (logic added in Phase 8)
- [ ] Register Sunday evening job stub for forecast + tier upgrade notifications (logic added in Phase 11)
- [ ] Register Sunday night job stub for XGBoost retrain (logic added in Phase 11)
- [ ] Wire scheduler startup into FastAPI `lifespan` event in `main.py`
- [ ] Verify scheduler starts on app boot and logs each job execution in console

---

## Phase 6 — Auth Module

_Worker registration and JWT auth must exist before policy or location ping endpoints can be secured._

- [ ] Implement `backend/services/auth_service.py` — `create_jwt(worker_id: str) -> str` and `decode_jwt(token: str) -> dict` using `python-jose`
- [ ] Implement `backend/api/workers.py` — `POST /auth/register`: accept phone, name, city, dark_store_zone, avg_daily_earnings, upi_id, device_model, device_os_version, sim_carrier, sim_registration_date; map dark store zone to H3 hex_id; insert into `workers` table; return JWT
- [ ] Implement `POST /auth/otp/send` — stub that logs OTP to console (mock OTP for demo)
- [ ] Implement `POST /auth/otp/verify` — verify OTP stub and issue JWT
- [ ] Implement `get_current_worker` FastAPI dependency that validates JWT and returns worker record
- [ ] Write unit test: register worker → JWT returned → JWT decoded → correct worker ID

---

## Phase 7 — Policy Engine

_Requires workers table (Phase 1), XGBoost model (below), and hex_zones (Phase 2)._

- [ ] Implement `backend/services/risk_profiler.py` — generate synthetic training data (12-week DCI history, seasonal flag, flood proximity, claim frequency) and train XGBoost classifier for Tier A/B/C; serialize model to `ml/risk_profiler.pkl`
- [ ] Implement `predict_tier(worker_hex_history: list[float], seasonal_flag: bool, flood_proximity: float, claim_frequency: float) -> str` — loads model and returns `'A'`, `'B'`, or `'C'`
- [ ] Write unit test for risk profiler: low DCI history → Tier A; high + flood proximity → Tier C
- [ ] Implement `backend/services/premium_bander.py` — `calculate_premium(tier: str, avg_dci_4w: float, month: int) -> float` applying tier base rates (₹20/28/30/42/42/59) and monsoon multiplier (1.4× for months 6–9)
- [ ] Write unit test: Tier A, avg DCI 0.35, non-monsoon → ₹20; Tier A, monsoon → ₹28
- [ ] Implement `backend/services/policy_manager.py` — `create_policy(worker_id: str)`: run risk profiler, assign tier, calculate premium, set dates, set `is_waiting_period=True` for new workers, insert into `policies`
- [ ] Implement `renew_policy(worker_id: str)` — create next-week policy record, no waiting period, activate Monday
- [ ] Implement `GET /workers/me/policy` API endpoint — return active policy for authenticated worker
- [ ] Implement `POST /policies/create` API endpoint — trigger policy creation for authenticated worker

---

## Phase 8 — Weekly Premium Debit (Scheduler Job)

_Requires policy_manager (Phase 7) and payment_service (Phase 9). Wire the Monday job._

- [ ] Implement `backend/scheduler/weekly_jobs.py` — `run_monday_policy_cycle()`: query all active workers, call `renew_policy()` for each, trigger premium debit via Razorpay for each active policy
- [ ] Wire `run_monday_policy_cycle` into the Monday 00:00 APScheduler job registered in Phase 5

---

## Phase 9 — Payment Service (Razorpay Sandbox)

_Required by claims pipeline (Phase 10) and premium debit (Phase 8)._

- [ ] Implement `backend/services/payment_service.py` — initialize Razorpay client using `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- [ ] Implement `initiate_upi_payout(upi_id: str, amount_rupees: float, reference_id: str) -> dict` — call Razorpay sandbox payout API; return `razorpay_payment_id`
- [ ] Implement `handle_payout_webhook(payload: dict, signature: str) -> bool` — verify Razorpay webhook signature; return True if payment confirmed
- [ ] Implement `POST /webhooks/razorpay` FastAPI endpoint — call `handle_payout_webhook`, update claim status to `'paid'` on confirmation
- [ ] Write unit test: mock Razorpay API response → verify `razorpay_payment_id` stored correctly

---

## Phase 10 — Claims Automation Pipeline

_Depends on DCI engine (Phase 4), spatial (Phase 2), policy engine (Phase 7), payment service (Phase 9)._

#### Trigger Monitor

- [ ] Implement `backend/services/trigger_monitor.py` — `check_trigger_transitions(hex_id: str, new_dci: float)` — detect DCI crossing 0.85 up (create `disruption_event`) or down (close event with `ended_at` and `duration_hours`)
- [ ] Implement `get_active_policyholders_in_hex(hex_id: str) -> list[str]` — query `workers` + `policies` for all workers in hex with active policy
- [ ] Call `trigger_monitor.check_trigger_transitions` at end of each `run_dci_cycle` iteration

#### PoP Validator

- [ ] Implement `backend/services/pop_validator.py` — `validate_pop(worker_id: str, hex_id: str, disruption_start: datetime) -> dict` — query `location_pings` for pings in the specified hex within `disruption_start - 90min` to `disruption_start`
- [ ] Return `{'present': True/False, 'ping_count': int, 'zone_hop_flag': bool}`
- [ ] Write unit test: worker with 3 pings in hex within 90min → `present=True`
- [ ] Write unit test: worker with 0 pings in hex → `present=False, zone_hop_flag=True`

#### Payout Calculator

- [ ] Implement `backend/services/payout_calculator.py` — `calculate_payout(avg_daily_earnings: float, disrupted_hours: float, tier: str, payout_history_4w: list[float]) -> float`
- [ ] Apply formula: `(avg_daily_earnings ÷ 8) × disrupted_hours`
- [ ] Apply daily coverage caps: ₹600 (Tier A), ₹700 (Tier B), ₹800 (Tier C)
- [ ] Apply maturation cap: payout ≤ 2.5× 4-week average daily payout
- [ ] Write unit tests: ₹600 earnings × 4 hours → ₹300; verify tier cap; verify maturation cap

#### Claim Approver

- [ ] Implement `backend/services/claim_approver.py` — `process_claim(worker_id: str, event_id: str, policy_id: str) -> dict` orchestrating PoP → Fraud Score → Path routing
- [ ] Implement `route_claim(fraud_score: int, gate2_result: str) -> str` — returns `'fast_track'`, `'soft_queue'`, `'active_verify'`, or `'denied'` per 4-path framework
- [ ] Write unit test: Gate2=STRONG + score<30 → `fast_track`; Gate2=NONE → `denied`
- [ ] Implement `execute_fast_track_payout(claim_id: str)` — call `payout_calculator`, call `payment_service.initiate_upi_payout`, update `claims.status='paid'`, trigger FCM notification
- [ ] Implement `POST /location-pings` API endpoint — accept and store worker location pings (requires JWT auth)
- [ ] Implement `GET /claims` API endpoint — return authenticated worker's claim history

---

## Phase 11 — Fraud Engine (7-Layer Defense)

_Depends on claims pipeline (Phase 10) and location_pings data being populated._

- [ ] Implement `backend/services/fraud_engine.py` — `FraudEvaluator` class with a `evaluate(worker_id, event_id, disruption_start) -> dict` method returning `{'fraud_score': int, 'flags': list, 'gate2_result': str}`
- [ ] Implement Gate 1 (Layer 1): GPS coordinate variance analysis — compute `std_dev` of lat/lng and `accuracy_radius` over 90min window from `location_pings`; if std_dev < threshold → `STATIC_DEVICE_FLAG` (+30 points)
- [ ] Implement Gate 2 (Layer 2): Platform order activity — mock API query for accepted/completed orders in 90min pre-disruption; return `'STRONG'` (≥1 order), `'WEAK'` (online, no orders), or `'NONE'` (offline)
- [ ] Implement Gate 3: Velocity check — compute distance/time between last out-of-hex ping and first in-hex ping; if >120 km/hr → `VELOCITY_VIOLATION` (+15 points)
- [ ] Implement Layer 4: OS mock location flag — count `mock_location_flag=True` pings in window; if >0 → `MOCK_LOCATION_FLAG` (+20 points)
- [ ] Implement Layer 5 — Cross-hex fingerprint graph: for each disruption event, group all claiming workers by `device_model`; flag `MODEL_CONCENTRATION` if >20% share same model; flag `REGISTRATION_COHORT` if >30% registered within same 7-day window; flag `MOCK_LOCATION_NETWORK` if >3 workers in same hex share mock location flag (+15 +10 points)
- [ ] Implement compound fraud score aggregation: sum all flag contributions → single integer 0–150
- [ ] Write unit tests: GPS static + Gate2 NONE + mock location → score=90 → Path 4; no flags + Gate2 STRONG → score=0 → Path 1
- [ ] Wire `FraudEvaluator` into `claim_approver.process_claim`

---

## Phase 12 — Notification Service

_Depends on Firebase setup and claims pipeline (Phase 10)._

- [ ] Set up Firebase project, download service account JSON, set `FIREBASE_CREDENTIALS_PATH` in `.env`
- [ ] Implement `backend/services/notification_service.py` — initialize `firebase_admin` app; implement `send_push(device_token: str, title: str, body: str, data: dict = {})`
- [ ] Implement notification templates for all 5 triggers: payout credited, disruption elevated watch, claim flagged for verification, degraded mode, proactive tier upgrade offer
- [ ] Implement `POST /workers/me/device-token` API endpoint — store FCM device token on worker record
- [ ] Wire notification calls into `execute_fast_track_payout` (payout credited) and trigger monitor (elevated watch)

---

## Phase 13 — Worker App (React Native / Expo)

_Depends on backend auth, policy, claims, and notification API endpoints being available._

- [ ] Initialize Expo project in `mobile/`: `npx create-expo-app mobile --template blank-typescript`
- [ ] Install navigation: `expo-router` or `@react-navigation/native`
- [ ] Install location: `expo-location`, `expo-task-manager`
- [ ] Install notifications: `expo-notifications`
- [ ] Create `mobile/services/api.ts` — typed API client pointing to FastAPI backend; attach JWT to all requests
- [ ] Create `mobile/services/auth.ts` — `register()`, `sendOtp()`, `verifyOtp()`, store JWT in `SecureStore`
- [ ] Implement Onboarding screen: phone number input → OTP → registration form (name, city, dark store zone, avg earnings, UPI ID)
- [ ] Implement Home screen: display active policy tier + weekly premium, live DCI score for worker's hex (color-coded), active coverage cap
- [ ] Implement Payout History screen: list of claims with amount, date, resolution path, status
- [ ] Implement background location task using `expo-task-manager`: ping every 15 minutes, include GPS coords, accuracy, network signal, mock location detection; POST to `/location-pings`
- [ ] Implement FCM push notification handler: display in-app notification on payout, alert, or verification request
- [ ] Implement Tier Upgrade prompt screen: shown when Sunday forecast predicts DCI > 0.75 for worker's hex

---

## Phase 14 — Admin Dashboard (Next.js)

_Depends on all backend API endpoints and DCI data being populated._

- [ ] Initialize Next.js project in `admin/`: `npx create-next-app admin --typescript --tailwind`
- [ ] Deploy to Vercel free tier; configure `NEXT_PUBLIC_API_URL` env var
- [ ] Create `admin/lib/api.ts` — typed server-side API client for backend
- [ ] Implement `GET /admin/hex-zones` backend endpoint — return all hex zones with current DCI score and status (admin-only, no JWT required for demo or use API key)
- [ ] Implement Live H3 Hex Map page — render `hex_zones` using `MapLibre GL` or `deck.gl`; color hexes by DCI status: green (normal), amber (elevated), red (disrupted)
- [ ] Implement Active Policies panel — table of workers grouped by tier and zone; total count
- [ ] Implement Trigger Event Log — real-time table of `disruption_events` with hex, DCI peak, duration, and affected worker count
- [ ] Implement Claims Table — list of `claims` with resolution path, payout amount, and status; filter by path (1/2/3/4)
- [ ] Implement Fraud Metrics panel — aggregate fraud flags by type, zone-hop rate, mock location network count
- [ ] Implement Payout Summary panel — total disbursed this week, average payout, loss ratio (payouts ÷ premiums collected)
- [ ] Implement `GET /admin/stats` backend endpoint — return aggregated claim, payout, and fraud summary

---

## Phase 15 — AI Chat Assistant

_Depends on worker auth (Phase 6) and policy/DCI data being available for context injection._

- [ ] Implement `backend/services/chat_service.py` — `build_context(worker_id: str) -> str` that fetches worker's active policy tier, current hex DCI, last payout, coverage cap, and formats as LLM prompt context
- [ ] Implement `query_llm(context: str, user_message: str, language: str) -> str` — call OpenRouter/Groq API with system context and user message; return plain-language response
- [ ] Implement `POST /chat` API endpoint — accept worker message and optional language code; inject context; return LLM response
- [ ] Implement Chat screen in mobile app: text input, message history, language selector (Hindi, English, Tamil, Telugu, Kannada)

---

## Phase 16 — Forecasting & Weekly Retrain (Scheduler Jobs)

_Depends on DCI history, risk profiler, and notification service all being live._

- [ ] Implement `backend/scheduler/forecast_jobs.py` — `run_sunday_forecast()`: for each active hex, use 7-day weather forecast from OpenWeatherMap + historical DCI patterns from `dci_history` to predict next-week risk score
- [ ] If predicted score > 0.75 for a hex → call `notification_service` for all workers in that hex with tier upgrade offer
- [ ] Implement `POST /policies/upgrade-tier` endpoint — accept worker upgrade confirmation; update next week's policy tier before Monday billing runs
- [ ] Implement `run_weekly_retrain()` — collect claims data from past week; retrain XGBoost risk band classifier on updated features; update model in `ml/risk_profiler.pkl`; retrain DCI weight optimizer (placeholder — log updated weights)
- [ ] Wire both jobs into Sunday APScheduler slots registered in Phase 5

---

## Phase 17 — Integration Testing & Validation

_Runs only after all phases above are complete. Validates the full pipeline end-to-end._

- [ ] Write integration test: inject mock signals causing `DCI > 0.85` for a test hex → verify `disruption_event` created → verify claims initiated for all policyholders in hex
- [ ] Write integration test: honest worker (valid pings + confirmed orders) → verify Path 1 routing → verify Razorpay sandbox payout initiated → verify claim status = `'paid'`
- [ ] Write integration test: zone-hopper (0 pings in hex) → verify `zone_hop_flag=True` → verify Path 4 denial
- [ ] Write integration test: `DCI = 0.72` (elevated, not disrupted) → verify no claim created → verify elevated watch notification sent
- [ ] Write integration test: degraded mode (2/5 signals available) → verify DCI computation skipped → verify hex marked degraded
- [ ] Write integration test: full weekly lifecycle — Monday premium debit → Sunday forecast → upgrade offer → verify next-week policy reflects new tier
- [ ] Run all unit tests from Phases 4–11 together and confirm zero failures
- [ ] Validate DCI formula math against the Bengaluru example in `IMPLEMENTATION.md` Section 8.3
- [ ] Verify all 9 debugging checkpoints from `IMPLEMENTATION.md` Section 8.4 pass in sequence
- [ ] Deploy backend to Render free tier; confirm scheduler runs and API is reachable
- [ ] Final smoke test: register a worker via mobile app → view policy on home screen → simulate disruption event → verify payout notification received
