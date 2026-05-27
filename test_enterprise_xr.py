import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Add auth-service to path
sys.path.append("services/auth-service")

try:
    from src.auth.jwt_validator import SecurityEngine
    from src.rbac.engine import RBACEngine
except ImportError as e:
    print(f"Error importing Auth modules: {e}")
    sys.exit(1)

def run_verification():
    print("==========================================")
    print(" VERIFYING ENTERPRISE SECURITY & RBAC")
    print("==========================================")
    
    # 1. JWT Generation and Verification
    print("\\n[1] Testing JWT Zero-Trust Tokens...")
    token = SecurityEngine.create_access_token({"sub": "edge_drone_01", "role": "edge_node"})
    print(f"    - Generated Token (truncated): {token[:40]}...")
    
    payload = SecurityEngine.verify_token(token)
    print(f"    - Verified Token Payload: {payload}")
    
    # 2. RBAC Enforcement
    print("\\n[2] Testing RBAC Scope Enforcement...")
    
    # Edge Node trying to write telemetry
    allowed = RBACEngine.check_permission("edge_node", "write:telemetry")
    print(f"    - Edge Node write:telemetry -> {'GRANTED' if allowed else 'DENIED'}")
    
    # Edge Node trying to read datasets
    allowed = RBACEngine.check_permission("edge_node", "read:datasets")
    print(f"    - Edge Node read:datasets -> {'GRANTED' if allowed else 'DENIED'}")
    
    # Admin trying to do anything
    allowed = RBACEngine.check_permission("admin", "delete:everything")
    print(f"    - Admin delete:everything -> {'GRANTED' if allowed else 'DENIED'}")
    
    print("==========================================")
    print(" SECURITY PIPELINE VERIFICATION COMPLETE.")
    print("==========================================")

if __name__ == "__main__":
    run_verification()
