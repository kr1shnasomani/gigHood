# Graph Report - gigHood  (2026-04-25)

## Corpus Check
- 126 files · ~119,296 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1197 nodes · 2225 edges · 27 communities detected
- Extraction: 72% EXTRACTED · 28% INFERRED · 0% AMBIGUOUS · INFERRED: 625 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 122 edges
2. `now()` - 62 edges
3. `info()` - 51 edges
4. `NotificationService` - 44 edges
5. `FraudEvaluator` - 30 edges
6. `_ReadModel` - 29 edges
7. `calculate_payout()` - 28 edges
8. `POST()` - 25 edges
9. `main()` - 22 edges
10. `_run_process_claim()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `_load_fraud_model()` --calls--> `load()`  [INFERRED]
  backend/services/fraud_engine.py → frontend/src/app/admin-dashboard/layout.tsx
- `loadData()` --calls--> `warn()`  [INFERRED]
  frontend/src/app/admin-dashboard/claims/page.tsx → backend/demo_runner.py
- `step1_registration()` --calls--> `GET()`  [INFERRED]
  backend/demo_runner.py → frontend/src/app/api/schemes/route.ts
- `step2_risk_profiler()` --calls--> `GET()`  [INFERRED]
  backend/demo_runner.py → frontend/src/app/api/schemes/route.ts
- `step3_policy()` --calls--> `GET()`  [INFERRED]
  backend/demo_runner.py → frontend/src/app/api/schemes/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (104): Enum, ActiveDisruptionSummary, ActiveVerifyRequest, AdminDashboardSummary, AppealRequest, AuthTokenResponse, BaseResponse, ChatMessage (+96 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (98): evaluate_location_guardrails(), execute_fast_track_payout(), explain_claim_decision(), is_city_compatible(), _normalize_city_token(), _persist_claim_evidence(), process_claim(), City compatibility for claim guardrails.     Includes Chennai outskirts aliases (+90 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (73): _clamp01(), _compute_dci_from_signals(), _derive_fraud_score(), get_alerts_count(), get_fraud_events(), get_fraud_metrics(), get_fraud_queue(), get_fraud_signals() (+65 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (59): overrideClaimDecision(), getOrCreateDeviceId(), getToken(), isAuthenticated(), normalizePhone(), register(), sendOtp(), verifyOtp() (+51 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (65): Standard 4-path routing constraint map determining financial limits.     Rules d, route_claim(), _apply_city_config(), _cleanup_fraud_workers(), fail(), _get_city_config(), info(), main() (+57 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (55): Onboards the authenticated worker physically tracking their spatial risk to issu, register_for_policy(), _check_idempotency(), create_policy(), _downgrade_tier_once(), explain_policy_decision(), _fetch_claim_frequency(), _fetch_recent_dci_history() (+47 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (57): are_hexes_adjacent(), city_bounding_box(), ensure_hex_zone_exists(), estimate_hex_area_km2(), get_active_hex_ids(), get_child_hexes(), get_disrupted_hex_ids(), get_hex_boundary() (+49 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (51): _check_static_device(), _check_time_span(), _check_velocity(), _fetch_pings(), _haversine_km(), backend/services/pop_validator.py — Proof-of-Presence Validation ===============, Great-circle distance in kilometres between two GPS coordinates., Returns True (suspicious) if all pings are clustered within < 5 minutes.     Bur (+43 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (37): NotificationService, Pushes an FCM notification strictly targeting a single worker device., send_claim_notification(), send_elevated_watch_alert(), Tests for backend/services/notification_service.py (production-grade upgrade)  O, First FCM call raises, second succeeds → returns True, sleep called once.     Th, All 4 attempts raise → returns False.     Retry loop = [0, 0.5, 1.0, 2.0] → 4 se, async_send_push in mock mode (enabled=False) returns True without FCM. (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (44): calculate_payout(), _get_tier_cap(), backend/services/payout_calculator.py — Payout Computation Engine ==============, Computes the final payout for a disruption claim.      Formula stages (applied i, Tests for backend/services/payout_calculator.py (production-grade upgrade)  All, Unknown tier 'X' → defaults to B (₹700 cap)., Earnings of ₹5000 clamped to ₹2000 before formula., disrupted_hours=23 (within 0–24 allowed range) is clamped to 12 for formula. (+36 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (42): SandboxSignalBatchOverrideRequest, create_jwt(), decode_jwt(), get_current_worker(), BaseModel, SimulateDisruptionRequest, ingest_location_ping(), LocationPingParams (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (42): CycleResult, _failed_result(), fetch_all_signals_for_hex(), fetch_aqi(), fetch_platform(), fetch_social(), fetch_traffic(), fetch_weather() (+34 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (37): get_my_claims(), Returns authentic worker's full claim history dynamically resolving pipeline ste, Ingests state change callbacks from Razorpay asynchronously.     Only allows leg, razorpay_webhook(), _get_razorpay_client(), handle_payout_webhook(), initiate_upi_payout(), _mock_payout_response() (+29 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (34): _clamp_weight(), compute_dci(), get_active_dci_weights(), invalidate_weight_cache(), Forces reload of DCI weights on next cycle., Returns active DCI weights from `dci_weights` with a short in-process cache., Standard sigmoid function mapping any real number into the (0, 1) bounds., Computes the Dynamic Condition Index raw polynomial and normalizes it.     Formu (+26 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (25): get_worker_features(), Upserts worker features with history-safe updates., store_worker_features(), load(), fetch_training_data(), run_online_training(), explain_tier(), get_model_path() (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (15): deleteToken(), interpolate(), normalizeLanguage(), resolveKey(), t(), arcD(), formatDate(), formatTime() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (20): fetchAuditLogs(), fetchFraudEvents(), fetchFraudMetrics(), fetchFraudNetworkGraph(), fetchFraudQueue(), fetchFraudSignals(), fetchFraudWorkers(), fetchKPIs() (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (23): _chunked(), _claims_paid_stats(), _count_table(), _ensure_city_hexes(), _ensure_events(), _find_protected_worker(), _generate_workers(), _inject_neo4j_fraud_ring() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (20): chat(), ChatRequest, ChatResponse, Chat API Router — POST /chat Handles worker AI assistant queries with injected c, Accepts a worker's message and returns a context-aware LLM response.     Worker, build_context(), _call_groq(), _call_openrouter() (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (20): build_workers(), chunked(), clear_neo4j_graph(), get_hex_zones(), get_or_create_events(), inject_claim_rows(), inject_location_pings(), inject_neo4j_fraud_ring() (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.19
Nodes (12): _clean_env_value(), _client(), get_db_connection(), get_db_transaction(), get_supabase_admin_client(), get_supabase_client(), _looks_like_jwt(), Resolve a valid Supabase key for supabase-py create_client.      The python clie (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.38
Nodes (11): backfill_fraud_network_graph(), get_fraud_network_graph(), backfill_claim_graph(), _derive_device_fingerprint(), _get_degraded_fraud_graph(), _get_driver(), get_syndicate_graph(), ingest_claim_graph() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (2): recenterAndReheat(), zoomToFitGraph()

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (3): BaseSettings, Config, Settings

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (2): AppRouteShell(), isWorkerRoute()

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): H3HexagonLayer

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (1): gigHood synthetic training data generator ======================================

## Knowledge Gaps
- **278 isolated node(s):** `H3HexagonLayer`, `gigHood synthetic training data generator ======================================`, `Config`, `Gate2=STRONG + score < 30 -> fast_track`, `Gate2=NONE -> denied immediately irrespective of fraud score mock` (+273 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 22`** (8 nodes): `cleanLabel()`, `nodeTypeColor()`, `recenterAndReheat()`, `riskColor()`, `zoomIn()`, `zoomOut()`, `zoomToFitGraph()`, `FraudNetworkGraph.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (3 nodes): `AppRouteShell()`, `isWorkerRoute()`, `AppRouteShell.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `H3HexagonLayer`, `deckgl-react.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `generate_data.py`, `gigHood synthetic training data generator ======================================`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 17`, `Community 18`, `Community 19`, `Community 21`?**
  _High betweenness centrality (0.336) - this node is a cross-community bridge._
- **Why does `info()` connect `Community 4` to `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 18`, `Community 21`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `POST()` connect `Community 3` to `Community 18`, `Community 2`, `Community 10`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Are the 121 inferred relationships involving `GET()` (e.g. with `load()` and `POST()`) actually correct?**
  _`GET()` has 121 INFERRED edges - model-reasoned connections that need verification._
- **Are the 74 inferred relationships involving `str` (e.g. with `_print_city_configs()` and `step5_dci()`) actually correct?**
  _`str` has 74 INFERRED edges - model-reasoned connections that need verification._
- **Are the 61 inferred relationships involving `now()` (e.g. with `timeAgo()` and `getOrCreateDeviceId()`) actually correct?**
  _`now()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Are the 45 inferred relationships involving `info()` (e.g. with `lifespan()` and `run_monday_policy_cycle()`) actually correct?**
  _`info()` has 45 INFERRED edges - model-reasoned connections that need verification._