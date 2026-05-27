import jwt

class JWTValidator:
    def __init__(self, secret: str = "super-secret-key-for-sprint1"):
        self.secret = secret

    def verify(self, token: str) -> dict:
        try:
            # For sprint 1, decoding without full signature verification if needed for mocks
            # In production, this validates against Keycloak public keys
            payload = jwt.decode(token, self.secret, algorithms=["HS256"], options={"verify_signature": False})
            return payload
        except jwt.ExpiredSignatureError:
            print("[JWTValidator] Token expired")
            return None
        except Exception as e:
            print(f"[JWTValidator] Invalid token: {e}")
            return None
