# gigHood — Implementation Plan

## 1. Project Overview

### Problem Statement

India's 15M+ gig delivery workers (Zepto, Blinkit, Swiggy Instamart) lose 20–30% of monthly income to external disruptions — heavy rain, AQI spikes, curfews, platform outages — with zero financial protection. Traditional insurance is slow, paperwork-heavy, and structurally incompatible with weekly earning cycles.

### What gigHood Solves

gigHood is an **AI-powered parametric income insurance platform** that:

1. **Detects** zone-level economic collapse using the **Demand Collapse Index (DCI)** — a multi-signal spatial ML model computed per H3 hex cell every 5 minutes
2. **Validates** worker presence via **Time-Decay Proof-of-Presence (PoP)** engine — encrypted H3 hex pings every 15 minutes
3. **Pays** workers automatically via UPI within 90 seconds — zero paperwork, zero claims filing
4. **Prevents fraud** using a 7-layer adversarial defense architecture with a compound fraud probability score

### Core Innovation

The DCI asks **"Has earning opportunity in this zone collapsed?"** — not just "Is it raining?" This eliminates basis risk (rain can sometimes increase Q-commerce orders). The DCI fuses weather, traffic, platform status, and social disruption signals through a deterministic sigmoid function with ML-optimized weights.

---

## 2. System Architecture

### 2.1 Architecture Overview

The system is composed of **5 primary layers** plus an integrated **fraud intelligence layer**:

```
┌─────────────────────────────────────────────────────────────────┐
│                   LAYER 1: SIGNAL INGESTION                     │
│  OpenWeatherMap │ CPCB AQI │ Traffic Mock │ Platform Mock │ Gov │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                LAYER 2: SPATIAL INTELLIGENCE                    │
│         H3 Hex Grid (Res 9, ~1.2km) + DCI Computation          │
│           DCI_h = σ(αW + βT + γP + δS) per hex, every 5min     │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│ LAYER 3: POLICY ENGINE   │   │   LAYER 4: CLAIMS AUTOMATION     │
│ Risk Profiler (XGBoost)  │   │   Trigger Monitor (DCI > 0.85)   │
│ Weekly Premium Bander    │   │   PoP Validator                   │
│ Policy Manager           │   │   Fraud Engine (Compound Score)   │
│ (create/renew/coverage)  │   │   Claim Approver (4-Path)         │
└──────────┬───────────────┘   └────────────────┬─────────────────┘
           │                                     │
           ▼                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 5: PAYOUT & PRESENTATION                     │
│   UPI Payout (Razorpay) │ Worker App (React Native) │ Admin     │
│   FCM Notifications     │ AI Chat Assistant         │ Dashboard │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow — End-to-End Disruption-to-Payout

```
1. External APIs emit raw signals every 5 minutes
       │
2. Signals mapped to H3 hex cells (resolution 9)
       │
3. DCI computed per hex: σ(0.45·W + 0.25·T + 0.20·P + 0.10·S)
       │
4. DCI > 0.85 → hex declared DISRUPTED
       │
5. All active policyholders in hex identified
       │
6. PoP validated: worker pings in hex within 90min pre-disruption?
       │
7. Fraud gates evaluated: GPS variance → Order activity → Velocity
       │
8. Compound fraud score computed → routed to Path 1/2/3/4
       │
9. Payout calculated: (avg daily earnings ÷ 8) × disrupted hours
       │
10. UPI transfer via Razorpay Sandbox → push notification sent
```

### 2.3 Component Interaction Map

| Source Component | Target Component | Data Exchanged |
|:---|:---|:---|
| Signal APIs → DCI Engine | Raw weather/AQI/traffic/platform/social scores | Per-hex signal values |
| DCI Engine → Trigger Monitor | DCI score per hex | Float 0–1 |
| DCI Engine → Risk Profiler | 4-week rolling DCI history | Zone risk profile |
| Risk Profiler → Premium Bander | Risk band (A/B/C) | Tier assignment |
| Trigger Monitor → PoP Validator | Worker list + disruption timestamp | Presence query |
| PoP Validator → Claim Approver | Validation result + fraud flags | Pass/fail + score |
| Claim Approver → Razorpay | Payout amount + UPI ID | Transfer request |
| Razorpay → Worker App | Payout confirmation | Push notification |
| DCI Engine → Admin Dashboard | Live DCI grid | Hex map updates |
| Forecast Model → Worker App | Next-week risk score | Sunday alert |

---

## 3. Modules / Components Breakdown

### 3.1 Signal Ingestion Module

**Purpose:** Fetch, normalize, and cache external signal data for DCI computation.

| Sub-module | Input | Output | Details |
|:---|:---|:---|:---|
| Weather Fetcher | City coordinates | W score (0–1+) | OpenWeatherMap free tier — rainfall mm/hr, wind km/hr, temperature |
| AQI Fetcher | City/station ID | AQI value → W component | CPCB API — AQI index mapped to severity score |
| Traffic Fetcher | Hex centroid coords | T score (0–1) | Google Maps mock — congestion index |
| Platform Status Fetcher | Platform API endpoint | P score (0/1 + latency) | Simulated — order volume drop %, delivery app latency |
| Social Signal Fetcher | Gov alert feed | S score (0–1) | Mocked — curfew/strike/bandh detection |

**Connections:** Feeds directly into DCI Engine. Each fetcher runs independently on 5-minute APScheduler interval. Results cached in database.

### 3.2 Spatial Intelligence Module (DCI Engine)

**Purpose:** Compute the Demand Collapse Index per H3 hex cell.

| Input | Processing | Output |
|:---|:---|:---|
| Normalized signal scores (W, T, P, S) per hex | `DCI_h = σ(α·W + β·T + γ·P + δ·S)` with sigmoid normalization | DCI float [0, 1] per hex |

**Key Logic:**
- H3 resolution 9 cells (~1.2km diameter) — aligned with dark store delivery radius
- Cold-start weights: α=0.45, β=0.25, γ=0.20, δ=0.10
- Weights updated weekly via XGBoost retraining
- **Degraded mode:** If < 3 of 5 signal sources available → pause DCI for that hex, queue claims for manual review (2hr SLA)
- Threshold: DCI > 0.85 = DISRUPTED, 0.65–0.85 = ELEVATED WATCH, ≤ 0.65 = NORMAL

### 3.3 Policy Engine Module

**Purpose:** Manage worker policies, tiers, premiums, and coverage.

| Sub-module | Input | Output |
|:---|:---|:---|
| Risk Profiler | 12-week DCI history, seasonal patterns, flood proximity, claim frequency | Tier assignment (A/B/C) via XGBoost classifier |
| Premium Bander | 4-week rolling avg DCI, season flag | Weekly premium: ₹20/28 (A), ₹30/42 (B), ₹42/59 (C) |
| Policy Manager | Worker registration, UPI mandate | Active policy with coverage cap, waiting period tracking |

**Business Rules:**
- 7-day waiting period for new accounts (adverse selection protection)
- New accounts: coverage capped at zone 50th percentile for first 2 weeks
- Renewal accounts: no waiting period, coverage activates Monday
- Monsoon multiplier: 1.4× base premium (Jun–Sep)
- Weekly auto-debit via UPI every Monday

### 3.4 Claims Automation Module

**Purpose:** Detect disruptions, validate presence, calculate and execute payouts.

| Sub-module | Input | Output |
|:---|:---|:---|
| Trigger Monitor | Real-time DCI scores | Disruption events (hex ID, timestamp, duration) |
| PoP Validator | Worker location pings (15-min intervals) | Presence confirmation or zone-hop flag |
| Payout Calculator | Avg daily earnings, disrupted hours, tier cap | Payout amount in ₹ |
| Claim Approver | Fraud score + PoP result | Routing to Path 1/2/3/4 |

**Payout Formula:**
```
Payout = (Worker Avg Daily Earnings ÷ 8) × Verified Disrupted Hours
```
- Disrupted hours = duration DCI remained > 0.85
- Caps: ₹600/day (Tier A), ₹700/day (Tier B), ₹800/day (Tier C)
- Payout maturation: max payout ≤ 2.5× worker's 4-week average daily payout history

### 3.5 Fraud Detection Module

**Purpose:** Prevent zone-hopping, GPS spoofing, syndicate attacks, and earnings inflation.

**7-Layer Defense Architecture:**

| Layer | Mechanism | Weight in Fraud Score |
|:---|:---|:---|
| L0 — DCI Anchor | DCI computed from external-only signals — unfakeable | Structural (no score) |
| L1 — GPS Coordinate Variance | std_dev of lat/lng + accuracy radius in 90min window | 30 points |
| L2 — Platform Order Activity | Completed/accepted orders in 90min pre-disruption | 40 points |
| L3 — Payout Maturation Cap | Max 2.5× 4-week avg payout — kills trust-farm exploit | Structural (no score) |
| L4 — OS Mock Location Flag | Android/iOS mock location provider detection | 20 points |
| L5 — Cross-Hex Fingerprint Graph | Registration cohort, device model concentration, mock location network | 15 + 10 points |
| L6 — Compound Fraud Score | All signals combined → Path 1/2/3/4 routing | Decision layer |
| L7 — Human Review Triage | Priority queue for flagged claims at scale | Escalation |

**Four-Path Response Framework:**

| Path | Condition | Action | SLA |
|:---|:---|:---|:---|
| Path 1 — Fast Track | Gate 2 STRONG + Score < 30 | Auto-payout | < 90 seconds |
| Path 2 — Soft Queue | Gate 2 WEAK or Score 30–59 | Passive verification | 2 hours |
| Path 3 — Active Verify | Gate 2 STRONG + Score 60–79 | 1-tap FCM confirmation | 30min–2hrs |
| Path 4 — Denied + Appeal | Gate 2 OFFLINE or Score ≥ 80 | Denied with appeal link | 1–8 hours |

### 3.6 Notification & Alerts Module

**Purpose:** Push notifications for payouts, disruption alerts, proactive tier upgrades.

| Trigger | Notification Type |
|:---|:---|
| DCI > 0.65 (elevated) | "Your zone shows elevated risk" |
| Payout credited | "₹480 credited — income protected" |
| Sunday forecast DCI > 0.75 | Proactive tier upgrade offer |
| Degraded mode | "Monitoring with reduced signal coverage" |
| Claim flagged | "Your payout is being verified" |

### 3.7 AI Chat Assistant Module

**Purpose:** Conversational assistant for policy, payout, and risk queries.

| Input | Processing | Output |
|:---|:---|:---|
| Worker text/voice query | LLM (OpenRouter/Groq) with injected context: policy, DCI score, last payout | Plain-language response in Hindi/English/Tamil/Telugu/Kannada |

- Read-only — never modifies policies or files claims
- Voice flow: Speech-to-Text → LLM → Text-to-Speech

### 3.8 Admin Dashboard Module

**Purpose:** Insurer-facing dashboard for live monitoring and analytics.

| Panel | Data Source |
|:---|:---|
| Live Hex Map | DCI Engine — color-coded H3 grid |
| Active Policies | Policy Engine — count by zone/tier |
| Trigger Events | Trigger Monitor — real-time log |
| Claims Processed | Claim Approver — auto/flagged/denied |
| Fraud Metrics | Fraud Engine — PoP rate, zone-hops, cluster flags |
| Payout Summaries | Payment Service — disbursed, avg payout, loss ratio |
| Predictive Risk | Forecast Model — next 7-day risk by zone |

### 3.9 Auth Module

**Purpose:** Worker registration and authentication.

- Mobile + OTP login
- JWT token issuance and validation
- Worker profile: city, dark store zone, avg daily earnings, UPI ID, device info

---

## 4. Technology Stack

### 4.1 MVP Stack (Free Tier / Zero Cost)

| Layer | Technology | Justification |
|:---|:---|:---|
| **Worker App** | React Native (Expo) | Native background location APIs for PoP, cross-platform |
| **Admin Dashboard** | Next.js + Tailwind CSS (Vercel free tier) | SSR for live data, free hosting |
| **Backend API** | Python + FastAPI | Async endpoints, native ML model serving |
| **Scheduled Jobs** | APScheduler (in-process) | DCI recomputation every 5min inside FastAPI |
| **ML Models** | XGBoost + Scikit-learn | Risk band classification + DCI weight optimization |
| **Database** | Supabase free tier (PostgreSQL + PostGIS) | PostGIS + H3 extension, 500MB free |
| **Spatial Index** | H3 Python library (`h3-py`) | Hex-grid computation at resolution 9 |
| **Payments** | Razorpay Sandbox | UPI payout simulation in test mode |
| **Notifications** | Firebase Cloud Messaging (FCM) | Free push notifications |
| **Signal APIs** | OpenWeatherMap free, CPCB AQI free, mocks for traffic/platform/social | All free or simulated |
| **AI Assistant** | OpenRouter / Groq API | LLM for chat — policy context injection |
| **Backend Hosting** | Render free tier | Hosts FastAPI + APScheduler |

### 4.2 Key Libraries

| Category | Libraries |
|:---|:---|
| **Backend** | `fastapi`, `uvicorn`, `pydantic`, `apscheduler`, `httpx` (async HTTP), `python-jose` (JWT) |
| **ML/Data** | `xgboost`, `scikit-learn`, `numpy`, `pandas` |
| **Spatial** | `h3`, `shapely`, `geopandas` (optional) |
| **Database** | `supabase-py`, `asyncpg`, `sqlalchemy` (optional) |
| **Payments** | `razorpay` Python SDK |
| **Notifications** | `firebase-admin` |
| **Mobile** | `expo-location`, `expo-task-manager`, `expo-notifications`, `react-navigation` |
| **Admin** | `next`, `tailwindcss`, `recharts` or `chart.js`, `maplibre-gl` or `deck.gl` (hex map) |

---

## 5. Data Model / Data Structures

### 5.1 Database Schema (PostgreSQL + PostGIS + H3)

#### `workers` — Registered gig workers
| Column | Type | Description |
|:---|:---|:---|
| id | UUID PK | Worker unique ID |
| phone | VARCHAR(15) UNIQUE | Mobile number |
| name | VARCHAR(100) | Full name |
| city | VARCHAR(50) | Operating city |
| dark_store_zone | VARCHAR(100) | Assigned dark store |
| hex_id | VARCHAR(20) | H3 hex cell (resolution 9) |
| avg_daily_earnings | DECIMAL(8,2) | Declared average daily earnings |
| upi_id | VARCHAR(100) | UPI payment address |
| device_model | VARCHAR(100) | Phone model |
| device_os_version | VARCHAR(20) | Android/iOS version |
| sim_carrier | VARCHAR(50) | SIM card carrier |
| sim_registration_date | DATE | SIM registration date |
| created_at | TIMESTAMPTZ | Registration timestamp |
| trust_score | INTEGER DEFAULT 50 | 0–100 trust score |
| status | ENUM('active','inactive','suspended') | Account status |

#### `policies` — Weekly insurance policies
| Column | Type | Description |
|:---|:---|:---|
| id | UUID PK | Policy ID |
| worker_id | UUID FK → workers | Policyholder |
| tier | ENUM('A','B','C') | Risk band |
| weekly_premium | DECIMAL(6,2) | Premium amount (₹) |
| coverage_cap_daily | DECIMAL(8,2) | Max daily payout |
| week_start | DATE | Monday of policy week |
| week_end | DATE | Sunday of policy week |
| status | ENUM('active','expired','cancelled') | Policy status |
| is_waiting_period | BOOLEAN DEFAULT false | In 7-day waiting period |
| created_at | TIMESTAMPTZ | Creation time |

#### `hex_zones` — H3 hex cells being monitored
| Column | Type | Description |
|:---|:---|:---|
| hex_id | VARCHAR(20) PK | H3 index (resolution 9) |
| city | VARCHAR(50) | City |
| centroid | GEOMETRY(POINT, 4326) | Hex center (PostGIS) |
| boundary | GEOMETRY(POLYGON, 4326) | Hex boundary (PostGIS) |
| current_dci | DECIMAL(4,3) | Latest DCI score |
| dci_status | ENUM('normal','elevated','disrupted') | Zone status |
| last_computed_at | TIMESTAMPTZ | Last DCI computation |
| active_worker_count | INTEGER | Workers in this hex |

#### `dci_history` — Historical DCI readings (time-series)
| Column | Type | Description |
|:---|:---|:---|
| id | BIGSERIAL PK | Auto-increment |
| hex_id | VARCHAR(20) FK → hex_zones | Hex cell |
| dci_score | DECIMAL(4,3) | Computed DCI |
| w_score | DECIMAL(5,3) | Weather signal |
| t_score | DECIMAL(5,3) | Traffic signal |
| p_score | DECIMAL(5,3) | Platform signal |
| s_score | DECIMAL(5,3) | Social signal |
| computed_at | TIMESTAMPTZ | Computation timestamp |

#### `signal_cache` — Raw signal data from external APIs
| Column | Type | Description |
|:---|:---|:---|
| id | BIGSERIAL PK | Auto-increment |
| hex_id | VARCHAR(20) | Target hex |
| signal_type | ENUM('weather','aqi','traffic','platform','social') | Signal source |
| raw_data | JSONB | Raw API response |
| normalized_score | DECIMAL(5,3) | Normalized score |
| fetched_at | TIMESTAMPTZ | Fetch timestamp |
| source_available | BOOLEAN | Was API reachable |

#### `location_pings` — Worker PoP location pings (every 15 min)
| Column | Type | Description |
|:---|:---|:---|
| id | BIGSERIAL PK | Auto-increment |
| worker_id | UUID FK → workers | Worker |
| hex_id | VARCHAR(20) | H3 hex at ping time |
| latitude | DECIMAL(10,7) | GPS lat |
| longitude | DECIMAL(10,7) | GPS lng |
| accuracy_radius | DECIMAL(6,2) | OS-reported accuracy (meters) |
| network_signal_strength | INTEGER | Signal strength |
| mock_location_flag | BOOLEAN | OS-level mock location detected |
| pinged_at | TIMESTAMPTZ | Ping timestamp |

#### `disruption_events` — Recorded disruption events
| Column | Type | Description |
|:---|:---|:---|
| id | UUID PK | Event ID |
| hex_id | VARCHAR(20) FK → hex_zones | Disrupted hex |
| dci_peak | DECIMAL(4,3) | Peak DCI during event |
| started_at | TIMESTAMPTZ | DCI first crossed 0.85 |
| ended_at | TIMESTAMPTZ NULL | DCI dropped below 0.85 |
| duration_hours | DECIMAL(4,2) | Total disruption duration |
| trigger_signals | JSONB | Which triggers fired |

#### `claims` — Insurance claims
| Column | Type | Description |
|:---|:---|:---|
| id | UUID PK | Claim ID |
| worker_id | UUID FK → workers | Claimant |
| policy_id | UUID FK → policies | Policy used |
| event_id | UUID FK → disruption_events | Disruption event |
| pop_validated | BOOLEAN | Proof-of-Presence result |
| fraud_score | INTEGER | Compound fraud score (0–150) |
| resolution_path | ENUM('fast_track','soft_queue','active_verify','denied') | Path 1/2/3/4 |
| payout_amount | DECIMAL(8,2) | Calculated payout (₹) |
| disrupted_hours | DECIMAL(4,2) | Verified disrupted hours |
| status | ENUM('pending','approved','denied','appealed','paid') | Claim status |
| razorpay_payment_id | VARCHAR(100) NULL | Payment reference |
| created_at | TIMESTAMPTZ | Claim creation |
| resolved_at | TIMESTAMPTZ NULL | Resolution time |

#### `fraud_flags` — Fraud detection flags per claim
| Column | Type | Description |
|:---|:---|:---|
| id | BIGSERIAL PK | Auto-increment |
| claim_id | UUID FK → claims | Associated claim |
| flag_type | VARCHAR(50) | e.g., STATIC_DEVICE, VELOCITY_VIOLATION, MOCK_LOCATION_NETWORK |
| score_contribution | INTEGER | Points added to fraud score |
| details | JSONB | Flag-specific data |

#### `premium_payments` — Weekly premium payment records
| Column | Type | Description |
|:---|:---|:---|
| id | UUID PK | Payment ID |
| worker_id | UUID FK → workers | Worker |
| policy_id | UUID FK → policies | Policy |
| amount | DECIMAL(6,2) | Premium paid |
| razorpay_payment_id | VARCHAR(100) | Payment reference |
| paid_at | TIMESTAMPTZ | Payment time |

### 5.2 Entity Relationships

```
workers 1───N policies
workers 1───N location_pings
workers 1───N claims
policies 1───N claims
policies 1───1 premium_payments
hex_zones 1───N dci_history
hex_zones 1───N signal_cache
hex_zones 1───N disruption_events
disruption_events 1───N claims
claims 1───N fraud_flags
```

---

## 6. Step-by-Step Implementation Plan

### Phase 1 — Project Setup & Infrastructure (Days 1–3)

1. **Initialize backend project**
   - Create FastAPI project structure with modular routers
   - Set up virtual environment, `requirements.txt`
   - Configure environment variables (`.env`): Supabase URL/key, API keys, Razorpay keys

2. **Set up Supabase database**
   - Create Supabase project (free tier)
   - Enable PostGIS extension
   - Enable H3 extension (if available) or plan for Python-side H3 computation
   - Run migration scripts to create all tables from Section 5

3. **Initialize mobile app**
   - Create Expo/React Native project
   - Set up navigation structure, auth context

4. **Initialize admin dashboard**
   - Create Next.js project with Tailwind CSS
   - Deploy to Vercel free tier

### Phase 2 — Signal Ingestion & DCI Engine (Days 4–8)

5. **Build signal fetchers**
   - `weather_fetcher.py` — OpenWeatherMap API integration (rainfall, wind, temp)
   - `aqi_fetcher.py` — CPCB AQI API integration
   - `traffic_fetcher.py` — Mock traffic congestion API
   - `platform_fetcher.py` — Mock platform status API (order volume, latency)
   - `social_fetcher.py` — Mock government alert feed
   - Each fetcher: normalize raw data → score (0–1+), cache in `signal_cache` table

6. **Build H3 spatial grid module**
   - `spatial.py` — Given city coordinates, generate H3 hex grid at resolution 9
   - Map worker dark store zones to hex IDs
   - Store hex boundaries in `hex_zones` table with PostGIS geometry

7. **Build DCI computation engine**
   - `dci_engine.py` — Core DCI formula: `σ(α·W + β·T + γ·P + δ·S)`
   - Implement sigmoid function, configurable weights
   - Read latest signals from cache, compute per hex
   - Store results in `dci_history`, update `hex_zones.current_dci`
   - Implement degraded mode check (< 3 signals available → pause hex)

8. **Set up APScheduler**
   - Schedule DCI recomputation every 5 minutes
   - Schedule signal fetching every 5 minutes (offset from DCI computation)

### Phase 3 — Policy Engine (Days 9–12)

9. **Build risk profiler**
   - `risk_profiler.py` — XGBoost classifier for tier assignment
   - Features: 12-week DCI history, seasonal flag, flood proximity, claim frequency
   - Cold-start: train on synthetic data bootstrapped from IMD rainfall records
   - Output: Tier A, B, or C

10. **Build premium bander**
    - `premium_bander.py` — 4-week rolling avg DCI → tier assignment
    - Apply monsoon multiplier (1.4×) for Jun–Sep
    - Calculate weekly premium per tier

11. **Build policy manager**
    - `policy_manager.py` — Create, activate, renew, cancel policies
    - 7-day waiting period logic for new accounts
    - Reduced coverage cap during waiting period
    - Monday auto-renewal cycle

12. **Auth service**
    - OTP-based mobile login (can use Supabase Auth or custom)
    - JWT token issuance/validation
    - Worker registration endpoint with device fingerprint capture

### Phase 4 — Claims Automation Pipeline (Days 13–18)

13. **Build trigger monitor**
    - `trigger_monitor.py` — Watch DCI scores, detect threshold crossings
    - Create `disruption_events` records when DCI > 0.85
    - Track event duration (start/end timestamps)
    - Identify all active policyholders in disrupted hex

14. **Build PoP validator (Phase 2 — basic)**
    - `pop_validator.py` — Query `location_pings` for worker in hex within 90min pre-disruption
    - Basic validation: ≥ 1 ping in hex → presence confirmed
    - No ping → check platform GPS fallback (mock)
    - Zone-hop detection: no pings in hex → denied

15. **Build payout calculator**
    - `payout_calculator.py` — `(avg_daily_earnings ÷ 8) × disrupted_hours`
    - Apply coverage cap per tier
    - Apply payout maturation rule (≤ 2.5× 4-week avg payout)
    - Cross-reference declared earnings vs zone 90th percentile

16. **Build claim approver**
    - `claim_approver.py` — Route claims through 4-Path framework
    - Compute compound fraud score
    - Write claim records with resolution path

17. **Integrate Razorpay sandbox**
    - `payment_service.py` — UPI payout via Razorpay test mode
    - Webhook handler for payment confirmation
    - Store payment reference in claims

18. **Integrate FCM notifications**
    - `notification_service.py` — Push notifications via Firebase
    - Notification templates for all triggers (payout, alert, verification)

### Phase 5 — Advanced Fraud Engine (Days 19–23)

19. **GPS coordinate variance analysis (Gate 1)**
    - Compute std_dev of lat/lng and accuracy_radius over 90min window
    - Low variance → STATIC_DEVICE_FLAG → +30 fraud score

20. **Platform order activity validation (Gate 2)**
    - Mock platform API for order history
    - STRONG: ≥ 1 order in 90min → auto-approved
    - WEAK: online but no orders → soft queue with passive checks
    - NONE: offline → denied

21. **Velocity detection (Gate 3)**
    - Distance ÷ time between last out-of-hex ping and first in-hex ping
    - \> 120 km/hr → VELOCITY_VIOLATION flag

22. **Cross-hex fingerprint graph**
    - Build device fingerprint graph across all claiming workers per event
    - Detect: mock location networks, registration cohort anomalies, device model concentration
    - Flag: MOCK_LOCATION_NETWORK, REGISTRATION_COHORT, MODEL_CONCENTRATION

23. **Compound fraud score computation**
    - Aggregate all flag scores → route to Path 1/2/3/4
    - Implement trust score dampening during high-risk events

### Phase 6 — Worker App & Admin Dashboard (Days 24–30)

24. **Worker app screens**
    - Onboarding flow (register → auto-detect zone → tier assignment → UPI mandate)
    - Home dashboard: live DCI score, active policy, coverage cap
    - Payout history timeline
    - Proactive tier upgrade prompt
    - AI Chat Assistant integration

25. **Background location pinging**
    - Expo TaskManager for background location
    - Encrypted H3 hex ping every 15 minutes → POST to backend
    - Include GPS coords, accuracy, network strength, mock location flag

26. **Admin dashboard**
    - Live H3 hex map (color-coded by DCI: green/amber/red)
    - Active policies table with tier distribution
    - Real-time trigger event log
    - Claims table: auto-approved / soft queue / active verify / denied
    - Fraud metrics panel
    - Payout summary with loss ratio tracker

### Phase 7 — AI Assistant & Forecasting (Days 31–35)

27. **AI Chat Assistant**
    - OpenRouter/Groq API integration
    - Context injection: worker profile, current DCI, last payout, active policy
    - Read-only — explanatory only
    - Multi-language support: Hindi, English, Tamil, Telugu, Kannada

28. **Proactive tier upgrade alerts**
    - Sunday evening job: compute next-week risk score per hex
    - Using 7-day weather forecast + historical DCI patterns
    - Push notification with upgrade offer
    - Handle worker response → update next week's policy tier

29. **XGBoost weekly retrain pipeline**
    - Collect DCI events + claim outcomes from past week
    - Retrain XGBoost: update α, β, γ, δ weights
    - Retrain risk band classifier with new claim frequency data
    - Sunday night batch job via APScheduler

---

## 7. Pipeline Logic

### 7.1 Core Pipeline: Signal → DCI → Trigger → Claim → Payout

```
STAGE 1: SIGNAL INGESTION (every 5 minutes)
├── Fetch weather data (OpenWeatherMap) → normalize to W score
├── Fetch AQI data (CPCB) → normalize to W component (combined)
├── Fetch traffic data (mock) → normalize to T score
├── Fetch platform status (mock) → normalize to P score
├── Fetch social signals (mock) → normalize to S score
└── Cache all raw + normalized scores in signal_cache table

STAGE 2: DCI COMPUTATION (every 5 minutes, after Stage 1)
├── For each active hex_zone:
│   ├── Retrieve latest signals from cache
│   ├── Check signal availability (≥ 3 of 5 required)
│   │   └── If < 3 → set hex to DEGRADED, skip computation
│   ├── Compute raw score: raw = α·W + β·T + γ·P + δ·S
│   ├── Apply sigmoid: DCI = 1 / (1 + e^(-raw))
│   ├── Store in dci_history
│   └── Update hex_zones.current_dci and dci_status
└── Emit DCI update event for downstream consumers

STAGE 3: TRIGGER DETECTION (reactive, on DCI update)
├── If DCI transitions from < 0.85 to ≥ 0.85:
│   ├── Create new disruption_event record
│   ├── Query all workers in hex with active policies
│   └── For each worker → initiate claim processing
├── If DCI transitions from ≥ 0.85 to < 0.85:
│   └── Close disruption_event (set ended_at, compute duration_hours)
└── If 0.65 < DCI ≤ 0.85:
    └── Send elevated watch notification to workers in hex

STAGE 4: CLAIM PROCESSING (per worker, per event)
├── STEP 4a: PoP Validation
│   ├── Query location_pings: worker in hex within T-90min to T
│   ├── If ≥ 1 ping → presence confirmed
│   ├── If 0 pings → check platform GPS fallback
│   └── If no confirmation → ZONE_HOP flag
│
├── STEP 4b: Fraud Gate Evaluation
│   ├── Gate 1: GPS coordinate variance analysis
│   ├── Gate 2: Platform order activity check (STRONG/WEAK/NONE)
│   ├── Gate 3: Velocity check (distance/time > 120km/hr?)
│   ├── Supporting: OS mock location flag, fingerprint graph, etc.
│   └── Compute compound fraud score (0–150)
│
├── STEP 4c: Path Routing
│   ├── Score < 30 + Gate 2 STRONG → Path 1: Fast Track
│   ├── Score 30–59 OR Gate 2 WEAK → Path 2: Soft Queue
│   ├── Score 60–79 + Gate 2 STRONG → Path 3: Active Verify
│   └── Score ≥ 80 OR Gate 2 NONE → Path 4: Denied + Appeal
│
└── STEP 4d: Payout Calculation (for Path 1/2/3 approved)
    ├── disrupted_hours = event duration (DCI > 0.85)
    ├── hourly_rate = avg_daily_earnings ÷ 8
    ├── raw_payout = hourly_rate × disrupted_hours
    ├── Apply tier coverage cap (₹600/700/800 per day)
    ├── Apply maturation cap (≤ 2.5× 4-week avg daily payout)
    └── Final payout amount

STAGE 5: PAYOUT EXECUTION
├── Initiate Razorpay UPI transfer with final payout amount
├── Wait for webhook confirmation
├── Update claim status → 'paid'
├── Send FCM push notification: "₹X credited — income protected"
└── Log complete claim event for analytics
```

### 7.2 Weekly Lifecycle Pipeline

```
MONDAY 00:00
├── Auto-debit weekly premium for all active workers via Razorpay
├── Create new policy records for the week
├── Activate renewed policies (no waiting period)
└── Continue waiting period for new accounts (< 7 days)

MON–SAT (continuous)
├── Signal ingestion every 5 minutes
├── DCI computation every 5 minutes
├── Trigger detection on DCI updates
└── Claims processing as events occur

SUNDAY EVENING
├── Run DCI forecast model for next week (weather forecast + historical patterns)
├── For each hex with predicted DCI > 0.75:
│   └── Send proactive tier upgrade notification to workers
├── Handle worker upgrade responses
├── Generate weekly summary for all workers
└── XGBoost retrain job (update DCI weights + risk band classifier)
```

---

## 8. Pipeline Testing Plan

### 8.1 Unit Tests

| Component | Test | Expected Outcome |
|:---|:---|:---|
| **Signal Fetchers** | Mock API responses → verify normalized score output | Weather: 40mm/hr rain → W ≈ 0.85; AQI 350 → W component elevated |
| **DCI Engine** | Fixed inputs (W=1.0, T=0.8, P=0.9, S=0.5) → verify DCI output | `σ(0.45×1.0 + 0.25×0.8 + 0.20×0.9 + 0.10×0.5)` = `σ(0.88)` ≈ 0.707 |
| **DCI Engine** | Extreme inputs → verify disruption threshold | W=1.4, T=0.8, P=1.0, S=0.8 → DCI > 0.85 |
| **DCI Engine** | Degraded mode with 2 signals | DCI paused, hex marked degraded |
| **Sigmoid Function** | Various raw scores | σ(0)=0.5, σ(2)≈0.88, σ(-2)≈0.12 |
| **H3 Spatial** | Lat/lng → hex_id conversion | Known coordinates → expected H3 index |
| **Premium Bander** | 4-week avg DCI = 0.35 → Tier A; 0.55 → Tier B; 0.70 → Tier C | Correct tier + premium |
| **Payout Calculator** | Avg earnings ₹600, disrupted 4 hours | `(600÷8) × 4 = ₹300` |
| **Payout Calculator** | Test maturation cap enforcement | Payout capped at 2.5× 4-week avg |
| **PoP Validator** | Worker with 3 pings in hex within 90min | Presence confirmed |
| **PoP Validator** | Worker with 0 pings in hex | Zone-hop flagged |
| **Fraud Score** | Gate 1 flag (30) + Gate 2 NONE (40) + mock location (20) | Score = 90 → Path 4 |
| **Fraud Score** | No flags, Gate 2 STRONG | Score < 30 → Path 1 |
| **Velocity Check** | 15km in 5 minutes = 180 km/hr | VELOCITY_VIOLATION flag |

### 8.2 Integration Tests

| Test Scenario | Components Involved | Validation |
|:---|:---|:---|
| **Full disruption cycle** | Signal → DCI → Trigger → PoP → Claim → Payout | End-to-end: inject mock signals causing DCI > 0.85, verify claim created + payout calculated |
| **No disruption** | Signal → DCI | DCI stays < 0.65, no trigger fires, no claims created |
| **Elevated watch** | Signal → DCI → Notification | DCI = 0.72, verify elevated watch notification sent, no claim |
| **Zone-hopper detection** | PoP → Fraud → Claim | Worker with no pings in hex → zone-hop flag → Path 4 denial |
| **Honest worker fast-track** | PoP → Fraud → Claim → Payout | Worker with valid pings + confirmed orders → Path 1 → payout in < 90s |
| **Degraded mode** | Signal (2/5 available) → DCI | DCI paused for hex, claims queued for manual review |
| **Weekly cycle** | Policy creation → premium debit → DCI monitoring → claim → renewal | Full Monday-to-Sunday lifecycle |
| **Tier upgrade** | Forecast → Notification → Upgrade → Premium change | Sunday forecast DCI > 0.75, worker upgrades, next week premium reflects change |

### 8.3 Example Input/Output Validation

**Scenario: Bengaluru monsoon event**
```
Input signals for hex 8928308280fffff:
  W = 0.95 (rainfall 42mm/hr + wind 35km/hr)
  T = 0.70 (heavy congestion)
  P = 0.85 (order volume dropped 75%)
  S = 0.20 (no curfew)

DCI = σ(0.45×0.95 + 0.25×0.70 + 0.20×0.85 + 0.10×0.20)
    = σ(0.4275 + 0.175 + 0.17 + 0.02)
    = σ(0.7925)
    = 0.688  →  ELEVATED WATCH (not disrupted)

--- Signals escalate ---
  W = 1.2, T = 0.90, P = 1.0, S = 0.30

DCI = σ(0.45×1.2 + 0.25×0.90 + 0.20×1.0 + 0.10×0.30)
    = σ(0.54 + 0.225 + 0.20 + 0.03)
    = σ(0.995)
    = 0.730  →  ELEVATED WATCH (closer to threshold)

--- Full disruption ---
  W = 1.5, T = 1.0, P = 1.2, S = 0.50

DCI = σ(0.45×1.5 + 0.25×1.0 + 0.20×1.2 + 0.10×0.50)
    = σ(0.675 + 0.25 + 0.24 + 0.05)
    = σ(1.215)
    = 0.771  →  Approaching threshold

--- With compounding ---
  W = 2.0, T = 1.0, P = 1.5, S = 1.0

DCI = σ(0.45×2.0 + 0.25×1.0 + 0.20×1.5 + 0.10×1.0)
    = σ(0.90 + 0.25 + 0.30 + 0.10)
    = σ(1.55)
    = 0.825  →  Still just below threshold

Note: DCI > 0.85 requires σ(x) > 0.85, which means x > 1.73.
This requires multiple extreme signals simultaneously.
```

### 8.4 Debugging Checkpoints

| Checkpoint | What to Verify | Tool |
|:---|:---|:---|
| After Signal Fetch | Raw API data in signal_cache matches expected format | DB query + log inspection |
| After Normalization | Scores in [0, 2] range, no NaN/null values | Assertion tests |
| After DCI Computation | DCI in [0, 1], correct formula application | Print intermediate values |
| After Trigger Detection | Correct state transitions (normal→elevated→disrupted) | State machine logs |
| After PoP Query | Correct ping count in 90min window, right hex matching | SQL query verification |
| After Fraud Score | Individual flag contributions sum correctly | Score breakdown logging |
| After Path Routing | Correct path assignment based on score + Gate 2 result | Decision tree trace |
| After Payout Calc | Amount matches formula, caps applied correctly | Math verification |
| After UPI Transfer | Razorpay sandbox returns success, payment ID stored | Webhook log |

---

## 9. Risks / Ambiguities

### 9.1 Technical Risks

| Risk | Impact | Mitigation |
|:---|:---|:---|
| **Supabase H3 extension availability** | H3 may not be pre-enabled on Supabase free tier | Compute H3 in Python (h3-py) rather than in-database |
| **APScheduler reliability on Render free tier** | Render free tier sleeps after 15min inactivity | Use external cron ping service or accept demo-only limitation |
| **Signal API rate limits** | OpenWeatherMap free tier: 60 calls/min | Cache aggressively, batch hex queries by city coordinates |
| **Background location on iOS** | iOS aggressively kills background tasks | Accept reduced PoP ping frequency on iOS; rely on platform GPS fallback |
| **Razorpay sandbox limitations** | Sandbox may not fully replicate UPI payout webhooks | Implement mock fallback for demo |

### 9.2 Data & ML Ambiguities

| Ambiguity | Assumption Made |
|:---|:---|
| **No real platform order data** | Mock Zepto/Blinkit API with synthetic order history. Gate 2 validation logic is correct but data is simulated. |
| **Cold-start XGBoost training data** | Use synthetic data generated from IMD rainfall records + known disruption patterns. Model will be under-fitted initially. |
| **DCI weight convergence timeline** | README states 6–8 weeks. For MVP, use fixed cold-start weights and demonstrate the retraining pipeline architecture. |
| **"Raw scores can exceed 1.0"** | Weather composite (rainfall + wind + AQI) can produce W > 1.0. Sigmoid handles this, but normalization bounds must be documented clearly. |
| **Traffic API source** | Google Maps Traffic is not free. Use simulated traffic data or OpenStreetMap-based alternatives. |
| **Government alert feed** | No real-time API exists for curfews/bandhs. Fully mocked for MVP. |

### 9.3 Business Logic Ambiguities

| Ambiguity | Resolution Needed |
|:---|:---|
| **Exact payout maturation cap behavior** | README says "max 2.5× 4-week avg daily payout." For new workers with 0 history, what is the default cap? **Assumed:** Zone 50th percentile during waiting period. |
| **Multiple disruptions in one week** | Can a worker receive multiple payouts for separate events in the same policy week? **Assumed:** Yes, up to the daily coverage cap per event. |
| **Tier upgrade timing** | Worker upgrades on Sunday night — does the upgrade premium apply retroactively or only for the next week? **Assumed:** Next week only (Monday billing). |
| **Concurrent hex disruptions** | If a worker's hex_id changes during a disruption (they move), which hex's event applies? **Assumed:** Hex at time of disruption onset (PoP validation hex). |
| **Earnings declaration validation** | How strictly to enforce the 90th percentile flag? **Assumed:** Soft flag only — route to manual review, not auto-denial. |

### 9.4 Scope Clarifications

| Item | In Scope (MVP) | Out of Scope (MVP) |
|:---|:---|:---|
| DCI computation engine | ✅ Built with real + mock signals | |
| Basic PoP (Phase 2) | ✅ Ping count + zone check | |
| Full adversarial fraud engine | ✅ All 7 layers | |
| XGBoost risk classifier | ✅ Trained on synthetic data | |
| Razorpay payouts | ✅ Sandbox mode | Live transactions |
| AI Chat Assistant | ✅ OpenRouter/Groq | Voice AI (STT/TTS) |
| Admin dashboard | ✅ Next.js on Vercel | Real-time WebSocket updates |
| Proactive tier alerts | ✅ Sunday forecast | Multi-day forecasting |
| Multi-city deployment | | ✅ Out of scope — single city pilot |
| Reinsurance integration | | ✅ Out of scope — production only |
| IRDAI compliance filing | | ✅ Out of scope — regulatory pathway documented only |
