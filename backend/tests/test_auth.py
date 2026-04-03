import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.auth_service import create_jwt, decode_jwt
import uuid

client = TestClient(app)

def test_jwt_encoding_decoding():
    """Verify python-jose properly encrypts and decrypts our UUID strings"""
    test_uuid = str(uuid.uuid4())
    token = create_jwt(test_uuid)
    
    assert isinstance(token, str)
    assert len(token) > 20
    
    payload = decode_jwt(token)
    assert payload["sub"] == test_uuid
    assert "exp" in payload

@patch("backend.api.workers.supabase")
def test_worker_registration_flow(mock_supabase):
    """
    Simulates: client posts to /workers/auth/register -> parses hex_id -> inserts DB -> gets JWT 
    """
    mock_uuid = str(uuid.uuid4())
    
    # 1. First DB query checks for existing phone -> return empty
    mock_select = MagicMock()
    mock_select.data = []
    
    # 2. Second DB query is the insert -> return mock_uuid
    mock_insert = MagicMock()
    mock_insert.data = [{"id": mock_uuid}]
    
    # Configure mock chain for supabase
    # supabase.table('workers').select().eq().execute()
    # supabase.table('workers').insert().execute()
    
    # Create an effect that returns empty list for SELECT and the valid ID for INSERT
    def execute_side_effect():
        response = MagicMock()
        response.data = mock_insert.data # Just default to the successful data for the mock setup
        return response
    
    # We'll just patch the DB execute completely for this logic
    mock_execute = MagicMock()
    mock_execute.execute.return_value.data = []
    
    # It's easier to patch the specific queries
    mock_supabase.table().select().eq().execute.return_value.data = []
    mock_supabase.table().insert().execute.return_value.data = [{"id": mock_uuid}]
    
    payload = {
        "phone": "+919876543210",
        "name": "Arjun Kumar",
        "city": "Bengaluru",
        "platform_affiliation": "Blinkit",
        "platform_id": "BLK-1021",
        "is_platform_verified": True,
        "dark_store_zone": "Koramangala Block 5 Blinkit",
        "avg_daily_earnings": 1200.50,
        "upi_id": "arjun@upi",
        "device_model": "Xiaomi Redmi Note 10",
        "device_os_version": "Android 13",
        "sim_carrier": "Jio",
        "sim_registration_date": "2023-01-15"
    }
    
    response = client.post("/workers/auth/register", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "hex_id" in data
    
    # Verify the JWT decrypts to the inserted user
    decoded = decode_jwt(data["access_token"])
    assert decoded["sub"] == mock_uuid
