from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import get_current_worker


client = TestClient(app)


MOCK_WORKER = {
    "id": "worker_demo_123",
    "hex_id": "895193829f3ffff",
    "dark_store_zone": "Anna Nagar",
    "avg_daily_earnings": 550.0,
    "upi_id": "priya.sharma@upi",
}


def _override_auth():
    return MOCK_WORKER


def setup_function():
    app.dependency_overrides[get_current_worker] = _override_auth


def teardown_function():
    app.dependency_overrides.clear()


@patch("backend.api.demo._run_seed")
def test_seed_demo_endpoint(mock_run_seed):
    mock_run_seed.return_value = {
        "worker_id": MOCK_WORKER["id"],
        "hex_id": MOCK_WORKER["hex_id"],
        "dci_history_rows": 12,
        "location_ping_rows": 6,
        "rolling_4w_avg": 0.68,
        "gate2_mock_preview": "STRONG",
    }

    response = client.post("/workers/me/demo/seed")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dci_history_rows"] == 12
    assert payload["location_ping_rows"] == 6
    assert payload["gate2_mock_preview"] in {"STRONG", "WEAK", "NONE"}


@patch("backend.api.demo._run_simulate_disruption")
def test_simulate_disruption_endpoint(mock_run_simulate):
    mock_run_simulate.return_value = {
        "hex_id": MOCK_WORKER["hex_id"],
        "raw": 1.87,
        "current_dci": 0.866334,
        "dci_status": "disrupted",
    }

    response = client.post(
        "/workers/me/demo/simulate-disruption",
        json={"w": 2.5, "t": 1.2, "p": 1.8, "s": 1.0},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["dci_status"] == "disrupted"
    assert payload["current_dci"] > 0.85


def test_simulate_disruption_payload_validation():
    response = client.post(
        "/workers/me/demo/simulate-disruption",
        json={"w": 2.5, "t": 1.2, "p": 1.8},
    )
    assert response.status_code == 422


@patch("backend.api.demo._run_process_claim")
def test_process_claim_endpoint(mock_run_process_claim):
    mock_run_process_claim.return_value = {
        "claim_id": "claim_123",
        "fraud_score": 0,
        "resolution_path": "fast_track",
        "payout_amount": 275.0,
        "razorpay_payment_id": "pout_abc123",
        "status": "paid",
    }

    response = client.post("/workers/me/demo/process-claim")

    assert response.status_code == 200
    payload = response.json()
    assert payload["claim_id"] == "claim_123"
    assert payload["resolution_path"] == "fast_track"
    assert payload["payout_amount"] == 275.0
    assert payload["razorpay_payment_id"].startswith("pout_")