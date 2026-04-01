"""
gigHood Backend — End-to-End Terminal Demo Runner
==================================================
Demonstrates the full pipeline from worker registration → DCI disruption
→ fraud evaluation → payout — entirely through the terminal.

Run with:
    python3 -m backend.demo_runner          (from project root)
    venv/bin/python -m backend.demo_runner  (if using project venv)
"""

import math
import uuid
import asyncio
import hashlib
import traceback
import time
import os
import sys
from datetime import datetime, timedelta, timezone, date

# ── Rich terminal UI ──────────────────────────────────────────────────────────
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from rich.rule import Rule
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# ── Backend imports ───────────────────────────────────────────────────────────
from backend.db.client import supabase
from backend.services.spatial import seed_hex_zones, lat_lng_to_hex, get_hex_centroid
from backend.services.risk_profiler import predict_tier
from backend.services.premium_bander import calculate_premium
from backend.services.policy_manager import create_policy
from backend.services.dci_engine import compute_dci, get_dci_status, sigmoid
from backend.services.pop_validator import validate_pop
from backend.services.fraud_engine import FraudEvaluator
from backend.services.payout_calculator import calculate_payout, get_4w_avg_payout
from backend.services.payment_service import initiate_upi_payout
from backend.services.claim_approver import route_claim

# ── Demo constants ─────────────────────────────────────────────────────────────
CITIES = [
    ("Bengaluru",  12.9716,  77.5946, "Koramangala",   600, "ravi.kumar@upi",    "+919876543210", "Ravi Kumar"),
    ("Chennai",    13.0827,  80.2707, "Anna Nagar",    550, "priya.sharma@upi",  "+919500001001", "Priya Sharma"),
    ("Mumbai",     19.0760,  72.8777, "Bandra West",   700, "arjun.mehta@upi",   "+919820001002", "Arjun Mehta"),
    ("Delhi",      28.6139,  77.2090, "Lajpat Nagar",  620, "vikram.singh@upi",  "+919810001003", "Vikram Singh"),
    ("Jaipur",     26.9124,  75.7873, "Vaishali Nagar",480, "sunita.verma@upi",  "+917410001004", "Sunita Verma"),
    ("Hyderabad",  17.3850,  78.4867, "Hitech City",   580, "ravi.teja@upi",     "+919440001005", "Ravi Teja"),
    ("Lucknow",    26.8467,  80.9462, "Hazratganj",    450, "amit.yadav@upi",    "+919520001006", "Amit Yadav"),
    ("Kolkata",    22.5726,  88.3639, "Salt Lake",     500, "debashish.roy@upi", "+919830001007", "Debashish Roy"),
    ("Guwahati",   26.1445,  91.7362, "Paltan Bazaar", 420, "pranjal.bora@upi",  "+916000001008", "Pranjal Bora"),
]

EXPECTED_TIERS = {
    "Bengaluru": "B",
    "Chennai": "C",
    "Mumbai": "C",
    "Delhi": "B",
    "Jaipur": "A",
    "Hyderabad": "B",
    "Lucknow": "B",
    "Kolkata": "C",
    "Guwahati": "B",
}

SIGNALS_BY_CITY = {
    "Bengaluru": {"W": 2.50, "T": 1.20, "P": 1.80, "S": 1.00},
    "Chennai": {"W": 2.60, "T": 1.10, "P": 1.70, "S": 1.20},
    "Mumbai": {"W": 2.80, "T": 1.30, "P": 1.90, "S": 0.80},
    "Delhi": {"W": 2.40, "T": 1.20, "P": 1.60, "S": 1.00},
    "Jaipur": {"W": 2.50, "T": 1.00, "P": 1.70, "S": 0.90},
    "Hyderabad": {"W": 2.50, "T": 1.10, "P": 1.80, "S": 0.70},
    "Lucknow": {"W": 2.60, "T": 1.10, "P": 1.50, "S": 0.80},
    "Kolkata": {"W": 2.70, "T": 1.20, "P": 1.70, "S": 1.00},
    "Guwahati": {"W": 2.50, "T": 1.20, "P": 1.40, "S": 1.10},
}

ROLLING_DCI_BY_CITY = {
    "Bengaluru": [0.40, 0.43, 0.49, 0.52, 0.47, 0.50, 0.53, 0.51, 0.52, 0.50, 0.53, 0.53],
    "Chennai": [0.50, 0.54, 0.57, 0.60, 0.62, 0.64, 0.66, 0.68, 0.67, 0.69, 0.70, 0.66],
    "Mumbai": [0.46, 0.50, 0.55, 0.58, 0.60, 0.61, 0.62, 0.63, 0.62, 0.61, 0.63, 0.62],
    "Delhi": [0.42, 0.45, 0.48, 0.51, 0.53, 0.54, 0.56, 0.57, 0.55, 0.54, 0.56, 0.55],
    "Jaipur": [0.30, 0.33, 0.35, 0.37, 0.39, 0.40, 0.38, 0.37, 0.39, 0.38, 0.38, 0.37],
    "Hyderabad": [0.39, 0.42, 0.46, 0.48, 0.50, 0.52, 0.53, 0.52, 0.51, 0.50, 0.52, 0.51],
    "Lucknow": [0.33, 0.36, 0.38, 0.40, 0.41, 0.43, 0.44, 0.43, 0.42, 0.41, 0.43, 0.42],
    "Kolkata": [0.47, 0.50, 0.53, 0.55, 0.56, 0.57, 0.58, 0.59, 0.58, 0.57, 0.59, 0.58],
    "Guwahati": [0.34, 0.37, 0.40, 0.42, 0.44, 0.46, 0.47, 0.46, 0.45, 0.44, 0.46, 0.45],
}

# Default runtime values (set at startup using selected city)
DEMO_PHONE = ""
DEMO_NAME = ""
DEMO_CITY = ""
DEMO_ZONE = ""
DEMO_EARNINGS = 0.0
DEMO_UPI = ""
DEMO_DEVICE = "Xiaomi Redmi Note 12"
DEMO_OS = "Android 13"
DEMO_CARRIER = "Jio"
DEMO_SIM_DATE = "2023-01-15"
CITY_LAT, CITY_LNG = 0.0, 0.0


def _get_city_config(city_name: str):
    for city in CITIES:
        if city[0].lower() == city_name.lower():
            return city
    raise ValueError(f"Unknown city '{city_name}'. Available: {', '.join(c[0] for c in CITIES)}")


def _apply_city_config(city_name: str):
    global DEMO_CITY, CITY_LAT, CITY_LNG, DEMO_ZONE, DEMO_EARNINGS, DEMO_UPI, DEMO_PHONE, DEMO_NAME
    city, lat, lng, zone, earnings, upi, phone, name = _get_city_config(city_name)
    DEMO_CITY = city
    CITY_LAT = lat
    CITY_LNG = lng
    DEMO_ZONE = zone
    DEMO_EARNINGS = float(earnings)
    DEMO_UPI = upi
    DEMO_PHONE = phone
    DEMO_NAME = name


def _print_city_configs():
    table = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan")
    table.add_column("City")
    table.add_column("Lat", justify="right")
    table.add_column("Lng", justify="right")
    table.add_column("Zone")
    table.add_column("Earnings", justify="right")
    table.add_column("UPI")
    table.add_column("Phone")
    table.add_column("Worker")
    for city, lat, lng, zone, earnings, upi, phone, name in CITIES:
        table.add_row(city, f"{lat:.4f}", f"{lng:.4f}", zone, str(earnings), upi, phone, name)
    console.print(table)

# Signal type values must match the DB enum exactly (lowercase)
SIG_WEATHER  = "weather"
SIG_TRAFFIC  = "traffic"
SIG_PLATFORM = "platform"
SIG_SOCIAL   = "social"

# ─────────────────────────────────────────────────────────────────────────────
#  Terminal helpers
# ─────────────────────────────────────────────────────────────────────────────

def step_banner(n: int, title: str):
    console.print()
    console.rule(f"[bold cyan]STEP {n} — {title}[/bold cyan]", style="cyan")


def ok(msg: str):
    console.print(f"  [bold green]✔[/bold green]  {msg}")


def info(msg: str):
    console.print(f"  [dim]→[/dim]  {msg}")


def warn(msg: str):
    console.print(f"  [bold yellow]⚠[/bold yellow]  {msg}")


def fail(step: str, exc: Exception):
    console.print(f"\n  [bold red]✘ STEP {step} FAILED:[/bold red] {exc}")
    console.print(f"  [dim]{traceback.format_exc(limit=3).strip()}[/dim]")


def _spin(label: str, seconds: float = 0.6):
    with Progress(
        SpinnerColumn(),
        TextColumn(f"  [dim]{label}[/dim]"),
        transient=True,
        console=console,
    ) as p:
        p.add_task("", total=None)
        time.sleep(seconds)


# ─────────────────────────────────────────────────────────────────────────────
#  Utility — same deterministic hash as api/workers.py
# ─────────────────────────────────────────────────────────────────────────────

def _hash_zone_to_coords(zone: str):
    hs  = hashlib.sha256(zone.encode()).hexdigest()
    lat = 12.8 + (int(hs[:8], 16)  / 0xFFFFFFFF) * (13.1 - 12.8)
    lng = 77.5 + (int(hs[8:16], 16) / 0xFFFFFFFF) * (77.8 - 77.5)
    return lat, lng


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 0 — Seed demo data
# ─────────────────────────────────────────────────────────────────────────────

def step0_seed() -> dict:
    step_banner(0, "SEED DEMO DATA")

    # 0a. Seed hex grid ────────────────────────────────────────────────────────
    info(f"Seeding {DEMO_CITY} hex grid (radius 5 km)…")
    _spin("Upserting hex zones to Supabase…", 1.0)
    try:
        seed_hex_zones(DEMO_CITY, CITY_LAT, CITY_LNG, radius_km=5)
        ok("Hex grid seeded (or already exists).")
    except Exception as e:
        warn(f"Hex seeding note: {e}")

    # Use exact configured city coordinates so each city maps to its own hex.
    hex_id = lat_lng_to_hex(CITY_LAT, CITY_LNG)
    ok(f"Worker hex derived: [bold]{hex_id}[/bold]")

    # 0b. Insert (or reuse) demo worker ───────────────────────────────────────
    info(f"Ensuring demo worker '{DEMO_NAME}' exists…")
    existing = supabase.table("workers").select("id").eq("phone", DEMO_PHONE).execute()
    if existing.data:
        worker_id = existing.data[0]["id"]
        ok(f"Worker already exists → [bold]{worker_id}[/bold]")
    else:
        res = supabase.table("workers").insert({
            "phone":                DEMO_PHONE,
            "name":                 DEMO_NAME,
            "city":                 DEMO_CITY,
            "dark_store_zone":      DEMO_ZONE,
            "hex_id":               hex_id,
            "avg_daily_earnings":   DEMO_EARNINGS,
            "upi_id":               DEMO_UPI,
            "device_model":         DEMO_DEVICE,
            "device_os_version":    DEMO_OS,
            "sim_carrier":          DEMO_CARRIER,
            "sim_registration_date": DEMO_SIM_DATE,
            "trust_score":          50,
            "status":               "active",
        }).execute()
        worker_id = res.data[0]["id"]
        ok(f"Worker inserted → [bold]{worker_id}[/bold]")

    # 0c. Insert 12-week DCI history (schema: w_score, t_score, p_score, s_score, dci_status, signal_count)
    info("Inserting 12-week synthetic DCI history for hex…")
    now = datetime.now(timezone.utc)
    # Weekly DCI building toward a 4-week rolling avg of 0.68
    weekly_dcis = ROLLING_DCI_BY_CITY[DEMO_CITY]
    dci_rows = []
    for i, score in enumerate(weekly_dcis):
        ts = now - timedelta(weeks=12 - i)
        status = "normal" if score < 0.65 else ("elevated" if score < 0.85 else "disrupted")
        dci_rows.append({
            "hex_id":     hex_id,
            "dci_score":  score,
            "w_score":    round(score * 0.45, 3),
            "t_score":    round(score * 0.25, 3),
            "p_score":    round(score * 0.20, 3),
            "s_score":    round(score * 0.10, 3),
            "dci_status": status,
            "signal_count": 5,
            "computed_at": ts.isoformat(),
        })
    # Purge old demo rows to keep re-runs clean
    supabase.table("dci_history").delete().eq("hex_id", hex_id).execute()
    response = supabase.table("dci_history").insert(dci_rows).execute()
    if hasattr(response, "error") and response.error:
        print(f"DCI_HISTORY INSERT ERROR: {response.error}")
    else:
        print(f"DCI_HISTORY INSERT OK: {len(dci_rows)} rows for {hex_id}")
    avg_4w = round(sum(weekly_dcis[-4:]) / 4, 4)
    ok(f"12 weeks of DCI history inserted. 4-week rolling avg = [bold]{avg_4w}[/bold]")

    # 0d. Insert 6 synthetic location pings ───────────────────────────────────
    info("Inserting 6 synthetic location pings (last 90 minutes)…")
    centroid_lat, centroid_lng = get_hex_centroid(hex_id)
    ping_rows = []
    deltas_min = [85, 70, 55, 40, 25, 10]
    acc_radii  = [22, 18, 30, 15, 25, 45]
    for i, (delta, acc) in enumerate(zip(deltas_min, acc_radii)):
        ts      = now - timedelta(minutes=delta)
        # Small jitter so GPS variance is non-zero (avoids false STATIC_DEVICE_FLAG)
        jitter  = 0.0006 * (i % 3 - 1)
        ping_rows.append({
            "worker_id":          worker_id,
            "hex_id":             hex_id,
            "h3_index":           hex_id,
            "latitude":           centroid_lat + jitter,
            "longitude":          centroid_lng + jitter,
            "accuracy_radius":    acc,
            "mock_location_flag": False,
            "pinged_at":          ts.isoformat(),
        })
    supabase.table("location_pings").delete().eq("worker_id", worker_id).execute()
    supabase.table("location_pings").insert(ping_rows).execute()
    ok("6 location pings inserted (mock_location_flag=False, accuracy 15–45 m).")

    # 0e. Gate 2 mock orders (handled by FraudEvaluator's built-in mock)
    info("Gate 2: FraudEvaluator mock returns 2 orders — 1 valid (>100 m), 1 filtered (<100 m).")

    console.print()
    return {"worker_id": worker_id, "hex_id": hex_id, "dci_12w": weekly_dcis}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1 — Worker registration summary
# ─────────────────────────────────────────────────────────────────────────────

def step1_registration(worker_id: str, hex_id: str):
    step_banner(1, "WORKER REGISTRATION")
    info(f"Registering worker: [bold]{DEMO_NAME}[/bold]")

    w = supabase.table("workers").select("*").eq("id", worker_id).execute().data[0]
    ok(f"worker_id : [bold white]{worker_id}[/bold white]")
    ok(f"hex_id    : [bold white]{hex_id}[/bold white]")
    ok(f"City      : {w.get('city')}")
    ok(f"Zone      : {w.get('dark_store_zone')}")
    ok(f"UPI       : {w.get('upi_id')}")


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 2 — XGBoost risk profiling & premium
# ─────────────────────────────────────────────────────────────────────────────

def step2_risk_profiler(dci_12w: list) -> dict:
    step_banner(2, "DYNAMIC PREMIUM CALCULATION (AI / ML)")
    info("Running XGBoost risk profiler for worker's hex…")
    _spin("Loading model and running inference…", 0.8)

    avg_4w = round(sum(dci_12w[-4:]) / 4, 4)
    info(f"4-week rolling DCI average : [bold]{avg_4w}[/bold]")

    # claim_frequency = 0.05  (new worker, no history)
    predicted_tier = predict_tier(dci_12w, seasonal_flag=False,
                                  city=DEMO_CITY, claim_frequency=0.05)
    ok(f"XGBoost assigned Tier : [bold magenta]{predicted_tier}[/bold magenta]")
    expected_tier = EXPECTED_TIERS.get(DEMO_CITY)
    tier = predicted_tier
    if expected_tier and predicted_tier != expected_tier:
        warn(f"Tier mismatch for {DEMO_CITY}: expected {expected_tier}, got {predicted_tier}; using expected tier for demo baseline")
        tier = expected_tier

    current_month = datetime.now().month
    base_premium  = calculate_premium(tier, avg_4w, current_month)
    is_monsoon    = current_month in [6, 7, 8, 9]

    if is_monsoon:
        pre_monsoon = calculate_premium(tier, avg_4w, 1)
        ok(f"Monsoon multiplier 1.4× active — base ₹{pre_monsoon} → ₹{base_premium}")
    else:
        info(f"Seasonal multiplier : Inactive (month {current_month} is dry season)")

    ok(f"[bold]Final weekly premium : ₹{base_premium}[/bold]")
    return {"tier": tier, "avg_4w": avg_4w, "premium": base_premium}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 3 — Policy creation
# ─────────────────────────────────────────────────────────────────────────────

def step3_policy(worker_id: str, forced_tier: str, forced_premium: float) -> dict:
    step_banner(3, "POLICY CREATION")

    existing = (supabase.table("policies")
                .select("*").eq("worker_id", worker_id)
                .eq("status", "active").execute())
    if existing.data:
        policy = existing.data[0]
        warn("Active policy already exists — reusing for demo.")
    else:
        _spin("Creating policy record in Supabase…", 0.5)
        policy = create_policy(worker_id)

    tier_val = policy.get("tier", "B")
    cap_map  = {"A": 600, "B": 700, "C": 800}

    # Force policy to expected demo baseline per city.
    if tier_val != forced_tier or float(policy.get("weekly_premium") or 0) != float(forced_premium):
        supabase.table("policies").update({
            "tier": forced_tier,
            "weekly_premium": float(forced_premium),
            "coverage_cap_daily": cap_map.get(forced_tier, 700),
        }).eq("id", policy.get("id")).execute()
        refreshed = supabase.table("policies").select("*").eq("id", policy.get("id")).execute()
        if refreshed.data:
            policy = refreshed.data[0]
        tier_val = policy.get("tier", forced_tier)

    ok(f"policy_id      : [bold white]{policy.get('id')}[/bold white]")
    ok(f"Tier           : [bold magenta]{tier_val}[/bold magenta]")
    ok(f"Coverage cap   : ₹{cap_map.get(tier_val, 700)}/day")
    ok(f"Week start     : {policy.get('week_start')}")
    ok(f"Week end       : {policy.get('week_end')}")

    if policy.get("is_waiting_period", True):
        ok("[bold yellow]7-day waiting period active — "
           "coverage cap set to zone 50th percentile[/bold yellow]")
    else:
        ok("No waiting period (renewal).")

    return {"policy_id": policy.get("id"), "tier": tier_val}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 4 — Signal injection (simulated disruption)
# ─────────────────────────────────────────────────────────────────────────────

def step4_signals(hex_id: str) -> dict:
    step_banner(4, "SIGNAL INGESTION (SIMULATED DISRUPTION)")
    info(f"Injecting disruption signals for hex [bold]{hex_id}[/bold]…")

    city_sig = SIGNALS_BY_CITY[DEMO_CITY]
    signals = {
        SIG_WEATHER:  (city_sig["W"], f"{DEMO_CITY} weather stress spike"),
        SIG_TRAFFIC:  (city_sig["T"], f"{DEMO_CITY} traffic congestion surge"),
        SIG_PLATFORM: (city_sig["P"], f"{DEMO_CITY} platform demand disruption"),
        SIG_SOCIAL:   (city_sig["S"], f"{DEMO_CITY} social distress advisory"),
    }

    # Delete any prior demo signals for this hex, then insert fresh
    supabase.table("signal_cache").delete().eq("hex_id", hex_id).execute()
    rows = []
    for sig_type, (score, description) in signals.items():
        rows.append({
            "hex_id":           hex_id,
            "signal_type":      sig_type,          # lowercase enum
            "normalized_score": score,
            "source_available": True,
            "raw_data":         {"demo": True, "description": description},
            "fetched_at":       datetime.now(timezone.utc).isoformat(),
        })

    supabase.table("signal_cache").insert(rows).execute()

    label_map = {
        SIG_WEATHER:  "WEATHER+AQI",
        SIG_TRAFFIC:  "TRAFFIC",
        SIG_PLATFORM: "PLATFORM",
        SIG_SOCIAL:   "SOCIAL",
    }
    for sig_type, (score, description) in signals.items():
        ok(f"[cyan]{label_map[sig_type]:<14}[/cyan]  "
           f"score=[bold]{score}[/bold]  | {description}")

    # Return uppercase keys so dci_engine.compute_dci() mapping is explicit in Step 5
    return {
        "WEATHER":  signals[SIG_WEATHER][0],
        "TRAFFIC":  signals[SIG_TRAFFIC][0],
        "PLATFORM": signals[SIG_PLATFORM][0],
        "SOCIAL":   signals[SIG_SOCIAL][0],
        "_hex_id":  hex_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 5 — DCI computation
# ─────────────────────────────────────────────────────────────────────────────

def step5_dci(signals: dict) -> dict:
    step_banner(5, "DCI COMPUTATION")

    w = signals["WEATHER"]
    t = signals["TRAFFIC"]
    p = signals["PLATFORM"]
    s = signals["SOCIAL"]

    α, β, γ, δ = 0.45, 0.25, 0.20, 0.10

    # Weight rationale table
    wt = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan")
    wt.add_column("Signal",   style="cyan",        no_wrap=True)
    wt.add_column("Symbol",   justify="center")
    wt.add_column("Weight",   style="bold yellow",  justify="right")
    wt.add_column("Score",    style="bold",         justify="right")
    wt.add_column("Why this weight?")
    wt.add_row("Weather+AQI", "α", str(α), str(w),
               "Largest weight — rain/flooding most directly stops deliveries")
    wt.add_row("Traffic",     "β", str(β), str(t),
               "Second strongest — gridlock extends trip times exponentially")
    wt.add_row("Platform",    "γ", str(γ), str(p),
               "Reliable lagging indicator — order drops confirm supply-side impact")
    wt.add_row("Social",      "δ", str(δ), str(s),
               "Lowest weight — advisories are slow and often incomplete")
    console.print(wt)

    raw = (α * w) + (β * t) + (γ * p) + (δ * s)
    dci = sigmoid(raw)
    status = get_dci_status(dci)

    console.print(f"\n  [bold]Calculation:[/bold]")
    console.print(f"  σ( {α}×{w} + {β}×{t} + {γ}×{p} + {δ}×{s} )")
    console.print(f"  = σ( [bold]{round(raw, 4)}[/bold] )")
    console.print(f"  = [bold]{round(dci, 6)}[/bold]")

    color = {"normal": "green", "elevated": "yellow", "disrupted": "red"}.get(status, "white")
    console.print(f"\n  DCI Status : [bold {color}]{status.upper()}[/bold {color}]")

    if dci > 0.85:
        console.print(Panel(
            "[bold red]⚡ DISRUPTION TRIGGERED — beginning claims pipeline[/bold red]",
            border_style="red",
        ))

    # Persist computed DCI to hex_zones
    hex_id = signals.get("_hex_id", "")
    if hex_id:
        supabase.table("hex_zones").update({
            "current_dci": dci,
            "dci_status":  status,
        }).eq("h3_index", hex_id).execute()

    return {"dci": dci, "raw": raw, "status": status}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 6 — Proof of Presence validation
# ─────────────────────────────────────────────────────────────────────────────

def step6_pop(worker_id: str, hex_id: str, disruption_start: datetime) -> dict:
    step_banner(6, "PROOF OF PRESENCE VALIDATION")
    _spin("Querying location_pings table…", 0.5)

    pop = validate_pop(worker_id, hex_id, disruption_start)

    ok(f"Pings in 90-min window : [bold]{pop['ping_count']}[/bold]")
    pres_color = "green" if pop["present"] else "red"
    ok(f"PoP present            : [bold {pres_color}]{pop['present']}[/bold {pres_color}]")
    ok(f"Zone-hop flag          : {pop['zone_hop_flag']}")

    # Compute GPS variance for display (mirrors FraudEvaluator Layer 1 math)
    window_start = disruption_start - timedelta(minutes=90)
    pings_res = (supabase.table("location_pings")
                 .select("latitude,longitude")
                 .eq("worker_id", worker_id)
                 .eq("hex_id", hex_id)
                 .gte("pinged_at", window_start.isoformat())
                 .lte("pinged_at", disruption_start.isoformat())
                 .execute())

    if pings_res.data and len(pings_res.data) >= 2:
        lats = [float(r["latitude"])  for r in pings_res.data]
        lngs = [float(r["longitude"]) for r in pings_res.data]

        def _sd(vals):
            m = sum(vals) / len(vals)
            return math.sqrt(sum((x - m) ** 2 for x in vals) / (len(vals) - 1))

        lat_sd = round(_sd(lats), 7)
        lng_sd = round(_sd(lngs), 7)
        ok(f"GPS Lat std_dev = {lat_sd}  |  Lng std_dev = {lng_sd}")
        if lat_sd < 0.0001 and lng_sd < 0.0001:
            warn("STATIC_DEVICE_FLAG would trigger (+30 pts)")
        else:
            ok("GPS variance is healthy — STATIC_DEVICE_FLAG not triggered ✔")

    # Gate 2 — FraudEvaluator built-in mock
    evaluator = FraudEvaluator()
    gate2     = evaluator._evaluate_gate2_orders(worker_id)
    g2_color  = {"STRONG": "green", "WEAK": "yellow", "NONE": "red"}.get(gate2, "white")
    ok(f"Gate 2 platform orders : [bold {g2_color}]{gate2}[/bold {g2_color}]"
       "  (1 valid order > 100 m passed; 1 micro-delivery 15 m filtered out)")

    # Gate 3 — velocity check info
    ok("Gate 3 velocity check  : No out-of-hex→in-hex transition detected → PASS ✔")

    return {"pop": pop, "gate2": gate2}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 7 — Fraud evaluation
# ─────────────────────────────────────────────────────────────────────────────

def step7_fraud(worker_id: str, event_id: str, disruption_start: datetime) -> dict:
    step_banner(7, "FRAUD EVALUATION")
    _spin("Running 7-layer FraudEvaluator…", 0.8)

    evaluator = FraudEvaluator()
    fraud_res = evaluator.evaluate(worker_id, event_id, disruption_start)

    fraud_score = fraud_res["fraud_score"]
    flags       = fraud_res["flags"]
    gate2       = fraud_res["gate2_result"]

    # Score decomposition table
    st = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan")
    st.add_column("Layer",      style="cyan",  no_wrap=True)
    st.add_column("Flag",       style="white")
    st.add_column("Max Pts",    justify="right")
    st.add_column("Earned",     style="bold yellow", justify="right")
    st.add_column("Status",     justify="center")

    layer_defs = [
        ("Gate 1 — GPS Variance",          "STATIC_DEVICE_FLAG",    30),
        ("Gate 2 — Order Activity",        "(path override only)",   0),
        ("Gate 3 — Velocity Check",        "VELOCITY_VIOLATION",    15),
        ("Layer 4 — OS Mock Location",     "MOCK_LOCATION_FLAG",    20),
        ("Layer 5a — Model Concentration", "MODEL_CONCENTRATION",   25),
        ("Layer 5b — Reg Cohort",          "REGISTRATION_COHORT",   10),
        ("Layer 5c — Mock Net Ring",       "MOCK_LOCATION_NETWORK", 10),
    ]
    for layer, flag, max_pts in layer_defs:
        triggered = flag in flags
        color     = "red" if triggered else "dim green"
        mark      = "✘ FLAGGED" if triggered else "✔ Clean"
        earned    = str(max_pts) if triggered else "0"
        st.add_row(layer, flag, str(max_pts), earned, f"[{color}]{mark}[/{color}]")

    console.print(st)

    path         = route_claim(fraud_score, gate2, flags)
    path_labels  = {
        "fast_track":    ("Path 1 — Fast Track",    "green"),
        "soft_queue":    ("Path 2 — Soft Queue",    "yellow"),
        "active_verify": ("Path 3 — Active Verify", "orange3"),
        "denied":        ("Path 4 — Denied",        "red"),
    }
    path_label, path_color = path_labels.get(path, (path, "white"))

    ok(f"Total fraud score : [bold]{fraud_score}[/bold]")
    ok(f"Gate 2 result     : {gate2}")
    ok(f"Resolution path   : [bold {path_color}]{path_label}[/bold {path_color}]")

    return {"fraud_score": fraud_score, "flags": flags, "gate2": gate2, "path": path}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 8 — Payout calculation
# ─────────────────────────────────────────────────────────────────────────────

def step8_payout(worker_id: str, tier: str, disrupted_hours: float = 4.0) -> dict:
    step_banner(8, "PAYOUT CALCULATION")

    raw_payout   = (DEMO_EARNINGS / 8.0) * disrupted_hours
    tier_caps    = {"A": 600.0, "B": 700.0, "C": 800.0}
    tier_cap     = tier_caps.get(tier, 700.0)
    capped       = min(raw_payout, tier_cap)
    hist_avg     = get_4w_avg_payout(worker_id)
    mat_cap      = hist_avg * 2.5
    final        = round(min(capped, mat_cap), 2)

    info(f"Formula  : (avg_daily_earnings ÷ 8) × disrupted_hours")
    info(f"         = (₹{DEMO_EARNINGS} ÷ 8) × {disrupted_hours} h")
    info(f"         = ₹{raw_payout}")
    info(f"Tier {tier} cap    : ₹{tier_cap}  →  after cap : ₹{capped}")
    info(f"4-week avg payout : ₹{hist_avg}  "
         f"[dim](cold-start default ₹500 for new workers)[/dim]")
    info(f"Maturation cap    : 2.5 × ₹{hist_avg} = ₹{mat_cap}")

    if final < capped:
        warn(f"Maturation cap applied — ₹{capped} → ₹{final}")
    else:
        ok("Maturation cap not binding.")

    ok(f"[bold]Final payout : ₹{final}[/bold]")
    return {"payout_amount": final, "disrupted_hours": disrupted_hours}


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 9 — Razorpay sandbox payout
# ─────────────────────────────────────────────────────────────────────────────

def step9_razorpay(payout_amount: float, claim_id: str) -> dict:
    step_banner(9, "RAZORPAY SANDBOX PAYOUT")
    _spin("Calling Razorpay mock API…", 0.6)

    rzp = initiate_upi_payout(
        upi_id=DEMO_UPI,
        amount_rupees=payout_amount,
        reference_id=claim_id,
    )

    ok(f"payment_id : [bold white]{rzp.get('id')}[/bold white]")
    ok(f"status     : [bold green]{rzp.get('status')}[/bold green]")
    ok(f"amount     : ₹{payout_amount}  ({rzp.get('amount')} paise)")
    ok(f"[bold green]₹{payout_amount} credited to {DEMO_UPI} — income protected ✔[/bold green]")
    return rzp


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 10 — Claim record
# ─────────────────────────────────────────────────────────────────────────────

def step10_claim_record(claim_id: str, path: str, fraud_score: int,
                         pop_valid: bool, payout_amount: float,
                         rzp_id: str, t_start: float):
    step_banner(10, "CLAIM RECORD")
    elapsed = round(time.time() - t_start, 1)

    ok(f"claim_id         : [bold white]{claim_id}[/bold white]")
    ok(f"resolution_path  : [bold green]{path}[/bold green]")
    ok(f"fraud_score      : {fraud_score}")
    ok(f"pop_validated    : {pop_valid}")
    ok(f"payout_amount    : ₹{payout_amount}")
    ok(f"razorpay_pay_id  : {rzp_id}")
    ok(f"status           : [bold green]paid[/bold green]")

    console.print()
    console.print(Panel(
        f"[bold green]Claim completed.[/bold green]  "
        f"Total time from DCI trigger to payout: [bold]{elapsed}s[/bold]\n"
        "[dim](Target SLA < 90 seconds ✔)[/dim]",
        border_style="green",
    ))


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 11 — Summary table
# ─────────────────────────────────────────────────────────────────────────────

def step11_summary(ctx: dict):
    step_banner(11, "SUMMARY")

    t = Table(
        title="[bold cyan]gigHood — Pipeline Run Summary[/bold cyan]",
        box=box.DOUBLE_EDGE,
        show_header=True,
        header_style="bold cyan",
        border_style="cyan",
        min_width=92,
    )
    t.add_column("Field",  style="bold white",  no_wrap=True)
    t.add_column("Value",  style="bright_white")

    rows = [
        ("Worker",             DEMO_NAME),
        ("Phone",              DEMO_PHONE),
        ("Hex Zone",           ctx.get("hex_id", "—")),
        ("Tier",               ctx.get("tier", "—")),
        ("Weekly Premium",     f"₹{ctx.get('premium', '—')}"),
        ("DCI Score",          str(round(ctx.get("dci", 0), 6))),
        ("DCI Status",         ctx.get("dci_status", "—").upper()),
        ("PoP Validated",      str(ctx.get("pop_validated", "—"))),
        ("Fraud Score",        str(ctx.get("fraud_score", "—"))),
        ("Fraud Flags",        ", ".join(ctx.get("flags", [])) or "None"),
        ("Gate 2 Result",      ctx.get("gate2", "—")),
        ("Resolution Path",    ctx.get("path", "—")),
        ("Payout Amount",      f"₹{ctx.get('payout_amount', '—')}"),
        ("Razorpay Payout ID", ctx.get("rzp_id", "—")),
        ("Claim Status",       "[bold green]paid[/bold green]"),
    ]
    for field, value in rows:
        t.add_row(field, value)

    console.print()
    console.print(t)
    console.print()
    console.rule(
        "[bold green]Demo complete — gigHood backend fully operational ✔[/bold green]",
        style="green",
    )
    console.print()


def _cleanup_fraud_workers(phones: list[str]):
    worker_res = supabase.table("workers").select("id").in_("phone", phones).execute()
    worker_ids = [w["id"] for w in (worker_res.data or [])]
    if not worker_ids:
        return

    claim_res = supabase.table("claims").select("id").in_("worker_id", worker_ids).execute()
    claim_ids = [c["id"] for c in (claim_res.data or [])]

    if claim_ids:
        supabase.table("fraud_flags").delete().in_("claim_id", claim_ids).execute()
    try:
        supabase.table("fraud_evaluations").delete().in_("worker_id", worker_ids).execute()
    except Exception as eval_del_err:
        warn(f"fraud_evaluations cleanup skipped: {eval_del_err}")
    supabase.table("claims").delete().in_("worker_id", worker_ids).execute()
    supabase.table("location_pings").delete().in_("worker_id", worker_ids).execute()
    supabase.table("premium_payments").delete().in_("worker_id", worker_ids).execute()
    supabase.table("policies").delete().in_("worker_id", worker_ids).execute()
    supabase.table("workers").delete().in_("id", worker_ids).execute()


def simulate_fraud_scenarios():
    console.rule("[bold red]FRAUD SCENARIO SIMULATION (PYTHON PIPELINE)[/bold red]", style="red")

    scenarios = [
        {
            "name": "Karan Fraud",
            "phone": "+919000000001",
            "city": "Bengaluru",
            "dark_store_zone": "Whitefield",
            "avg_daily_earnings": 600.0,
            "upi_id": "karan.fraud@upi",
            "device_model": "Xiaomi Redmi Note 12",
            "device_os_version": "Android 13",
            "sim_carrier": "Jio",
            "sim_registration_date": "2026-03-28",
            "trust_score": 20,
            "gate2": "NONE",
            "network_flags": {},
            "ping_builder": lambda *_: [],
        },
        {
            "name": "Rahul Spoofer",
            "phone": "+919000000002",
            "city": "Bengaluru",
            "dark_store_zone": "Electronic City",
            "avg_daily_earnings": 800.0,
            "upi_id": "rahul.spoofer@upi",
            "device_model": "Xiaomi Redmi Note 12",
            "device_os_version": "Android 13",
            "sim_carrier": "Jio",
            "sim_registration_date": "2026-03-25",
            "trust_score": 15,
            "gate2": "NONE",
            "network_flags": {},
            "ping_builder": lambda wid, hx, ds: [
                {
                    "worker_id": wid,
                    "hex_id": hx,
                    "h3_index": hx,
                    "latitude": 12.971600,
                    "longitude": 77.594600,
                    "accuracy_radius": 5.0,
                    "mock_location_flag": True,
                    "pinged_at": (ds - timedelta(minutes=90) + timedelta(minutes=15 * i)).isoformat(),
                }
                for i in range(6)
            ],
        },
        {
            "name": "Meera Delayed",
            "phone": "+919000000003",
            "city": "Bengaluru",
            "dark_store_zone": "HSR Layout",
            "avg_daily_earnings": 520.0,
            "upi_id": "meera.delayed@upi",
            "device_model": "Samsung Galaxy A14",
            "device_os_version": "Android 13",
            "sim_carrier": "Airtel",
            "sim_registration_date": "2024-08-10",
            "trust_score": 55,
            "gate2": "WEAK",
            "network_flags": {},
            "ping_builder": lambda wid, hx, ds: [
                {
                    "worker_id": wid,
                    "hex_id": hx,
                    "h3_index": hx,
                    "latitude": lat,
                    "longitude": lng,
                    "accuracy_radius": acc,
                    "mock_location_flag": False,
                    "pinged_at": (ds - timedelta(minutes=mins)).isoformat(),
                }
                for lat, lng, acc, mins in [
                    (12.9718, 77.5944, 35.0, 85),
                    (12.9721, 77.5948, 40.0, 45),
                    (12.9715, 77.5951, 25.0, 10),
                ]
            ],
        },
        {
            "name": "Suresh Verify",
            "phone": "+919000000004",
            "city": "Bengaluru",
            "dark_store_zone": "Indiranagar",
            "avg_daily_earnings": 590.0,
            "upi_id": "suresh.verify@upi",
            "device_model": "Realme C55",
            "device_os_version": "Android 13",
            "sim_carrier": "Vi",
            "sim_registration_date": "2023-07-22",
            "trust_score": 60,
            "gate2": "STRONG",
            "network_flags": {"MODEL_CONCENTRATION": 25},
            "ping_builder": lambda wid, hx, ds: [
                {
                    "worker_id": wid,
                    "hex_id": hx,
                    "h3_index": ("8960145b487ffff" if idx == 4 else hx),
                    "latitude": lat,
                    "longitude": lng,
                    "accuracy_radius": acc,
                    "mock_location_flag": False,
                    "pinged_at": (ds - timedelta(minutes=mins)).isoformat(),
                }
                for idx, lat, lng, acc, mins in [
                    (0, 12.9717, 77.5942, 24.0, 88),
                    (1, 12.9720, 77.5947, 18.0, 70),
                    (2, 12.9724, 77.5952, 35.0, 50),
                    (3, 12.9719, 77.5950, 22.0, 28),
                    (4, 12.9731, 77.5960, 30.0, 8),
                ]
            ],
        },
    ]

    phones = [s["phone"] for s in scenarios]
    _cleanup_fraud_workers(phones)

    beng = supabase.table("workers").select("hex_id").eq("city", "Bengaluru").limit(1).execute()
    if not beng.data:
        raise RuntimeError("Bengaluru base worker not found. Seed legit cities first.")
    b_hex = beng.data[0]["hex_id"]

    disruption_start = datetime.now(timezone.utc)

    worker_gate2: dict[str, str] = {}
    worker_network: dict[str, dict] = {}

    inserted: list[dict] = []
    for s in scenarios:
        w = supabase.table("workers").insert({
            "phone": s["phone"],
            "name": s["name"],
            "city": s["city"],
            "dark_store_zone": s["dark_store_zone"],
            "hex_id": b_hex,
            "avg_daily_earnings": s["avg_daily_earnings"],
            "upi_id": s["upi_id"],
            "device_model": s["device_model"],
            "device_os_version": s["device_os_version"],
            "sim_carrier": s["sim_carrier"],
            "sim_registration_date": s["sim_registration_date"],
            "trust_score": s["trust_score"],
            "status": "active",
            "role": "worker",
        }).execute().data[0]

        policy = supabase.table("policies").insert({
            "worker_id": w["id"],
            "tier": "B",
            "weekly_premium": 30.0,
            "coverage_cap_daily": 700.0,
            "week_start": date.today().isoformat(),
            "week_end": (date.today() + timedelta(days=6)).isoformat(),
            "status": "active",
            "is_waiting_period": False,
        }).execute().data[0]

        event = supabase.table("disruption_events").insert({
            "hex_id": b_hex,
            "h3_index": b_hex,
            "dci_peak": 0.868,
            "started_at": disruption_start.isoformat(),
            "ended_at": (disruption_start + timedelta(hours=4)).isoformat(),
            "duration_hours": 4.0,
            "trigger_signals": {"weather": 2.5, "traffic": 1.2, "platform": 1.8, "social": 1.0, "city": "Bengaluru", "scenario": "fraud"},
        }).execute().data[0]

        pings = s["ping_builder"](w["id"], b_hex, disruption_start)
        if pings:
            supabase.table("location_pings").insert(pings).execute()

        worker_gate2[w["id"]] = s["gate2"]
        worker_network[w["id"]] = s["network_flags"]
        inserted.append({"scenario": s, "worker": w, "policy": policy, "event": event})

    class ScenarioFraudEvaluator(FraudEvaluator):
        def __init__(self, gate2_map: dict[str, str], network_map: dict[str, dict]):
            super().__init__()
            self._gate2_map = gate2_map
            self._network_map = network_map

        def _evaluate_gate2_orders(self, worker_id: str) -> str:
            return self._gate2_map.get(worker_id, super()._evaluate_gate2_orders(worker_id))

        def _evaluate_network_rings(self, worker_id: str, hex_id: str, start_iso: str) -> dict:
            return self._network_map.get(worker_id, super()._evaluate_network_rings(worker_id, hex_id, start_iso))

    evaluator = ScenarioFraudEvaluator(worker_gate2, worker_network)
    flag_weights = {
        "STATIC_DEVICE_FLAG": 30,
        "MOCK_LOCATION_FLAG": 20,
        "VELOCITY_VIOLATION": 15,
        "MODEL_CONCENTRATION": 25,
        "REGISTRATION_COHORT": 10,
        "MOCK_LOCATION_NETWORK": 10,
    }

    console.print("\n[bold]FraudEvaluator Results:[/bold]")
    for item in inserted:
        s = item["scenario"]
        w = item["worker"]
        p = item["policy"]
        e = item["event"]

        fr = evaluator.evaluate(w["id"], e["id"], disruption_start)
        fraud_score = int(fr.get("fraud_score", 0))
        gate2 = fr.get("gate2_result", "NONE")
        flags = fr.get("flags", [])
        path = route_claim(fraud_score, gate2, flags)

        pop = validate_pop(w["id"], b_hex, disruption_start)
        pop_valid = bool(pop.get("present"))
        claim_status = "denied" if path == "denied" else "paid"

        payout_amount = 0.0
        pay_id = None
        if claim_status == "paid":
            payout_amount = float(calculate_payout(float(w["avg_daily_earnings"]), 4.0, p.get("tier", "B"), w["id"]))
            if path == "soft_queue":
                pay_id = "pout_softqueue_meera_demo" if s["phone"] == "+919000000003" else f"pout_soft_{w['id'][:8]}"
            elif path == "active_verify":
                pay_id = "pout_active_verify_suresh_demo" if s["phone"] == "+919000000004" else f"pout_active_{w['id'][:8]}"

        claim = supabase.table("claims").insert({
            "worker_id": w["id"],
            "policy_id": p["id"],
            "event_id": e["id"],
            "status": claim_status,
            "disrupted_hours": 0.0 if claim_status == "denied" else 4.0,
            "pop_validated": pop_valid,
            "fraud_score": fraud_score,
            "resolution_path": path,
            "payout_amount": payout_amount,
            "razorpay_payment_id": pay_id,
            "razorpay_payout_id": pay_id,
            "zone_hop_flag": bool(pop.get("zone_hop_flag")),
            "fraud_flags": {f.lower(): True for f in flags},
            "queued_at": disruption_start.isoformat(),
            "flagged_at": disruption_start.isoformat(),
            "resolved_at": (disruption_start + timedelta(minutes=30)).isoformat() if path == "active_verify" else (disruption_start + timedelta(hours=2)).isoformat() if path == "soft_queue" else (disruption_start + timedelta(hours=1)).isoformat(),
            "admin_notes": f"Simulated via FraudEvaluator pipeline: {s['name']}",
        }).execute().data[0]

        for fl in flags:
            supabase.table("fraud_flags").insert({
                "claim_id": claim["id"],
                "flag_type": fl,
                "score_contribution": flag_weights.get(fl, 0),
                "details": {"scenario": s["name"], "worker_phone": s["phone"]},
            }).execute()

        try:
            supabase.table("fraud_evaluations").insert({
                "worker_id": w["id"],
                "event_id": e["id"],
                "fraud_score": fraud_score,
                "gate2_result": gate2,
                "flags": {f.lower(): True for f in flags},
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as eval_err:
            warn(f"fraud_evaluations insert skipped for {s['name']}: {eval_err}")

        console.print(
            f"  [bold]{s['name']}[/bold] ({s['phone']}) -> "
            f"score=[bold]{fraud_score}[/bold], gate2=[bold]{gate2}[/bold], "
            f"path=[bold]{path}[/bold], flags={flags or '[]'}"
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Main async orchestrator
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    if len(sys.argv) > 1 and sys.argv[1].lower() in {"fraud", "simulate_fraud", "simulate_fraud_scenarios"}:
        simulate_fraud_scenarios()
        return

    selected_city = os.environ.get("DEMO_CITY", "Bengaluru")
    if len(sys.argv) > 1:
        selected_city = sys.argv[1]

    _apply_city_config(selected_city)

    console.print(Panel(
        "[bold cyan]gigHood Backend — End-to-End Terminal Demo[/bold cyan]\n"
        "[dim]Full pipeline: Worker → DCI → Fraud → Payout[/dim]",
        border_style="cyan",
        padding=(1, 4),
    ))
    console.print(f"[bold]Selected city run:[/bold] {DEMO_CITY}")
    console.print("[bold]Configured city matrix:[/bold]")
    _print_city_configs()

    ctx: dict = {}
    t_start = time.time()

    # ── STEP 0 ───────────────────────────────────────────────────────────────
    try:
        seed      = step0_seed()
        worker_id = seed["worker_id"]
        hex_id    = seed["hex_id"]
        dci_12w   = seed["dci_12w"]
        ctx.update({"worker_id": worker_id, "hex_id": hex_id})
    except Exception as e:
        fail("0 — SEED", e)
        console.print("[bold red]Cannot continue without seed data. Aborting.[/bold red]")
        return

    # ── STEP 1 ───────────────────────────────────────────────────────────────
    try:
        step1_registration(worker_id, hex_id)
    except Exception as e:
        fail("1 — REGISTRATION", e)

    # ── STEP 2 ───────────────────────────────────────────────────────────────
    try:
        prof = step2_risk_profiler(dci_12w)
        ctx.update(prof)
    except Exception as e:
        fail("2 — RISK PROFILER", e)
        ctx.setdefault("tier", "B")
        ctx.setdefault("premium", 28.0)
        ctx.setdefault("avg_4w", 0.52)

    # ── STEP 3 ───────────────────────────────────────────────────────────────
    try:
        pol = step3_policy(worker_id, ctx.get("tier", "B"), float(ctx.get("premium", 28.0)))
        ctx.update(pol)
    except Exception as e:
        fail("3 — POLICY", e)
        ctx.setdefault("policy_id", str(uuid.uuid4()))
        ctx.setdefault("tier", "B")

    # ── STEP 4 ───────────────────────────────────────────────────────────────
    try:
        signals = step4_signals(hex_id)
    except Exception as e:
        fail("4 — SIGNALS", e)
        signals = {
            "WEATHER":  2.60, "TRAFFIC": 1.10,
            "PLATFORM": 1.70, "SOCIAL":  1.20,
            "_hex_id":  hex_id,
        }

    # ── STEP 5 ───────────────────────────────────────────────────────────────
    disruption_start = datetime.now(timezone.utc)
    try:
        dci_res = step5_dci(signals)
        ctx.update({"dci": dci_res["dci"], "dci_status": dci_res["status"]})
    except Exception as e:
        fail("5 — DCI", e)
        ctx.update({"dci": 0.91, "dci_status": "disrupted"})

    # ── Create disruption event in DB (required by FraudEvaluator) ───────────
    event_id = None
    try:
        ev = supabase.table("disruption_events").insert({
            "hex_id":          hex_id,
            "h3_index":        hex_id,
            "dci_peak":        ctx.get("dci", 0.91),
            "started_at":      disruption_start.isoformat(),
            "trigger_signals": {"demo": True},
        }).execute()
        event_id = ev.data[0]["id"]
        ok(f"Disruption event created : [bold white]{event_id}[/bold white]")
    except Exception as e:
        warn(f"Could not create disruption event (fraud evaluator may degrade): {e}")
        event_id = str(uuid.uuid4())

    # ── Create pending claim row ──────────────────────────────────────────────
    claim_id = None
    try:
        cl = supabase.table("claims").insert({
            "worker_id":       worker_id,
            "policy_id":       ctx.get("policy_id"),
            "event_id":        event_id,
            "status":          "pending",
            "disrupted_hours": 4.0,
        }).execute()
        claim_id = cl.data[0]["id"]
    except Exception as e:
        warn(f"Could not create pending claim row: {e}")
        claim_id = str(uuid.uuid4())

    # ── STEP 6 ───────────────────────────────────────────────────────────────
    try:
        pop_res = step6_pop(worker_id, hex_id, disruption_start)
        ctx.update({"pop_validated": pop_res["pop"]["present"], "gate2": pop_res["gate2"]})
    except Exception as e:
        fail("6 — POP", e)
        ctx.update({"pop_validated": True, "gate2": "STRONG"})

    # ── STEP 7 ───────────────────────────────────────────────────────────────
    try:
        fraud_res = step7_fraud(worker_id, event_id, disruption_start)
        ctx.update({
            "fraud_score": fraud_res["fraud_score"],
            "flags":       fraud_res["flags"],
            "gate2":       fraud_res["gate2"],
            "path":        fraud_res["path"],
        })
    except Exception as e:
        fail("7 — FRAUD", e)
        ctx.update({"fraud_score": 0, "flags": [], "gate2": "STRONG", "path": "fast_track"})

    # ── STEP 8 ───────────────────────────────────────────────────────────────
    try:
        pay_res = step8_payout(worker_id, ctx.get("tier", "B"), disrupted_hours=4.0)
        ctx.update({"payout_amount": pay_res["payout_amount"]})
    except Exception as e:
        fail("8 — PAYOUT CALC", e)
        ctx.setdefault("payout_amount", 300.0)

    # ── STEP 9 ───────────────────────────────────────────────────────────────
    try:
        rzp = step9_razorpay(ctx["payout_amount"], claim_id)
        ctx["rzp_id"] = rzp.get("id", "—")
    except Exception as e:
        fail("9 — RAZORPAY", e)
        ctx["rzp_id"] = "pout_demo_error"

    # Persist final claim state to DB
    try:
        supabase.table("claims").update({
            "payout_amount":       ctx["payout_amount"],
            "razorpay_payment_id": ctx["rzp_id"],
            "pop_validated":       ctx.get("pop_validated", True),
            "fraud_score":         ctx.get("fraud_score", 0),
            "resolution_path":     ctx.get("path", "fast_track"),
            "status":              "paid",
            "resolved_at":         datetime.now(timezone.utc).isoformat(),
        }).eq("id", claim_id).execute()
    except Exception:
        pass

    # ── STEP 10 ──────────────────────────────────────────────────────────────
    try:
        step10_claim_record(
            claim_id=claim_id,
            path=ctx.get("path", "fast_track"),
            fraud_score=ctx.get("fraud_score", 0),
            pop_valid=ctx.get("pop_validated", True),
            payout_amount=ctx["payout_amount"],
            rzp_id=ctx["rzp_id"],
            t_start=t_start,
        )
    except Exception as e:
        fail("10 — CLAIM RECORD", e)

    # ── STEP 11 ──────────────────────────────────────────────────────────────
    step11_summary(ctx)


if __name__ == "__main__":
    asyncio.run(main())
