# =============================================================================
# backend/services/spatial.py — H3 Spatial Intelligence Layer
# =============================================================================
# All H3 hexagonal grid operations for gigHood. This module is the spatial
# foundation that every other service depends on:
#
#   dci_engine.py        → lat_lng_to_hex, get_hex_neighbors (signal fetch radius)
#   pop_validator.py     → point_in_hex (is worker inside their registered hex?)
#   fraud_engine.py      → hex_distance (zone-hop velocity calc)
#   trigger_monitor.py   → get_active_hex_ids (which hexes to monitor)
#   scripts/seed_bengaluru.py → seed_hex_zones
#
# Design decisions:
#   • h3 >= 4.0 API only. No try/except AttributeError shim — pin h3>=4.0.1
#     in requirements.txt. The v3 API (geo_to_h3, h3_to_geo, k_ring) was
#     removed in h3-py 4.0. Supporting both simultaneously produces silent
#     correctness bugs when the wrong branch executes.
#   • gigHood standard resolution = 9 (≈ 1.2 km). All functions default to
#     this resolution. Override via settings.H3_RESOLUTION if needed.
#   • Geometry columns (centroid, boundary) are populated via PostgreSQL
#     triggers using fn_h3_cell_to_polygon() — not via the REST API.
#     seed_hex_zones inserts only non-geometry columns via REST, then calls
#     the trigger by updating a dummy column.
#   • asyncpg is used for bulk hex zone seeding (fn_bulk_update_hex_dci
#     takes array arguments that PostgREST cannot handle).
#   • All public functions are sync (pure Python h3 math). DB-touching
#     functions are async.
# =============================================================================

from __future__ import annotations

import logging
import math
from typing import Optional

import h3

from backend.config import settings
from backend.db.client import get_db_connection, supabase_admin

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

# gigHood standard H3 resolution — dark store delivery radius ≈ 1.2 km
GIGHOOD_RESOLUTION: int = settings.H3_RESOLUTION   # 9

# H3 resolution 9 edge length and apothem (km) — used for ring calculation
# Source: https://h3geo.org/docs/core-library/restable/
_RES9_EDGE_LEN_KM: float  = 0.174376    # average edge length at res 9
_RES9_APOTHEM_KM: float   = 0.150903    # inradius (centre to edge midpoint)

# Earth radius for haversine fallback
_EARTH_RADIUS_KM: float = 6371.0

# Max k-ring for neighbour queries (safety cap — prevents accidental huge grids)
_MAX_K_RINGS: int = 200


# =============================================================================
# 1. CORE H3 OPERATIONS
# =============================================================================

def lat_lng_to_hex(
    lat: float,
    lng: float,
    resolution: int = GIGHOOD_RESOLUTION,
) -> str:
    """
    Returns the H3 cell index (str) for a given latitude/longitude.

    Args:
        lat:        Latitude in decimal degrees (WGS84)
        lng:        Longitude in decimal degrees (WGS84)
        resolution: H3 resolution (default: 9 ≈ 1.2 km)

    Returns:
        H3 cell index as a hex string, e.g. '892830828dfffff'

    Raises:
        ValueError: If lat/lng are outside valid bounds.
    """
    if not (-90 <= lat <= 90):
        raise ValueError(f"Latitude must be in [-90, 90], got {lat}")
    if not (-180 <= lng <= 180):
        raise ValueError(f"Longitude must be in [-180, 180], got {lng}")
    if not (0 <= resolution <= 15):
        raise ValueError(f"H3 resolution must be in [0, 15], got {resolution}")

    return h3.latlng_to_cell(lat, lng, resolution)


def get_hex_centroid(hex_id: str) -> tuple[float, float]:
    """
    Returns the (lat, lng) centre of the given H3 cell.

    Returns:
        (lat, lng) tuple in decimal degrees (WGS84)
    """
    return h3.cell_to_latlng(hex_id)


def get_hex_boundary(hex_id: str) -> list[tuple[float, float]]:
    """
    Returns the boundary vertices of an H3 cell as (lat, lng) tuples.
    The boundary is NOT closed (last point ≠ first point).

    Returns:
        List of (lat, lng) tuples — typically 6 vertices for a hexagon.
    """
    return list(h3.cell_to_boundary(hex_id))


def get_hex_boundary_wkt(hex_id: str) -> str:
    """
    Returns a PostGIS-compatible WKT POLYGON string for the hex boundary.
    Used when inserting geometry via raw SQL (e.g. in seeding scripts).

    The polygon is CLOSED (last vertex = first vertex) as required by WKT spec.
    Coordinates are in (longitude latitude) order as required by WKT.

    Returns:
        WKT string, e.g. 'POLYGON((77.59 12.97, 77.60 12.98, ...))'
    """
    boundary = get_hex_boundary(hex_id)
    # WKT uses (lng lat) order; h3 returns (lat, lng)
    coords = [(lng, lat) for lat, lng in boundary]
    # Close the polygon
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    pairs = ", ".join(f"{lng:.8f} {lat:.8f}" for lng, lat in coords)
    return f"POLYGON(({pairs}))"


def get_hex_boundary_geojson(hex_id: str) -> dict:
    """
    Returns a GeoJSON Polygon geometry dict for the hex boundary.
    Used by the admin dashboard Mapbox/Leaflet hex rendering.

    Returns:
        GeoJSON Polygon geometry object (coordinates in [lng, lat] order)
    """
    boundary = get_hex_boundary(hex_id)
    # GeoJSON uses [lng, lat] order
    coords = [[lng, lat] for lat, lng in boundary]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return {
        "type": "Polygon",
        "coordinates": [coords],
    }


def get_hex_resolution(hex_id: str) -> int:
    """Returns the H3 resolution of a given cell."""
    return h3.get_resolution(hex_id)


def is_valid_hex(hex_id: str) -> bool:
    """Returns True if the string is a valid H3 cell index."""
    return h3.is_valid_cell(hex_id)


# =============================================================================
# 2. SPATIAL CONTAINMENT
# =============================================================================

def point_in_hex(lat: float, lng: float, hex_id: str) -> bool:
    """
    Returns True if the (lat, lng) point falls within the H3 hex cell.

    Used by:
      - pop_validator.py: is worker's GPS ping inside their registered hex?
      - location_pings trigger: is_in_registered_hex column

    Algorithm: re-project the point to the same H3 resolution and check
    if the resulting cell matches hex_id. This is O(1) and exact.

    Args:
        lat:    GPS latitude
        lng:    GPS longitude
        hex_id: H3 cell to test containment against

    Returns:
        True if point is inside hex_id.
    """
    resolution = get_hex_resolution(hex_id)
    return lat_lng_to_hex(lat, lng, resolution) == hex_id


def get_hex_for_point(lat: float, lng: float) -> str:
    """Alias for lat_lng_to_hex at gigHood standard resolution."""
    return lat_lng_to_hex(lat, lng, GIGHOOD_RESOLUTION)


def points_in_same_hex(
    lat1: float, lng1: float,
    lat2: float, lng2: float,
    resolution: int = GIGHOOD_RESOLUTION,
) -> bool:
    """Returns True if both points resolve to the same H3 cell."""
    return (
        lat_lng_to_hex(lat1, lng1, resolution)
        == lat_lng_to_hex(lat2, lng2, resolution)
    )


# =============================================================================
# 3. NEIGHBOURHOOD & DISTANCE
# =============================================================================

def get_hex_neighbors(hex_id: str, k_rings: int = 1) -> list[str]:
    """
    Returns all H3 cells within k rings of hex_id (including hex_id itself).

    k=1 → 7 cells (hex + 6 immediate neighbours)
    k=2 → 19 cells
    k=3 → 37 cells

    Used by:
      - signal_fetchers.py: fetch signals for k=1 neighbour ring (edge effects)
      - fraud_engine.py: cross-hex cluster detection uses k=3 neighbourhood

    Args:
        hex_id:  Centre H3 cell
        k_rings: Ring distance (0 = hex_id only)

    Returns:
        List of H3 cell indices (including hex_id).
    """
    if k_rings < 0:
        raise ValueError(f"k_rings must be >= 0, got {k_rings}")
    if k_rings > _MAX_K_RINGS:
        raise ValueError(
            f"k_rings={k_rings} exceeds maximum allowed ({_MAX_K_RINGS}). "
            "Use seed_hex_zones for large grid generation."
        )
    return list(h3.grid_disk(hex_id, k_rings))


def get_hex_ring(hex_id: str, k: int) -> list[str]:
    """
    Returns only the cells at EXACTLY ring distance k from hex_id.
    (Excludes the inner rings — unlike get_hex_neighbors which is cumulative.)

    k=0 → [hex_id]
    k=1 → 6 immediate neighbours only
    k=2 → 12 cells at ring 2 only
    """
    if k < 0:
        raise ValueError(f"k must be >= 0, got {k}")
    return list(h3.grid_ring(hex_id, k))


def hex_distance(hex_id_a: str, hex_id_b: str) -> int:
    """
    Returns the grid distance between two H3 cells (number of hops).

    Used by fraud_engine.py Gate 3: velocity check estimates the minimum
    distance a worker must have crossed to enter a different hex.

    Returns:
        Grid distance in hex hops. Returns -1 if cells are at different
        resolutions or the distance cannot be computed (pentagons).
    """
    try:
        return h3.grid_distance(hex_id_a, hex_id_b)
    except Exception as exc:
        logger.warning(
            "hex_distance failed for (%s, %s): %s", hex_id_a, hex_id_b, exc
        )
        return -1


def haversine_distance_km(
    lat1: float, lng1: float,
    lat2: float, lng2: float,
) -> float:
    """
    Returns the great-circle distance in kilometres between two points.

    Used by:
      - fraud_engine.py Gate 3: physical distance between last-outside-hex ping
        and first-inside-hex ping (for velocity calculation)
      - seed_hex_zones: radius-to-ring conversion

    This is the ground truth distance (vs hex_distance which is grid hops).
    """
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)
    a = (
        math.sin(Δφ / 2) ** 2
        + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    )
    return _EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def radius_km_to_k_rings(radius_km: float, resolution: int = GIGHOOD_RESOLUTION) -> int:
    """
    Converts a radius in kilometres to the number of H3 k-rings required
    to cover that radius at the given resolution.

    Uses the apothem (inradius) for conservative coverage — ensures the full
    circle is covered rather than just the ring centres.

    Returns:
        k_rings (minimum 1, maximum _MAX_K_RINGS)
    """
    if radius_km <= 0:
        return 1

    # Resolution-specific apothem lookup (km)
    # Source: h3geo.org/docs/core-library/restable
    _APOTHEMS: dict[int, float] = {
        6:  36.129,
        7:  13.668,
        8:   5.180,
        9:   1.953,
        10:  0.738,
        11:  0.279,
        12:  0.106,
    }
    apothem = _APOTHEMS.get(resolution, _RES9_APOTHEM_KM)
    k = max(1, math.ceil(radius_km / (apothem * 2)))
    return min(k, _MAX_K_RINGS)


def estimate_hex_area_km2(resolution: int = GIGHOOD_RESOLUTION) -> float:
    """
    Returns the approximate area of an H3 cell in km² at the given resolution.
    Source: h3geo.org/docs/core-library/restable
    """
    _AREAS_KM2: dict[int, float] = {
        6:  36285.6,
        7:   5161.3,
        8:    737.3,
        9:    105.3,
        10:    15.0,
        11:     2.1,
        12:     0.3,
    }
    return _AREAS_KM2.get(resolution, 105.3)


# =============================================================================
# 4. PARENT / CHILD RESOLUTION TRAVERSAL
# =============================================================================

def get_parent_hex(hex_id: str, parent_resolution: int) -> str:
    """
    Returns the parent H3 cell at a coarser resolution.
    Used for admin zone grouping (e.g. res 6 city zone → res 9 worker hex).
    """
    current_res = get_hex_resolution(hex_id)
    if parent_resolution >= current_res:
        raise ValueError(
            f"parent_resolution ({parent_resolution}) must be coarser "
            f"(lower number) than hex resolution ({current_res})"
        )
    return h3.cell_to_parent(hex_id, parent_resolution)


def get_child_hexes(hex_id: str, child_resolution: int) -> list[str]:
    """
    Returns all child H3 cells at a finer resolution.
    Used for dark store coverage analysis at res 11 within a res 9 worker hex.
    """
    current_res = get_hex_resolution(hex_id)
    if child_resolution <= current_res:
        raise ValueError(
            f"child_resolution ({child_resolution}) must be finer "
            f"(higher number) than hex resolution ({current_res})"
        )
    return list(h3.cell_to_children(hex_id, child_resolution))


# =============================================================================
# 5. DATABASE-TOUCHING SPATIAL OPERATIONS (ASYNC)
# =============================================================================

async def get_active_hex_ids(city: Optional[str] = None) -> list[str]:
    """
    Returns all active H3 hex IDs from the hex_zones table.
    Used by the DCI scheduler to determine which hexes to process each cycle.

    Args:
        city: Optional filter — return hexes for a specific city only.

    Returns:
        List of H3 cell index strings.
    """
    try:
        query = (
            supabase_admin.raw()
            .table("hex_zones")
            .select("hex_id")
            .eq("is_active", True)
        )
        if city:
            query = query.eq("city", city.lower())

        response = query.execute()
        return [row["hex_id"] for row in (response.data or [])]

    except Exception as exc:
        logger.error("get_active_hex_ids failed: %s", exc)
        return []


async def get_disrupted_hex_ids() -> list[str]:
    """
    Returns hex IDs currently in DISRUPTED or ELEVATED_WATCH state.
    Used by trigger_monitor.py to focus claim processing.
    """
    try:
        response = (
            supabase_admin.raw()
            .table("hex_zones")
            .select("hex_id, dci_status")
            .in_("dci_status", ["DISRUPTED", "ELEVATED_WATCH"])
            .eq("is_active", True)
            .execute()
        )
        return [row["hex_id"] for row in (response.data or [])]
    except Exception as exc:
        logger.error("get_disrupted_hex_ids failed: %s", exc)
        return []


async def get_hex_zone(hex_id: str) -> Optional[dict]:
    """
    Returns the full hex_zones row for a given hex_id.
    Returns None if the hex does not exist or is inactive.
    """
    try:
        response = (
            supabase_admin.raw()
            .table("hex_zones")
            .select("*")
            .eq("hex_id", hex_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None
    except Exception as exc:
        logger.error("get_hex_zone(%s) failed: %s", hex_id, exc)
        return None


async def ensure_hex_zone_exists(
    hex_id: str,
    city: str,
    zone_label: Optional[str] = None,
    dark_store_count: int = 0,
) -> bool:
    """
    Ensures a hex_zones row exists for the given hex_id.
    If it doesn't exist, creates it (geometry auto-derived by DB trigger).

    Returns:
        True if the row exists or was created. False on error.
    """
    existing = await get_hex_zone(hex_id)
    if existing:
        return True

    try:
        lat, lng = get_hex_centroid(hex_id)
        record = {
            "hex_id":           hex_id,
            "city":             city.lower(),
            "zone_label":       zone_label or f"{city} {hex_id[:8]}",
            "dark_store_count": dark_store_count,
            "is_active":        True,
            "current_dci":      0.0,
            "dci_status":       "NORMAL",
            # centroid and boundary are populated by the DB trigger
            # trg_hex_zones_compute_geometry on INSERT
        }
        response = (
            supabase_admin.raw()
            .table("hex_zones")
            .insert(record)
            .execute()
        )
        if response.data:
            logger.info("Created hex_zone: %s (%s)", hex_id, city)
            return True
        return False

    except Exception as exc:
        logger.error("ensure_hex_zone_exists(%s) failed: %s", hex_id, exc)
        return False


async def get_workers_in_hex(hex_id: str) -> list[dict]:
    """
    Returns all ACTIVE workers registered in the given hex zone.
    Used by claim_approver.py to find claimable workers after a disruption.
    """
    try:
        response = (
            supabase_admin.raw()
            .table("workers")
            .select(
                "id, trust_score, avg_daily_earnings_paise, "
                "platform_worker_id, platform_id_verified, "
                "upi_id, upi_verified, payout_channel, fcm_device_token, "
                "last_fraud_score, mock_location_ever_detected"
            )
            .eq("registered_hex_id", hex_id)
            .eq("status", "ACTIVE")
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.error("get_workers_in_hex(%s) failed: %s", hex_id, exc)
        return []


# =============================================================================
# 6. HEX ZONE SEEDING (async — uses asyncpg for geometry via SQL functions)
# =============================================================================

async def seed_hex_zones(
    city:       str,
    center_lat: float,
    center_lng: float,
    radius_km:  float,
    ward:       Optional[str]  = None,
    dry_run:    bool           = False,
    chunk_size: int            = 200,
) -> dict:
    """
    Generates an H3 hex grid at resolution 9 covering the given radius and
    upserts all cells into hex_zones with centroid/boundary geometry.

    Geometry (centroid, boundary) is populated via PostgreSQL trigger
    trg_hex_zones_compute_geometry on INSERT — so we only need to send
    non-geometry columns via the REST upsert.

    Uses asyncpg directly for geometry-enabled upsert via:
        SELECT public.fn_h3_cell_to_polygon(hex_id::h3index)

    Args:
        city:       City name (stored lowercase in DB)
        center_lat: Latitude of the city centre
        center_lng: Longitude of the city centre
        radius_km:  Coverage radius in km
        ward:       Optional ward/district name
        dry_run:    If True, compute the grid but don't write to DB
        chunk_size: Rows per REST upsert batch (max 500 for Supabase free tier)

    Returns:
        Summary dict: {total, inserted, skipped, errors, hexes: [str]}
    """
    city_lower = city.lower()

    # 1. Compute center hex and grid
    center_hex = lat_lng_to_hex(center_lat, center_lng)
    k_rings    = radius_km_to_k_rings(radius_km)

    logger.info(
        "Seeding hex grid for %s: center=%s, radius=%.1fkm, k_rings=%d",
        city, center_hex, radius_km, k_rings,
    )

    hex_ids = get_hex_neighbors(center_hex, k_rings=k_rings)
    logger.info("Generated %d hex cells", len(hex_ids))

    if dry_run:
        return {
            "total":    len(hex_ids),
            "inserted": 0,
            "skipped":  len(hex_ids),
            "errors":   0,
            "dry_run":  True,
            "hexes":    hex_ids,
        }

    # 2. Fetch existing hex IDs to skip
    existing_response = (
        supabase_admin.raw()
        .table("hex_zones")
        .select("hex_id")
        .in_("hex_id", hex_ids[:1000])   # Supabase IN limit; chunk if needed
        .execute()
    )
    existing_hex_ids: set[str] = {
        row["hex_id"] for row in (existing_response.data or [])
    }

    new_hex_ids = [h for h in hex_ids if h not in existing_hex_ids]
    logger.info(
        "%d hexes already exist, %d new hexes to insert",
        len(existing_hex_ids), len(new_hex_ids),
    )

    # 3. Build records — geometry populated by DB trigger on INSERT
    #    (trg_hex_zones_compute_geometry computes centroid + boundary from hex_id)
    inserted = 0
    errors   = 0

    for i in range(0, len(new_hex_ids), chunk_size):
        chunk = new_hex_ids[i : i + chunk_size]
        records = [
            {
                "hex_id":           hid,
                "city":             city_lower,
                "ward":             ward,
                "zone_label":       f"{city} {hid[:8]}",
                "h3_resolution":    GIGHOOD_RESOLUTION,
                "dark_store_count": 0,
                "is_active":        True,
                "current_dci":      0.0,
                "dci_status":       "NORMAL",
                "zone_risk_tier":   "B",    # default — overridden by premium_bander
                "rolling_dci_4w":   0.0,
                "rolling_dci_8w":   0.0,
                "rolling_dci_12w":  0.0,
                "active_worker_count": 0,
                "active_policy_count": 0,
                "pool_viable":      False,
                "signal_sources_available": 5,
                "is_degraded_mode": False,
            }
            for hid in chunk
        ]

        try:
            response = (
                supabase_admin.raw()
                .table("hex_zones")
                .upsert(records, on_conflict="hex_id")
                .execute()
            )
            inserted_count = len(response.data or [])
            inserted += inserted_count
            logger.debug(
                "Seeded chunk %d/%d: %d rows",
                i // chunk_size + 1,
                math.ceil(len(new_hex_ids) / chunk_size),
                inserted_count,
            )
        except Exception as exc:
            logger.error("Seed chunk %d failed: %s", i // chunk_size + 1, exc)
            errors += len(chunk)

    # 4. Populate geometry via asyncpg (triggers fire on INSERT so geometry
    #    should already exist, but we verify by calling the fn directly
    #    for any rows whose triggers may not have fired in batch mode)
    await _backfill_geometry(new_hex_ids[:inserted])

    result = {
        "total":    len(hex_ids),
        "inserted": inserted,
        "skipped":  len(existing_hex_ids),
        "errors":   errors,
        "dry_run":  False,
        "hexes":    hex_ids,
    }

    logger.info(
        "Seed complete for %s: %d inserted, %d skipped, %d errors",
        city, inserted, len(existing_hex_ids), errors,
    )
    return result


async def _backfill_geometry(hex_ids: list[str]) -> None:
    """
    Ensures centroid and boundary geometry are populated for the given hex IDs.
    Calls fn_h3_cell_to_polygon() directly via asyncpg for any rows where the
    REST trigger may not have fired (Supabase batch upsert limitation).

    Called internally by seed_hex_zones after bulk insert.
    """
    if not hex_ids:
        return

    logger.info("Backfilling geometry for %d hexes via asyncpg ...", len(hex_ids))

    sql = """
        UPDATE public.hex_zones
        SET
            centroid = ST_SetSRID(h3_cell_to_geometry(hex_id::h3index), 4326),
            boundary = public.fn_h3_cell_to_polygon(hex_id::h3index)
        WHERE hex_id = ANY($1::text[])
          AND (centroid IS NULL OR boundary IS NULL)
    """
    try:
        async with get_db_connection() as conn:
            result = await conn.execute(sql, hex_ids)
            updated = int(result.split()[-1])
            if updated:
                logger.info(
                    "Geometry backfill: updated %d rows", updated
                )
    except Exception as exc:
        logger.error("Geometry backfill failed: %s", exc)


async def validate_worker_hex_assignment(
    worker_id: str,
    lat: float,
    lng: float,
) -> dict:
    """
    Validates that a worker's GPS coordinates fall within a registered
    and active hex zone. Called during worker onboarding zone assignment.

    Returns:
        {
            "hex_id": str,
            "city":   str or None,
            "zone_label": str or None,
            "hex_exists_in_db": bool,
            "is_active": bool,
        }
    """
    hex_id = lat_lng_to_hex(lat, lng)
    zone   = await get_hex_zone(hex_id)

    return {
        "hex_id":           hex_id,
        "city":             zone.get("city") if zone else None,
        "zone_label":       zone.get("zone_label") if zone else None,
        "hex_exists_in_db": zone is not None,
        "is_active":        zone.get("is_active", False) if zone else False,
    }


# =============================================================================
# 7. CLUSTER DETECTION HELPERS (used by fraud_engine.py)
# =============================================================================

def get_hex_neighbourhood_for_cluster(
    hex_ids: list[str],
    k: int = 3,
) -> set[str]:
    """
    Returns the union of k-ring neighbourhoods for all given hex_ids.
    Used by fraud_engine.py cross-hex graph: expands the search area for
    coordinated ring detection beyond individual hex boundaries.

    Args:
        hex_ids: List of H3 cell indices (the suspicious hexes)
        k:       Ring distance to expand

    Returns:
        Set of all H3 cells within k rings of any of the input hexes.
    """
    neighbourhood: set[str] = set()
    for hex_id in hex_ids:
        try:
            neighbourhood.update(get_hex_neighbors(hex_id, k_rings=k))
        except Exception as exc:
            logger.warning(
                "Neighbourhood expansion failed for %s: %s", hex_id, exc
            )
    return neighbourhood


def are_hexes_adjacent(hex_id_a: str, hex_id_b: str) -> bool:
    """Returns True if the two hexes share an edge (grid distance == 1)."""
    return hex_distance(hex_id_a, hex_id_b) == 1


def hex_centroid_distance_km(hex_id_a: str, hex_id_b: str) -> float:
    """
    Returns the distance in km between the centroids of two H3 cells.
    Used by Gate 3 velocity check when GPS coordinates of prior ping are
    unavailable (uses centroid as proxy for the transition point).
    """
    lat_a, lng_a = get_hex_centroid(hex_id_a)
    lat_b, lng_b = get_hex_centroid(hex_id_b)
    return haversine_distance_km(lat_a, lng_a, lat_b, lng_b)


# =============================================================================
# 8. UTILITY / VALIDATION
# =============================================================================

def validate_hex_id(hex_id: str, expected_resolution: int = GIGHOOD_RESOLUTION) -> str:
    """
    Validates and normalises an H3 cell index string.

    Args:
        hex_id:              H3 cell string to validate
        expected_resolution: Expected resolution (default: 9)

    Returns:
        The validated hex_id (lowercase, stripped)

    Raises:
        ValueError: If hex_id is invalid or at the wrong resolution.
    """
    if not hex_id or not isinstance(hex_id, str):
        raise ValueError("hex_id must be a non-empty string")

    hex_id = hex_id.strip().lower()

    if not is_valid_hex(hex_id):
        raise ValueError(f"'{hex_id}' is not a valid H3 cell index")

    actual_res = get_hex_resolution(hex_id)
    if actual_res != expected_resolution:
        raise ValueError(
            f"Expected H3 resolution {expected_resolution}, "
            f"but '{hex_id}' is at resolution {actual_res}"
        )

    return hex_id


def city_bounding_box(
    center_lat: float,
    center_lng: float,
    radius_km: float,
) -> dict[str, float]:
    """
    Returns a lat/lng bounding box for a city centre + radius.
    Used for quick spatial filtering before exact hex containment checks.

    Returns:
        {"min_lat", "max_lat", "min_lng", "max_lng"}
    """
    # 1° latitude ≈ 111 km
    lat_delta = radius_km / 111.0
    # 1° longitude varies with latitude
    lng_delta = radius_km / (111.0 * math.cos(math.radians(center_lat)))

    return {
        "min_lat": center_lat - lat_delta,
        "max_lat": center_lat + lat_delta,
        "min_lng": center_lng - lng_delta,
        "max_lng": center_lng + lng_delta,
    }