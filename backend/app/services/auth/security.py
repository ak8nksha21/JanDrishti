import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import jwt
from app.config import settings

logger = logging.getLogger("jandrishti.auth.security")


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt.
    Never stores plaintext passwords in the database.
    """
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hashed password.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception as exc:
        logger.warning(f"Password verification error: {exc}")
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token for establishing user identity.
    """
    to_encode = data.copy()
    expire_minutes = expires_delta or timedelta(minutes=settings.AUTH_ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expire_minutes
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    })
    encoded_jwt = jwt.encode(
        to_encode,
        settings.AUTH_SECRET_KEY,
        algorithm=settings.AUTH_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.
    Returns decoded payload dictionary if valid, or None if invalid/expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.AUTH_SECRET_KEY,
            algorithms=[settings.AUTH_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT token signature expired.")
        return None
    except jwt.PyJWTError as exc:
        logger.debug(f"JWT decode error: {exc}")
        return None
    except Exception as exc:
        logger.warning(f"Unexpected token verification error: {exc}")
        return None
