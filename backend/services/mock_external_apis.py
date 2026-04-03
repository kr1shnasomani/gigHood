import asyncio
import random
from datetime import datetime, timezone


async def fetch_mock_tomtom_traffic(hex_id: str, lat: float, lng: float) -> dict:
    """Simulate a partner traffic API call with realistic latency and payload."""
    await asyncio.sleep(0.5)
    seed = f"traffic:{hex_id}:{datetime.now(timezone.utc).hour}"
    random.seed(seed)

    congestion_level = round(random.uniform(0.1, 0.95), 3)
    return {
        "provider": "tomtom-mock",
        "hex_id": hex_id,
        "location": {"lat": lat, "lng": lng},
        "congestion_level": congestion_level,
        "incident_count": random.randint(0, 9),
        "latency_ms": random.randint(120, 520),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


async def fetch_mock_platform_outage(hex_id: str) -> dict:
    """Simulate delivery-platform health/outage signal from a mock partner API."""
    await asyncio.sleep(0.5)
    seed = f"platform:{hex_id}:{datetime.now(timezone.utc).hour}"
    random.seed(seed)

    order_drop_pct = round(random.uniform(0.0, 80.0), 2)
    status = "degraded" if order_drop_pct >= 35 else "active"
    return {
        "provider": "platform-health-mock",
        "hex_id": hex_id,
        "status": status,
        "order_drop_pct": order_drop_pct,
        "affected_platforms": ["Zepto", "Blinkit"],
        "latency_ms": random.randint(90, 460),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


async def verify_zepto_worker_activity(worker_id: str) -> dict:
    """Simulate a partner activity verification API for Gate 2 validation."""
    await asyncio.sleep(0.5)

    if "offline" in worker_id:
        return {
            "provider": "zepto-activity-mock",
            "worker_id": worker_id,
            "status": "inactive",
            "last_ping": "28 mins ago",
            "orders": [],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    if "weak" in worker_id:
        return {
            "provider": "zepto-activity-mock",
            "worker_id": worker_id,
            "status": "active",
            "last_ping": "7 mins ago",
            "orders": [
                {
                    "pickup_lat": 12.9716,
                    "pickup_lng": 77.5946,
                    "dropoff_lat": 12.9717,
                    "dropoff_lng": 77.5947,
                }
            ],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "provider": "zepto-activity-mock",
        "worker_id": worker_id,
        "status": "active",
        "last_ping": "2 mins ago",
        "orders": [
            {
                "pickup_lat": 12.9716,
                "pickup_lng": 77.5946,
                "dropoff_lat": 12.9816,
                "dropoff_lng": 77.6046,
            },
            {
                "pickup_lat": 12.9716,
                "pickup_lng": 77.5946,
                "dropoff_lat": 12.9717,
                "dropoff_lng": 77.5947,
            },
        ],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
