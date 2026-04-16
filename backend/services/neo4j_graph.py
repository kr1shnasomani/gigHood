from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

from neo4j import GraphDatabase

from backend.config import settings
from backend.db.client import supabase

logger = logging.getLogger("api")
_neo4j_driver = None


def _score_to_risk_level(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def is_neo4j_configured() -> bool:
    return bool(settings.NEO4J_URI and settings.NEO4J_USER and settings.NEO4J_PASSWORD)


def _get_driver():
    global _neo4j_driver
    if _neo4j_driver is not None:
        return _neo4j_driver

    if not is_neo4j_configured():
        raise RuntimeError("Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.")

    _neo4j_driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        connection_timeout=3.0,
    )
    return _neo4j_driver


def close_neo4j_driver() -> None:
    global _neo4j_driver
    if _neo4j_driver is not None:
        _neo4j_driver.close()
        _neo4j_driver = None


def _derive_device_fingerprint(worker_row: dict[str, Any]) -> str:
    parts = [
        str(worker_row.get("device_model") or "").strip(),
        str(worker_row.get("sim_carrier") or "").strip(),
        str(worker_row.get("sim_registration_date") or "").strip(),
        str(worker_row.get("platform_id") or "").strip(),
    ]
    raw = "|".join(parts)
    if not raw.replace("|", ""):
        fallback = str(worker_row.get("id") or "unknown-worker")
        raw = f"worker:{fallback}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _upsert_claim_triplet(
    worker_id: str,
    device_fingerprint: str,
    hex_zone_id: str,
    claim_id: str,
    claimed_at: str,
) -> None:
    query = """
    MERGE (w:Worker {id: $worker_id})
    MERGE (d:Device {fingerprint: $device_fingerprint})
    MERGE (z:Hex_Zone {id: $hex_zone_id})

    MERGE (w)-[:USES_DEVICE]->(d)
    MERGE (w)-[r:CLAIMED_IN]->(z)
    ON CREATE SET r.claim_count = 1
    ON MATCH SET r.claim_count = coalesce(r.claim_count, 0) + 1

    SET w.last_claim_id = $claim_id,
        w.last_claimed_at = datetime($claimed_at),
        d.last_claimed_at = datetime($claimed_at),
        z.last_claimed_at = datetime($claimed_at)
    """

    database = settings.NEO4J_DATABASE.strip() or None
    driver = _get_driver()
    with driver.session(database=database) as session:
        session.run(
            query,
            worker_id=worker_id,
            device_fingerprint=device_fingerprint,
            hex_zone_id=hex_zone_id,
            claim_id=claim_id,
            claimed_at=claimed_at,
        )


def ingest_claim_graph(worker_id: str, event_id: str, claim_id: str | None = None) -> bool:
    if not is_neo4j_configured():
        return False

    worker_res = (
        supabase.table("workers")
        .select("id,device_model,sim_carrier,sim_registration_date,platform_id")
        .eq("id", worker_id)
        .limit(1)
        .execute()
    )
    if not worker_res.data:
        logger.warning("Skipping Neo4j ingest. Worker not found: %s", worker_id)
        return False
    worker_row = worker_res.data[0]

    event_res = (
        supabase.table("disruption_events")
        .select("id,hex_id")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    if not event_res.data:
        logger.warning("Skipping Neo4j ingest. Event not found: %s", event_id)
        return False
    hex_zone_id = str(event_res.data[0].get("hex_id") or "").strip()
    if not hex_zone_id:
        logger.warning("Skipping Neo4j ingest. Missing hex_id for event: %s", event_id)
        return False

    fingerprint = _derive_device_fingerprint(worker_row)
    claim_ref = claim_id or f"worker:{worker_id}:event:{event_id}"
    claimed_at = datetime.now(timezone.utc).isoformat()

    _upsert_claim_triplet(
        worker_id=worker_id,
        device_fingerprint=fingerprint,
        hex_zone_id=hex_zone_id,
        claim_id=claim_ref,
        claimed_at=claimed_at,
    )
    return True


def backfill_claim_graph(limit: int = 500) -> dict[str, int]:
    if not is_neo4j_configured():
        return {"total": 0, "ingested": 0, "failed": 0}

    claims_res = (
        supabase.table("claims")
        .select("id,worker_id,event_id,created_at")
        .not_.is_("worker_id", "null")
        .not_.is_("event_id", "null")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    rows = claims_res.data or []
    ingested = 0
    failed = 0

    for row in rows:
        try:
            ok = ingest_claim_graph(
                worker_id=row.get("worker_id"),
                event_id=row.get("event_id"),
                claim_id=row.get("id"),
            )
            if ok:
                ingested += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            logger.warning("Neo4j backfill failed for claim %s: %s", row.get("id"), e)

    return {"total": len(rows), "ingested": ingested, "failed": failed}


def get_syndicate_graph(seed_if_empty: bool = False, city: str | None = None) -> dict[str, Any]:
    if not is_neo4j_configured():
        raise RuntimeError("Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.")

    query = """
    MATCH (d:Device)<-[:USES_DEVICE]-(w:Worker)-[:CLAIMED_IN]->(z:Hex_Zone)
    WHERE $worker_ids IS NULL OR w.id IN $worker_ids
    WITH d,
         collect(DISTINCT w.id) AS workers,
         collect(DISTINCT z.id) AS zones,
         collect(DISTINCT {worker_id: w.id, zone_id: z.id}) AS worker_zone_pairs
    RETURN d.fingerprint AS device_fingerprint,
           workers,
           zones,
           worker_zone_pairs
    ORDER BY size(workers) DESC, size(zones) DESC
        LIMIT $device_limit
    """

    worker_ids_filter: list[str] | None = None
    normalized_city = (city or "").strip()
    if normalized_city and normalized_city.lower() != "all":
        workers_res = (
            supabase.table("workers")
            .select("id")
            .ilike("city", normalized_city)
            .execute()
        )
        worker_ids_filter = [str(row.get("id")) for row in (workers_res.data or []) if row.get("id")]
        if not worker_ids_filter:
            logger.info("Fraud graph city filter '%s' returned no workers.", normalized_city)
            return {
                "nodes": [],
                "links": [],
                "meta": {
                    "syndicate_devices": 0,
                    "node_count": 0,
                    "link_count": 0,
                    "workers_in_graph": 0,
                    "zones_in_graph": 0,
                    "devices_in_graph": 0,
                    "source": "live",
                    "city_filter": normalized_city,
                    "reason": "city_filter_no_workers",
                },
            }

    try:
        database = settings.NEO4J_DATABASE.strip() or None
        driver = _get_driver()
        with driver.session(database=database) as session:
            labels_res = session.run("CALL db.labels() YIELD label RETURN collect(label) AS labels").single()
            rels_res = session.run(
                "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS rels"
            ).single()

            labels = set(labels_res.get("labels", [])) if labels_res else set()
            rels = set(rels_res.get("rels", [])) if rels_res else set()

            required_labels = {"Worker", "Device", "Hex_Zone"}
            required_rels = {"USES_DEVICE", "CLAIMED_IN"}
            if not required_labels.issubset(labels) or not required_rels.issubset(rels):
                if seed_if_empty:
                    backfill_stats = backfill_claim_graph(limit=1000)
                    labels_res = session.run("CALL db.labels() YIELD label RETURN collect(label) AS labels").single()
                    rels_res = session.run(
                        "CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS rels"
                    ).single()
                    labels = set(labels_res.get("labels", [])) if labels_res else set()
                    rels = set(rels_res.get("rels", [])) if rels_res else set()

                    if not required_labels.issubset(labels) or not required_rels.issubset(rels):
                        logger.warning(
                            "Fraud graph fallback active: neo4j_projection_not_ready after backfill attempt (labels=%s rels=%s)",
                            sorted(labels),
                            sorted(rels),
                        )
                        return {
                            "nodes": [],
                            "links": [],
                            "meta": {
                                "syndicate_devices": 0,
                                "node_count": 0,
                                "link_count": 0,
                                "reason": "neo4j_projection_not_ready",
                                "backfill": backfill_stats,
                            },
                        }
                else:
                    logger.warning(
                        "Fraud graph fallback active: neo4j_projection_not_ready (labels=%s rels=%s)",
                        sorted(labels),
                        sorted(rels),
                    )
                    return _get_degraded_fraud_graph("neo4j_projection_not_ready", city_filter=normalized_city or "all")

            records = list(session.run(query, device_limit=240, worker_ids=worker_ids_filter))
    except Exception as e:
        logger.warning(f"Neo4j is unreachable or query failed. Returning degraded empty graph: {e}")
        return _get_degraded_fraud_graph("neo4j_unreachable", str(e), normalized_city or "all")

    if not records:
        logger.info("Fraud graph query returned 0 records. Live data is healthy but currently sparse.")
        return _get_degraded_fraud_graph("neo4j_sparse_data", city_filter=normalized_city or "all")

    node_map: dict[str, dict[str, Any]] = {}
    link_keys: set[tuple[str, str, str]] = set()
    links: list[dict[str, str]] = []
    device_stats: dict[str, dict[str, int]] = {}
    worker_zone_counter: dict[str, set[str]] = {}
    worker_device_counter: dict[str, set[str]] = {}

    worker_ids: set[str] = set()
    zone_ids: set[str] = set()

    for record in records:
        device_fp = record.get("device_fingerprint")
        if not device_fp:
            continue

        device_node_id = f"device:{device_fp}"
        workers_for_device = record.get("workers") or []
        zones_for_device = record.get("zones") or []
        device_score = min(100.0, 40.0 + len(workers_for_device) * 12.0 + len(zones_for_device) * 8.0)
        device_stats[device_fp] = {
            "workers": len(workers_for_device),
            "zones": len(zones_for_device),
        }

        node_map[device_node_id] = {
            "id": device_node_id,
            "entity_id": device_fp,
            "type": "Device",
            "label": f"Device {device_fp[:8]}",
            "fraud_score": round(device_score, 1),
            "risk_level": _score_to_risk_level(device_score),
        }

        for worker_id in workers_for_device:
            worker_node_id = f"worker:{worker_id}"
            worker_ids.add(worker_id)
            worker_device_counter.setdefault(worker_id, set()).add(device_fp)
            node_map[worker_node_id] = {
                "id": worker_node_id,
                "entity_id": worker_id,
                "type": "Worker",
                "label": f"Worker {worker_id[:8]}",
            }

            use_key = (worker_node_id, device_node_id, "USES_DEVICE")
            if use_key not in link_keys:
                link_keys.add(use_key)
                links.append({
                    "source": worker_node_id,
                    "target": device_node_id,
                    "type": "USES_DEVICE",
                })

        for zone_id in zones_for_device:
            zone_node_id = f"zone:{zone_id}"
            zone_ids.add(zone_id)
            node_map[zone_node_id] = {
                "id": zone_node_id,
                "entity_id": zone_id,
                "type": "Hex_Zone",
                "label": zone_id,
            }

        for pair in record.get("worker_zone_pairs") or []:
            worker_id = pair.get("worker_id")
            zone_id = pair.get("zone_id")
            if not worker_id or not zone_id:
                continue

            worker_zone_counter.setdefault(worker_id, set()).add(zone_id)

            worker_node_id = f"worker:{worker_id}"
            zone_node_id = f"zone:{zone_id}"
            claim_key = (worker_node_id, zone_node_id, "CLAIMED_IN")
            if claim_key not in link_keys:
                link_keys.add(claim_key)
                links.append({
                    "source": worker_node_id,
                    "target": zone_node_id,
                    "type": "CLAIMED_IN",
                })

    worker_scores: dict[str, float] = {}
    worker_profiles: dict[str, dict[str, Any]] = {}
    if worker_ids:
        claims_res = (
            supabase.table("claims")
            .select("worker_id,fraud_score")
            .in_("worker_id", list(worker_ids))
            .execute()
        )

        workers_res = (
            supabase.table("workers")
            .select("id,name,city,platform_affiliation,status")
            .in_("id", list(worker_ids))
            .execute()
        )

        for row in (workers_res.data or []):
            wid = row.get("id")
            if wid:
                worker_profiles[wid] = row

        for row in (claims_res.data or []):
            wid = row.get("worker_id")
            if not wid:
                continue
            try:
                score = float(row.get("fraud_score") or 0.0)
            except (TypeError, ValueError):
                score = 0.0
            prev = worker_scores.get(wid)
            worker_scores[wid] = score if prev is None else max(prev, score)

    zone_dci_map: dict[str, float] = {}
    zone_profiles: dict[str, dict[str, Any]] = {}
    if zone_ids:
        zone_list = list(zone_ids)
        try:
            zones_res = (
                supabase.table("hex_zones")
                .select("h3_index,current_dci,city,active_worker_count,dci_status")
                .in_("h3_index", zone_list)
                .execute()
            )
            for row in (zones_res.data or []):
                zid = row.get("h3_index")
                if not zid:
                    continue
                zone_profiles[zid] = row
                try:
                    zone_dci_map[zid] = float(row.get("current_dci") or 0.0)
                except (TypeError, ValueError):
                    zone_dci_map[zid] = 0.0
        except Exception:
            zones_res = (
                supabase.table("hex_zones")
                .select("hex_id,current_dci,city,active_worker_count,dci_status")
                .in_("hex_id", zone_list)
                .execute()
            )
            for row in (zones_res.data or []):
                zid = row.get("hex_id")
                if not zid:
                    continue
                zone_profiles[zid] = row
                try:
                    zone_dci_map[zid] = float(row.get("current_dci") or 0.0)
                except (TypeError, ValueError):
                    zone_dci_map[zid] = 0.0

    device_rank = {d: idx + 1 for idx, d in enumerate(device_stats.keys())}

    for node in node_map.values():
        ntype = node.get("type")
        entity_id = node.get("entity_id")

        if ntype == "Worker":
            claim_score = float(worker_scores.get(entity_id, 30.0))
            syndicate_zones = len(worker_zone_counter.get(entity_id, set()))
            syndicate_devices = len(worker_device_counter.get(entity_id, set()))
            syndicate_score = 50.0 + syndicate_zones * 8.0 + syndicate_devices * 6.0
            score = max(claim_score, min(100.0, syndicate_score))
            profile = worker_profiles.get(entity_id, {})
            worker_name = str(profile.get("name") or f"Worker {entity_id[:8]}").strip()
            city = str(profile.get("city") or "Unknown city")
            platform = str(profile.get("platform_affiliation") or "Unknown platform")

            node["label"] = worker_name
            node["subtitle"] = f"{city} • {platform}"
            node["fraud_score"] = round(score, 1)
            node["risk_level"] = _score_to_risk_level(score)
            node["details"] = {
                "worker_id": entity_id,
                "city": city,
                "platform": platform,
                "shared_devices": syndicate_devices,
                "zones_claimed": syndicate_zones,
                "max_claim_fraud_score": round(claim_score, 1),
            }

        elif ntype == "Hex_Zone":
            dci = float(zone_dci_map.get(entity_id, 0.0))
            score = max(0.0, min(100.0, dci * 100.0))
            profile = zone_profiles.get(entity_id, {})
            city = str(profile.get("city") or "Zone")
            workers = int(profile.get("active_worker_count") or 0)
            status = str(profile.get("dci_status") or "normal")

            node["label"] = f"{city} Zone"
            node["subtitle"] = f"{entity_id[:10]}..."
            node["fraud_score"] = round(score, 1)
            node["risk_level"] = _score_to_risk_level(score)
            node["details"] = {
                "zone_id": entity_id,
                "city": city,
                "active_workers": workers,
                "dci_status": status,
                "dci": round(dci, 3),
            }

        elif ntype == "Device":
            # Device node score already computed from syndicate fanout.
            stats = device_stats.get(entity_id, {})
            node["label"] = f"Device #{device_rank.get(entity_id, 0)}"
            node["subtitle"] = f"{entity_id[:10]}..."
            node.setdefault("fraud_score", 50.0)
            node.setdefault("risk_level", _score_to_risk_level(float(node["fraud_score"])))
            node["details"] = {
                "fingerprint": entity_id,
                "workers_linked": int(stats.get("workers", 0)),
                "zones_linked": int(stats.get("zones", 0)),
            }

    return {
        "nodes": list(node_map.values()),
        "links": links,
        "meta": {
            "syndicate_devices": sum(
                1 for d in device_stats.values() if int(d.get("workers", 0)) > 1 and int(d.get("zones", 0)) > 1
            ),
            "node_count": len(node_map),
            "link_count": len(links),
            "workers_in_graph": len(worker_ids),
            "zones_in_graph": len(zone_ids),
            "devices_in_graph": len(device_stats),
            "source": "live",
            "city_filter": normalized_city or "all",
        },
    }

def _get_degraded_fraud_graph(reason: str, error: str = "", city_filter: str = "all") -> dict[str, Any]:
    return {
        "nodes": [],
        "links": [],
        "meta": {
            "syndicate_devices": 0,
            "node_count": 0,
            "link_count": 0,
            "source": "degraded",
            "reason": reason,
            "error": error,
            "city_filter": city_filter
        }
    }