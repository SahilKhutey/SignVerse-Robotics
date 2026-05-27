import jwt
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

SECRET_KEY = "SIGNVERSE_ENTERPRISE_SECURE_KEY"
ALGORITHM = "HS256"

class SecurityEngine:
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        logger.info(f"Generated JWT token for entity: {data.get('sub', 'unknown')}")
        return encoded_jwt

    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Authentication failed: Token expired")
            raise Exception("Token expired")
        except jwt.InvalidTokenError:
            logger.warning("Authentication failed: Invalid token")
            raise Exception("Invalid token")
