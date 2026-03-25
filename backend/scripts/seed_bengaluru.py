import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.services.spatial import seed_hex_zones

if __name__ == "__main__":
    print("Seeding Bengaluru Hex Zones...")
    # Center of Bengaluru with a 15km radius bounds
    seed_hex_zones("Bengaluru", 12.9716, 77.5946, 15.0)
