import logging
from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth.security import decode_access_token

logger = logging.getLogger("jandrishti.auth.deps")


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Extracts the authenticated user if a valid Bearer token is provided.
    
    IMPORTANT: This dependency NEVER raises an HTTPException or 401.
    If the request has no token or an invalid token, it returns None.
    This preserves completely unrestricted public access for guests across all JanDrishti APIs.
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return None

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user:
            # Attach to request state for convenient downstream or middleware access
            request.state.user = user
            request.state.user_id = user.id
            request.state.user_email = user.email
        return user
    except Exception as exc:
        logger.debug(f"Could not resolve user for token sub={user_id}: {exc}")
        return None


def get_current_user(
    user: Optional[User] = Depends(get_optional_current_user)
) -> User:
    """
    Strict dependency used ONLY for authentication endpoints (e.g. GET /auth/me)
    where a user is explicitly querying or modifying their personal profile.
    
    DO NOT use this on any public data or analytics endpoint.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing, invalid, or expired.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user
