from __future__ import annotations

import argparse
import random
import sys
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from faker import Faker
from neo4j import GraphDatabase

# Allow running as a standalone script from backend/scripts.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

PROTECTED_PHONE = "9876543210"
TARGET_WORKERS = 20
TARGET_PREMIUM_POOL = 100_000
TARGET_CLAIMS_PAID = 65_000

FAKER = Faker("en_IN")
RNG = random.Random(20260416)

UPI_DOMAINS = ["oksbi", "okhdfcbank", "okaxis", "ybl", "ibl"]
DEVICE_MODELS = [
    "Redmi Note 12",
    "Samsung M14",
    "Realme Narzo 60",
    "OnePlus Nord CE",
    "Vivo T2",
    "POCO X5",
]
CARRIERS = ["Jio", "Airtel", "Vi", "BSNL"]
PLATFORMS = ["Swiggy", "Zomato", "Zepto", "Blinkit", "Dunzo"]


@dataclass
class WorkerSeed:
    id: str
    phone: str
    name: str
    upi_id: str
    hex_id: str
    city: str
    dark_store_zone: str
    latitude: float
    longitude: float
    avg_daily_earnings: int
    device_model: str
    device_os_version: str
    sim_carrier: str
    sim_registration_date: date
    platform_affiliation: str
    platform_id: str
    is_platform_verified: bool
    trust_score: int
    active_delivery_days_30d: int
    device_token: str


@dataclass
class PurgeSnapshot:
    worker: dict[str, Any] | None
    policies: list[dict[str, Any]]
    claims: list[dict[str, Any]]
    location_pings: list[dict[str, Any]]


@dataclass
class PurgeStats:
    claims_deleted: int
    policies_deleted: int
    workers_deleted: int
    location_pings_deleted: int
    protected_worker_restored: bool
    protected_policies_restored: int
    protected_claims_restored: int
    protected_location_pings_restored: int


def chunked(values: list[dict[str, Any]], size: int = 500) -> Iterable[list[dict[str, Any]]]:
    for idx in range(0, len(values), size):
        yield values[idx : idx + size]


def scaled_integer_distribution(raw_values: list[float], target_total: int, min_value: int = 1) -> list[int]:
    if not raw_values:
        return []

    weighted = [max(v, 0.0001) for v in raw_values]
    weight_sum = sum(weighted)
    scaled = [target_total * (v / weight_sum) for v in weighted]
    ints = [max(min_value, int(v)) for v in scaled]

    diff = target_total - sum(ints)
    remainders = [s - int(s) for s in scaled]
    order = sorted(range(len(remainders)), key=lambda i: remainders[i], reverse=(diff > 0))

    cursor = 0
    while diff != 0 and order:
        i = order[cursor % len(order)]
        if diff > 0:
            ints[i] += 1
            diff -= 1
        else:
            if ints[i] > min_value:
                ints[i] -= 1
                diff += 1
        cursor += 1
        if cursor > len(order) * 20:
            break

    if sum(ints) != target_total:
        ints[-1] += target_total - sum(ints)

    return ints


def make_upi_id(full_name: str) -> str:
    cleaned = "".join(c for c in full_name.lower() if c.isalnum())
    prefix = cleaned[:8] or "worker"
    suffix = RNG.randint(1000, 9999)
    return f"{prefix}{suffix}@{RNG.choice(UPI_DOMAINS)}"


def unique_phone(used: set[str]) -> str:
    while True:
        first = str(RNG.randint(6, 9))
        rest = "".join(str(RNG.randint(0, 9)) for _ in range(9))
        phone = f"{first}{rest}"
        if phone == PROTECTED_PHONE:
            continue
        if phone not in used:
            used.add(phone)
            return phone


def get_hex_zones(supabase) -> list[dict[str, Any]]:
    res = supabase.table("hex_zones").select("h3_index, city").limit(200).execute()
    return res.data or []


def get_or_create_events(supabase, hex_ids: list[str]) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    event_rows: list[dict[str, Any]] = []
    event_map: dict[str, str] = {}

    for idx, hex_id in enumerate(hex_ids):
        event_id = str(uuid.uuid4())
        start_at = now - timedelta(days=RNG.randint(1, 15), hours=RNG.randint(1, 12))
        event_rows.append(
            {
                "id": event_id,
                "h3_index": hex_id,
                "hex_id": hex_id,
                "dci_peak": round(RNG.uniform(0.72, 0.96), 3),
                "started_at": start_at.isoformat(),
                "ended_at": (start_at + timedelta(hours=RNG.randint(2, 8))).isoformat(),
                "duration_hours": float(RNG.randint(2, 8)),
                "trigger_signals": {
                    "W": round(RNG.uniform(0.8, 1.4), 3),
                    "T": round(RNG.uniform(0.6, 1.2), 3),
                    "P": round(RNG.uniform(0.7, 1.3), 3),
                    "S": round(RNG.uniform(0.3, 1.0), 3),
                },
            }
        )
        event_map[hex_id] = event_id

    for chunk in chunked(event_rows, 200):
        supabase.table("disruption_events").upsert(chunk).execute()

    return event_map


def row_count(supabase, table: str) -> int:
    res = supabase.table(table).select("id", count="exact").limit(1).execute()
    return int(res.count or 0)


def load_protected_snapshot(supabase, protected_phone: str) -> PurgeSnapshot:
    worker_res = (
        supabase.table("workers")
        .select("*")
        .eq("phone", protected_phone)
        .limit(1)
        .execute()
    )
    worker = worker_res.data[0] if worker_res.data else None
    if not worker:
        return PurgeSnapshot(worker=None, policies=[], claims=[], location_pings=[])

    worker_id = worker["id"]
    policy_res = supabase.table("policies").select("*").eq("worker_id", worker_id).execute()
    policies = policy_res.data or []
    policy_ids = [p["id"] for p in policies if p.get("id")]

    claims: list[dict[str, Any]] = []
    if policy_ids:
        claim_by_policy = supabase.table("claims").select("*").in_("policy_id", policy_ids).execute().data or []
        claims.extend(claim_by_policy)
    claim_by_worker = supabase.table("claims").select("*").eq("worker_id", worker_id).execute().data or []
    if claim_by_worker:
        existing = {c.get("id") for c in claims}
        claims.extend([c for c in claim_by_worker if c.get("id") not in existing])

    location_pings = (
        supabase.table("location_pings")
        .select("*")
        .eq("worker_id", worker_id)
        .execute()
        .data
        or []
    )

    return PurgeSnapshot(
        worker=worker,
        policies=policies,
        claims=claims,
        location_pings=location_pings,
    )


def purge_existing_data(supabase, protected_phone: str) -> tuple[str | None, PurgeStats]:
    before_counts = {
        "claims": row_count(supabase, "claims"),
        "policies": row_count(supabase, "policies"),
        "workers": row_count(supabase, "workers"),
        "location_pings": row_count(supabase, "location_pings"),
    }

    snapshot = load_protected_snapshot(supabase, protected_phone)
    protected_worker_id = snapshot.worker.get("id") if snapshot.worker else None

    # FK-safe full purge: child tables first, then parent workers.
    supabase.table("claims").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("policies").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("location_pings").delete().neq("id", -1).execute()
    supabase.table("workers").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    restored_worker = False
    restored_policies = 0
    restored_claims = 0
    restored_location_pings = 0

    # Explicitly restore protected worker and all associated policy/claim/location rows.
    if snapshot.worker:
        supabase.table("workers").insert(snapshot.worker).execute()
        restored_worker = True

    if snapshot.policies:
        for chunk in chunked(snapshot.policies, 200):
            supabase.table("policies").insert(chunk).execute()
        restored_policies = len(snapshot.policies)

    if snapshot.claims:
        for chunk in chunked(snapshot.claims, 200):
            supabase.table("claims").insert(chunk).execute()
        restored_claims = len(snapshot.claims)

    if snapshot.location_pings:
        for chunk in chunked(snapshot.location_pings, 500):
            supabase.table("location_pings").insert(chunk).execute()
        restored_location_pings = len(snapshot.location_pings)

    after_counts = {
        "claims": row_count(supabase, "claims"),
        "policies": row_count(supabase, "policies"),
        "workers": row_count(supabase, "workers"),
        "location_pings": row_count(supabase, "location_pings"),
    }

    stats = PurgeStats(
        claims_deleted=max(0, before_counts["claims"] - after_counts["claims"]),
        policies_deleted=max(0, before_counts["policies"] - after_counts["policies"]),
        workers_deleted=max(0, before_counts["workers"] - after_counts["workers"]),
        location_pings_deleted=max(0, before_counts["location_pings"] - after_counts["location_pings"]),
        protected_worker_restored=restored_worker,
        protected_policies_restored=restored_policies,
        protected_claims_restored=restored_claims,
        protected_location_pings_restored=restored_location_pings,
    )
    return protected_worker_id, stats


def clear_neo4j_graph() -> None:
    from backend.config import settings

    if not settings.NEO4J_URI or not settings.NEO4J_USER or not settings.NEO4J_PASSWORD:
        print("[warn] Neo4j is not configured; skipping graph purge.")
        return

    driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        connection_timeout=5.0,
    )
    db = settings.NEO4J_DATABASE.strip() or None
    try:
        with driver.session(database=db) as session:
            session.run("MATCH (n) DETACH DELETE n")
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] Neo4j purge failed: {exc}")
    finally:
        driver.close()


def build_workers(hex_zones: list[dict[str, Any]], count: int) -> list[WorkerSeed]:
    if len(hex_zones) < 5:
        raise RuntimeError("Need at least 5 hex zones in hex_zones table to build fraud ring links.")

    used_phones: set[str] = set()
    workers: list[WorkerSeed] = []

    for i in range(count):
        zone = hex_zones[i % len(hex_zones)]
        full_name = FAKER.name()
        phone = unique_phone(used_phones)
        platform = RNG.choice(PLATFORMS)

        workers.append(
            WorkerSeed(
                id=str(uuid.uuid4()),
                phone=phone,
                name=full_name,
                upi_id=make_upi_id(full_name),
                hex_id=zone["h3_index"],
                city=zone.get("city") or "Bengaluru",
                dark_store_zone=f"BLR-{RNG.randint(1, 30):02d}",
                latitude=round(12.85 + RNG.random() * 0.30, 6),
                longitude=round(77.48 + RNG.random() * 0.35, 6),
                avg_daily_earnings=RNG.randint(700, 1800),
                device_model=RNG.choice(DEVICE_MODELS),
                device_os_version=f"Android {RNG.randint(10, 14)}",
                sim_carrier=RNG.choice(CARRIERS),
                sim_registration_date=FAKER.date_between(start_date="-2y", end_date="-4m"),
                platform_affiliation=platform,
                platform_id=f"{platform[:3].upper()}-{RNG.randint(100000, 999999)}",
                is_platform_verified=RNG.random() < 0.7,
                trust_score=RNG.randint(42, 89),
                active_delivery_days_30d=RNG.randint(8, 24),
                device_token=f"dv-{uuid.uuid4().hex[:16]}",
            )
        )

    return workers


def inject_worker_rows(supabase, workers: list[WorkerSeed]) -> None:
    rows = [
        {
            "id": w.id,
            "phone": w.phone,
            "name": w.name,
            "city": w.city,
            "dark_store_zone": w.dark_store_zone,
            "hex_id": w.hex_id,
            "avg_daily_earnings": w.avg_daily_earnings,
            "upi_id": w.upi_id,
            "device_model": w.device_model,
            "device_os_version": w.device_os_version,
            "sim_carrier": w.sim_carrier,
            "sim_registration_date": w.sim_registration_date.isoformat(),
            "trust_score": w.trust_score,
            "status": "active",
            "role": "worker",
            "gig_company": w.platform_affiliation,
            "latitude": w.latitude,
            "longitude": w.longitude,
            "location_accuracy": round(RNG.uniform(8, 38), 2),
            "location_captured_at": datetime.now(timezone.utc).isoformat(),
            "platform_affiliation": w.platform_affiliation,
            "platform_id": w.platform_id,
            "is_platform_verified": w.is_platform_verified,
            "device_token": w.device_token,
        }
        for w in workers
    ]

    for chunk in chunked(rows, 200):
        supabase.table("workers").insert(chunk).execute()


def inject_policy_rows(supabase, workers: list[WorkerSeed], inactivity_ids: set[str]) -> dict[str, str]:
    raw = [RNG.uniform(0.8, 1.6) for _ in workers]
    premiums = scaled_integer_distribution(raw, TARGET_PREMIUM_POOL, min_value=1200)

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    policy_rows: list[dict[str, Any]] = []
    worker_policy: dict[str, str] = {}

    for worker, premium in zip(workers, premiums):
        policy_id = str(uuid.uuid4())
        worker_policy[worker.id] = policy_id

        # Inactivity downgrade hook: 3 workers forced to Tier B.
        if worker.id in inactivity_ids:
            tier = "B"
            source = "inactivity_downgrade"
        else:
            tier = "C" if premium >= 5000 else "B"
            source = "synthetic_seed"

        coverage = int(round(max(250, min(2200, premium * 0.38))))
        policy_rows.append(
            {
                "id": policy_id,
                "worker_id": worker.id,
                "tier": tier,
                "weekly_premium": premium,
                "coverage_cap_daily": coverage,
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "status": "active",
                "is_waiting_period": False,
                "waiting_period_ends": week_start.isoformat(),
                "source": source,
            }
        )

    for chunk in chunked(policy_rows, 200):
        supabase.table("policies").insert(chunk).execute()

    return worker_policy


def inject_claim_rows(
    supabase,
    workers: list[WorkerSeed],
    worker_policy: dict[str, str],
    fraud_ring_ids: set[str],
    event_map: dict[str, str],
) -> None:
    payable_workers = [w for w in workers if w.id not in fraud_ring_ids]
    denied_workers = [w for w in workers if w.id in fraud_ring_ids]

    paid_raw = [RNG.uniform(0.8, 1.7) for _ in payable_workers]
    paid_amounts = scaled_integer_distribution(paid_raw, TARGET_CLAIMS_PAID, min_value=1200)

    claim_rows: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for worker, payout in zip(payable_workers, paid_amounts):
        created_at = now - timedelta(days=RNG.randint(2, 26), hours=RNG.randint(1, 20))
        claim_rows.append(
            {
                "id": str(uuid.uuid4()),
                "worker_id": worker.id,
                "policy_id": worker_policy[worker.id],
                "event_id": event_map[worker.hex_id],
                "pop_validated": True,
                "fraud_score": RNG.randint(6, 24),
                "resolution_path": "fast_track",
                "payout_amount": payout,
                "disrupted_hours": round(RNG.uniform(2.0, 6.5), 2),
                "status": "paid",
                "fraud_flags": [],
                "decision": "APPROVE",
                "decision_reason": "Historical approved claim in actuarial seed run.",
                "decision_confidence": "HIGH",
                "created_at": created_at.isoformat(),
                "resolved_at": (created_at + timedelta(hours=RNG.randint(2, 18))).isoformat(),
            }
        )

    for idx, worker in enumerate(denied_workers):
        created_at = now - timedelta(days=RNG.randint(1, 20), hours=RNG.randint(1, 16))
        claim_rows.append(
            {
                "id": str(uuid.uuid4()),
                "worker_id": worker.id,
                "policy_id": worker_policy[worker.id],
                "event_id": event_map[worker.hex_id],
                "pop_validated": False,
                "fraud_score": RNG.randint(84, 97),
                "resolution_path": "denied",
                "payout_amount": 0,
                "disrupted_hours": round(RNG.uniform(2.5, 7.5), 2),
                "status": "denied",
                "fraud_flags": [
                    "RING_SHARED_DEVICE",
                    "MULTI_ZONE_PATTERN",
                    "DENIED_FRAUD",
                ],
                "decision": "DENY",
                "decision_reason": "Denied - Fraud (coordinated ring test injection).",
                "decision_confidence": "HIGH",
                "created_at": created_at.isoformat(),
                "resolved_at": (created_at + timedelta(hours=RNG.randint(1, 8))).isoformat(),
            }
        )

    for chunk in chunked(claim_rows, 200):
        supabase.table("claims").insert(chunk).execute()


def inject_location_pings(
    supabase,
    workers: list[WorkerSeed],
    inactivity_ids: set[str],
) -> None:
    rows: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for worker in workers:
        # Exactly 3 inactivity-hook workers have <5 active delivery days in the last 30 days.
        if worker.id in inactivity_ids:
            days = RNG.randint(2, 4)
        else:
            days = RNG.randint(8, 22)

        offsets = sorted(RNG.sample(range(1, 30), k=days))
        for offset in offsets:
            ping_at = now - timedelta(days=offset, hours=RNG.randint(6, 22), minutes=RNG.randint(0, 59))
            rows.append(
                {
                    "worker_id": worker.id,
                    "h3_index": worker.hex_id,
                    "hex_id": worker.hex_id,
                    "latitude": round(worker.latitude + RNG.uniform(-0.005, 0.005), 6),
                    "longitude": round(worker.longitude + RNG.uniform(-0.005, 0.005), 6),
                    "accuracy_radius": round(RNG.uniform(6.0, 45.0), 2),
                    "network_signal_strength": RNG.randint(2, 5),
                    "mock_location_flag": False,
                    "pinged_at": ping_at.isoformat(),
                }
            )

    for chunk in chunked(rows, 500):
        supabase.table("location_pings").insert(chunk).execute()


def inject_neo4j_fraud_ring(
    fraud_workers: list[WorkerSeed],
    fraud_hexes: list[str],
    shared_device_id: str,
) -> None:
    from backend.config import settings

    if not settings.NEO4J_URI or not settings.NEO4J_USER or not settings.NEO4J_PASSWORD:
        print("[warn] Neo4j is not configured; skipping fraud ring graph injection.")
        return

    driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        connection_timeout=5.0,
    )
    db = settings.NEO4J_DATABASE.strip() or None

    query = """
    MERGE (d:Device {fingerprint: $device_id})
    WITH d
    UNWIND $hex_ids AS hz
      MERGE (z:Hex_Zone {id: hz})
      MERGE (d)-[:SEEN_IN]->(z)
    WITH d
    UNWIND $workers AS w
      MERGE (wk:Worker {id: w.worker_id})
      MERGE (wk)-[:USES_DEVICE]->(d)
      MERGE (zone:Hex_Zone {id: w.hex_id})
      MERGE (wk)-[:CLAIMED_IN]->(zone)
    """

    worker_payload = [
        {"worker_id": worker.id, "hex_id": worker.hex_id} for worker in fraud_workers
    ]

    try:
        with driver.session(database=db) as session:
            session.run(query, device_id=shared_device_id, hex_ids=fraud_hexes, workers=worker_payload)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] Neo4j fraud ring injection failed: {exc}")
    finally:
        driver.close()


def main() -> None:
    from backend.db.client import get_supabase_admin_client

    parser = argparse.ArgumentParser(description="Repopulate Supabase + Neo4j with deterministic synthetic test data.")
    parser.add_argument("--workers", type=int, default=TARGET_WORKERS, help="Number of synthetic workers to generate (default: 20).")
    args = parser.parse_args()

    if args.workers != TARGET_WORKERS:
        raise ValueError("This script is pinned to exactly 20 workers for the requested test state.")

    supabase = get_supabase_admin_client()

    protected_worker_id, purge_stats = purge_existing_data(supabase, PROTECTED_PHONE)
    clear_neo4j_graph()

    hex_zones = get_hex_zones(supabase)
    if len(hex_zones) < 5:
        raise RuntimeError("hex_zones must contain at least 5 rows in Bengaluru before running this script.")

    workers = build_workers(hex_zones, TARGET_WORKERS)

    # Underwriting hooks: exactly 3 workers with low activity (<5 days).
    inactivity_workers = workers[:3]
    inactivity_ids = {w.id for w in inactivity_workers}
    for w in inactivity_workers:
        w.active_delivery_days_30d = RNG.randint(2, 4)

    # Fraud ring: pick 5 from remaining workers.
    fraud_workers = workers[3:8]
    fraud_ring_ids = {w.id for w in fraud_workers}
    fraud_hexes = [zone["h3_index"] for zone in hex_zones[:5]]
    shared_device_id = f"ring-device-{uuid.uuid4().hex[:16]}"

    # Ensure Supabase worker records also reflect one shared ring device signature.
    shared_platform_id = f"RING-{RNG.randint(100000, 999999)}"
    shared_registration_date = FAKER.date_between(start_date="-2y", end_date="-8m")
    for idx, worker in enumerate(fraud_workers):
        worker.device_model = "FraudRing Device"
        worker.sim_carrier = "Jio"
        worker.platform_id = shared_platform_id
        worker.sim_registration_date = shared_registration_date
        worker.device_os_version = "Android 12"
        worker.device_token = shared_device_id
        worker.hex_id = fraud_hexes[idx]

    inject_worker_rows(supabase, workers)

    # Ensure all claim event_ids exist and match seeded zones.
    unique_hex_ids = sorted({w.hex_id for w in workers})
    event_map = get_or_create_events(supabase, unique_hex_ids)

    worker_policy = inject_policy_rows(supabase, workers, inactivity_ids)
    inject_claim_rows(supabase, workers, worker_policy, fraud_ring_ids, event_map)
    inject_location_pings(supabase, workers, inactivity_ids)
    inject_neo4j_fraud_ring(fraud_workers, fraud_hexes, shared_device_id)

    total_premium = sum(
        float(row["weekly_premium"])
        for row in supabase.table("policies").select("weekly_premium").in_("worker_id", [w.id for w in workers]).execute().data or []
    )
    total_claims_paid = sum(
        float(row["payout_amount"] or 0)
        for row in supabase.table("claims").select("payout_amount").eq("status", "paid").in_("worker_id", [w.id for w in workers]).execute().data or []
    )

    print("=== Synthetic test state created ===")
    print("--- Purge summary ---")
    print(f"Claims deleted: {purge_stats.claims_deleted}")
    print(f"Policies deleted: {purge_stats.policies_deleted}")
    print(f"Workers deleted: {purge_stats.workers_deleted}")
    print(f"Location pings deleted: {purge_stats.location_pings_deleted}")
    print(
        "Protected restore: "
        f"worker={purge_stats.protected_worker_restored}, "
        f"policies={purge_stats.protected_policies_restored}, "
        f"claims={purge_stats.protected_claims_restored}, "
        f"location_pings={purge_stats.protected_location_pings_restored}"
    )
    print("--- Seed summary ---")
    print(f"Protected worker kept: {PROTECTED_PHONE} -> {protected_worker_id or 'not present'}")
    print(f"New workers inserted: {len(workers)}")
    print(f"Inactivity-hook workers (<5 active days): {len(inactivity_ids)}")
    print(f"Fraud ring workers: {len(fraud_ring_ids)}")
    print(f"Premium pool total: ₹{int(round(total_premium))}")
    print(f"Claims paid total: ₹{int(round(total_claims_paid))}")
    print(f"Shared fraud device id: {shared_device_id}")


if __name__ == "__main__":
    main()
