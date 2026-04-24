# 🎯 gigHood: Post-Registration Policy Selection Deep Dive

This document rigorously traces the exact execution flow of how a policy is assigned to a worker immediately after they register. It follows the exact code paths, database interactions, and algorithmic decisions.

---

## 1. 🧾 REGISTRATION FLOW ENTRY

**Entrypoint API:** `POST /auth/register` (in `backend/api/workers.py`)

When a user submits the signup form, the request payload (`WorkerRegisterRequest`) hits the backend. 
**Crucial Finding:** The registration endpoint **does not** compute or assign a policy. It strictly handles identity and spatial hashing.

**Execution trace inside `register_worker()`:**
1. **Spatial Hashing:** `hash_dark_store_to_coords(req.dark_store_zone)` deterministically converts the textual dark store (e.g., "Zepto Koramangala") into exact latitude/longitude bounds.
2. **Hex Indexing:** `lat_lng_to_hex(lat, lng)` converts the coordinates into an Uber H3 Hex ID.
3. **Database Insert:** It inserts the raw profile into the `workers` table:
   ```sql
   INSERT INTO workers (
       phone, name, city, platform_affiliation, platform_id, 
       is_platform_verified, dark_store_zone, hex_id, avg_daily_earnings, 
       upi_id, device_model, device_os_version, sim_carrier, 
       sim_registration_date, trust_score, status
   ) VALUES (...)
   ```
4. **Returns:** A JWT `access_token`, the `hex_id`, and worker metadata.

---

## 8. 🔗 FRONTEND INTEGRATION (The Trigger)

Because `POST /auth/register` does not assign a policy, how does the user get one?
**Lazy-Loading Auto-Issuance:**
Immediately after logging in, the frontend app routes the user to the Home screen, which fires an API call to **`GET /me/policy`** (in `backend/api/workers.py`).

**Execution inside `get_my_policy()`:**
1. Queries: `SELECT * FROM policies WHERE worker_id = X AND status = 'active'`
2. If `res.data` is empty, it **synchronously triggers:** `create_policy(worker_id)`.
3. This guarantees a user never sees an empty state; the policy is engineered precisely at their first dashboard load.

---

## 2. 📊 USER PROFILING / DATA CAPTURE

Inside `create_policy(worker_id)` (in `backend/services/policy_manager.py`), the system gathers data to evaluate the risk of insuring this newly registered worker.

It calls `fetch_worker_risk_metrics(worker_id)` which pulls:
1. **City & Hex ID:** From the `workers` table.
2. **Environmental History (`_fetch_recent_dci_history`):** Pulls the last 12 DCI (Disruption) scores for the worker's `hex_id` from the `dci_history` table.
3. **Seasonality (`seasonal_flag`):** A static check: `date.today().month in {6, 7, 8, 9}` (Monsoon months).
4. **Claim Frequency (`_fetch_claim_frequency`):** Scans the `claims` table for the last 28 days. For a new user, this returns `0.0`.

---

## 3. 🎯 POLICY SELECTION LOGIC (CORE PART) & 4. 🧮 RECOMMENDATION ENGINE

Once metrics are gathered, the system must decide the worker's **Tier (A, B, or C)**.
It passes the data to `predict_tier(worker_hex_history, seasonal_flag, city, claim_frequency)` in `backend/services/risk_profiler.py`.

### Step 1: XGBoost ML Inference
- The system maps the string `city` to a static `flood_proximity_score` (e.g., Bengaluru = 0.35, Mumbai = 0.80).
- It calculates `dci_avg` (mean of the recent history).
- It formats a DataFrame: `[dci_avg, seasonal_flag, flood_proximity_score, claim_frequency]`.
- The XGBoost model (`risk_model_vX.json`) predicts a base class (0="A", 1="B", 2="C").

### Step 2: Rule-Based Guardrails
Simultaneously, it computes a hardcoded rule-based tier:
- **Tier C:** If `dci_avg >= 0.65` AND `flood_score >= 0.70`
- **Tier B:** If `dci_avg >= 0.50` OR (`dci_avg >= 0.45` AND `flood_score >= 0.60`)
- **Tier A:** Otherwise

### Step 3: Hybrid Resolution
By default, the system acts conservatively. It compares the ML Tier and the Rule Tier and **picks the higher risk (stricter) tier**. (e.g., if ML says 'A' but Rules say 'B', it outputs 'B').

### Step 4: Activity Downgrade (Fraud Prevention)
Back in `policy_manager.py`, there is a strict underwriting guardrail for "ghost workers":
- It calls `_get_active_delivery_days_last_30d()`, running:
  `SELECT pinged_at FROM location_pings WHERE worker_id = X AND pinged_at >= [30 days ago]`
- If the distinct active days are **< 5**, it invokes `_downgrade_tier_once(tier)`.
- **Why?** If a user just registered, their active days will be 0. Thus, a brand new user assigned Tier C by the ML will automatically be downgraded to Tier B coverage until they prove delivery activity.

---

## 5. 🔄 FULL EXECUTION FLOW (Trace Chain)

1. **`POST /auth/register`**: Inserts `workers` row.
2. **`GET /me/policy`**: Checks `policies` table. Finds none.
3. **`create_policy()`**:
   - `get_next_monday_sunday_bounds()` determines policy lifecycle.
   - `fetch_worker_risk_metrics()` gathers history, city, claim count.
4. **`predict_tier()`**:
   - XGBoost model inference -> ML Tier
   - Static condition checks -> Rule Tier
   - Hybrid selection -> Base Tier
5. **`_get_active_delivery_days_last_30d()`**: Checks `location_pings`. For new users, it's 0.
6. **`_downgrade_tier_once()`**: Demotes Base Tier due to lack of historical activity.
7. **`calculate_premium()` / `_get_coverage_cap_for_tier()`**: Sets exact pricing.
8. **`supabase.table('policies').insert()`**: Writes final policy to DB.

---

## 6. 📤 FINAL ASSIGNMENT

The policy is written into the **`policies`** table with the following structure:
```sql
INSERT INTO policies (
    worker_id, tier, weekly_premium, coverage_cap_daily, 
    week_start, week_end, status, is_waiting_period
) VALUES (
    'w-123', 'B', 45.50, 700.0, 
    '2026-04-27', '2026-05-03', 'active', TRUE
)
```
- **`is_waiting_period: TRUE`**: Very important. Because this is the worker's *first* policy, a 7-day waiting period is hardcoded to prevent them from registering in the middle of a storm and instantly claiming.
- **`week_start` / `week_end`**: Aligned to the upcoming Monday-Sunday bounds.

---

## 7. 🧠 EDGE CASES
- **Missing Location History (`dci_history` is empty):** The code catches this and tries to read `current_dci` from `hex_zones`. If that fails, it assumes a static baseline of `0.5`.
- **Database Failure during `insert()`:** Trapped in a `try/catch`. If Supabase throws an exception after the query actually succeeded (due to network timeout unpacking the response), the fallback `except` block catches it and runs a `SELECT *` to retrieve the inserted row safely.
- **Location Pings DB Missing:** If `location_pings` is completely empty/fails to query, `_get_active_delivery_days_last_30d` returns `None` instead of `0`. This bypasses the activity downgrade, allowing demo environments to function smoothly without complex telemetry seeding.

---

## ⚡ REAL EXECUTION EXAMPLE

**"Worker registers in Bengaluru on Thursday, April 23rd"**

1. **Frontend**: Sends `{"city": "Bengaluru", "dark_store_zone": "Swiggy Indiranagar"}` to `/auth/register`.
2. **Backend**: Hashes "Swiggy Indiranagar" into H3 Hex `8861892a23fffff`. Worker row is inserted.
3. **Frontend**: Immediately hits `GET /me/policy`.
4. **Backend**: No policy found. Triggers `create_policy()`.
5. **Metrics**: Bengaluru flood score `0.35`. Hex DCI average `0.42`. Claim freq `0.0`. Season: Not Monsoon.
6. **ML Inference**: XGBoost predicts **Tier A**. Rule engine predicts **Tier A**.
7. **Downgrade**: Worker has 0 pings in the last 30 days. However, since they are already Tier A (the lowest tier), `_downgrade_tier_once('A')` returns **Tier A**.
8. **Pricing**: Cap is set to ₹600/day.
9. **Persistence**: Inserts policy for Tier A, valid from next Monday (`2026-04-27`) to Sunday (`2026-05-03`), with `is_waiting_period=True`.
10. **Response**: Frontend receives the fully engineered policy and renders the dashboard.
