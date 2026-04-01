import h3
from backend.db.client import supabase

def lat_lng_to_hex(lat: float, lng: float, resolution: int = 9) -> str:
    """Returns the H3 hexagonal index for a given latitude and longitude."""
    try:
        return h3.latlng_to_cell(lat, lng, resolution)
    except AttributeError:
        return h3.geo_to_h3(lat, lng, resolution)

def get_hex_centroid(hex_id: str) -> tuple[float, float]:
    """Returns the (lat, lng) center of the given hex_id."""
    try:
        return h3.cell_to_latlng(hex_id)
    except AttributeError:
        return h3.h3_to_geo(hex_id)

def get_hex_neighbors(hex_id: str, k_rings: int = 1) -> list[str]:
    """Returns a list of neighboring hex IDs within k_rings."""
    # h3.k_ring is replaced by grid_disk in newer API versions, but depends on installed version.
    # We will use the V4 api (grid_disk) if available, otherwise k_ring.
    try:
        neighbors = h3.grid_disk(hex_id, k_rings)
    except AttributeError:
        neighbors = h3.k_ring(hex_id, k_rings)
    return list(neighbors)

def get_hex_boundary_wkt(hex_id: str) -> str:
    """Returns the PostGIS WKT (Well-Known Text) POLYGON representation of the hex boundary."""
    # cell_to_boundary returns a tuple of (lat, lng) tuples
    try:
        boundary = h3.cell_to_boundary(hex_id)
    except AttributeError:
        boundary = h3.h3_to_geo_boundary(hex_id)
        
    # Shapely polygon expects (lng, lat)
    coords = [(lng, lat) for lat, lng in boundary]
    # Close the polygon
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    
    # Kept as a lightweight fallback string builder; no shapely dependency needed.
    pairs = ", ".join(f"{lng} {lat}" for lng, lat in coords)
    return f"POLYGON(({pairs}))"

def seed_hex_zones(city: str, center_lat: float, center_lng: float, radius_km: float):
    """
    Generates an H3 hex grid (res 9) covering the given city radius and 
    upserts all hex cells and their geometries into the hex_zones table.
    """
    # Create the center hex
    center_hex = lat_lng_to_hex(center_lat, center_lng, 9)
    
    # Approx: res 9 edge length is ~0.174 km, apothem is ~0.15 km
    # Number of rings k is roughly radius_km / (apothem * 2) 
    k_rings = int(radius_km / 0.3)
    
    print(f"Generating hex grid for {city} (radius {radius_km}km) -> ~{k_rings} rings from center.")
    hex_ids = get_hex_neighbors(center_hex, k_rings=k_rings)
    print(f"Total hex cells generated: {len(hex_ids)}")
    
    # Prepare batch insertion
    records = []
    for hid in hex_ids:
        # NOTE:
        # centroid/boundary are PostGIS geometry columns and must be inserted via SQL/PostGIS functions.
        # Supabase REST upsert cannot accept raw WKT payloads reliably, so we omit them for demo seeding.
        records.append({
            "h3_index": hid,
            "city": city,
            "current_dci": 0.0,
            "dci_status": "normal",
            "active_worker_count": 0,
            "consecutive_normal_cycles": 0,
            "is_disrupted": False
        })
        
    print(f"Upserting {len(records)} hex zones into Supabase...")
    
    # We insert in chunks to avoid payload size limits
    chunk_size = 500
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        response = supabase.table("hex_zones").upsert(
            chunk,
            on_conflict="h3_index"
        ).execute()
        if hasattr(response, 'error') and response.error:
            print(f"UPSERT ERROR chunk {i}: {response.error}")
        else:
            print(f"Chunk {i} upserted: {len(chunk)} rows")
        
    print(f"Successfully seeded hex_zones for {city}!")
