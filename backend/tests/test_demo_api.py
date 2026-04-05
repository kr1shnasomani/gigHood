from types import SimpleNamespace
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


@patch("backend.api.demo.supabase")
def test_update_hex_zone_snapshot_retries_when_first_update_matches_no_row(mock_supabase):
    from backend.api.demo import _update_hex_zone_snapshot

    # First variant (h3_index) executes but updates nothing, second variant (hex_id) updates one row.
    empty_update = SimpleNamespace(data=[])
    successful_update = SimpleNamespace(data=[{"hex_id": MOCK_WORKER["hex_id"]}])

    mock_table = mock_supabase.table.return_value
    mock_update_query = mock_table.update.return_value

    eq_calls = []

    def eq_side_effect(where_col, hex_id):
        eq_calls.append((where_col, hex_id))
        response = empty_update if where_col == "h3_index" else successful_update
        execute_mock = SimpleNamespace(execute=lambda: response)
        return execute_mock

    mock_update_query.eq.side_effect = eq_side_effect

    _update_hex_zone_snapshot(MOCK_WORKER["hex_id"], 0.91, "disrupted")

    assert ("h3_index", MOCK_WORKER["hex_id"]) in eq_calls
    assert ("hex_id", MOCK_WORKER["hex_id"]) in eq_calls
    assert mock_table.upsert.call_count == 0