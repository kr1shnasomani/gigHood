import sys
from client import supabase

def verify_tables():
    # Attempt to query each of the 10 tables to verify they exist and are accessible
    tables = [
        "workers", "hex_zones", "policies", "signal_cache", "dci_history",
        "location_pings", "disruption_events", "claims", "fraud_flags", "premium_payments"
    ]
    
    success = True
    print("Running Supabase Smoke Test...")
    
    for table in tables:
        try:
            # A simple select limit 1 validates that the API recognizes the table
            res = supabase.table(table).select("*").limit(1).execute()
            print(f"✅ Table '{table}' verified.")
        except Exception as e:
            print(f"❌ Failed to access '{table}': {e}")
            success = False
            
    if success:
        print("\nAll 10 tables are successfully live and accessible via the API!")
        sys.exit(0)
    else:
        print("\nSmoke test failed. Some tables are missing.")
        sys.exit(1)

if __name__ == "__main__":
    verify_tables()
