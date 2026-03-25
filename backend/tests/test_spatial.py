import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.services.spatial import (
    lat_lng_to_hex, get_hex_centroid, 
    get_hex_neighbors, get_hex_boundary_wkt
)

def test_spatial_grid():
    lat, lng = 12.9716, 77.5946 # Bengaluru
    
    # 1. Test lat_lng_to_hex
    hex_id = lat_lng_to_hex(lat, lng, 9)
    print(f"Bengaluru Center Hex: {hex_id}")
    assert isinstance(hex_id, str), "hex_id must be a string"
    
    # 2. Test get_hex_centroid
    c_lat, c_lng = get_hex_centroid(hex_id)
    print(f"Centroid: {c_lat}, {c_lng}")
    assert isinstance(c_lat, float) and isinstance(c_lng, float), "centroid must be floats"
    
    # 3. Test get_hex_neighbors
    neighbors = get_hex_neighbors(hex_id, k_rings=1)
    print(f"Neighbors count: {len(neighbors)}")
    assert len(neighbors) == 7, "k_ring=1 should return 7 cells"
    
    # 4. Test get_hex_boundary_wkt
    wkt = get_hex_boundary_wkt(hex_id)
    print(f"Boundary WKT (first 50 chars): {wkt[:50]}...")
    assert wkt.startswith("POLYGON"), "WKT must be a POLYGON"

if __name__ == "__main__":
    test_spatial_grid()
    print("\n✅ All spatial tests passed!")
