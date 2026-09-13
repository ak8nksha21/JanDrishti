import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.services.auth.security import decode_access_token

logger = logging.getLogger("jandrishti.middleware.auth")


class OptionalAuthMiddleware(BaseHTTPMiddleware):
    """
    Optional Authentication Middleware.
    
    CRITICAL BEHAVIOR:
    - Extracts user identity if a valid Bearer token is present and attaches it to `request.state.user`.
    - If NO token is provided, or the token is invalid/expired, `request.state.user` is set to None.
    - NEVER rejects requests with a 401 Unauthorized error.
    - All JanDrishti public routes remain accessible to guests without restriction.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request.state.user = None
        request.state.user_id = None
        request.state.user_email = None

        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
                payload = decode_access_token(token)
                if payload and "sub" in payload:
                    request.state.user = payload
                    request.state.user_id = payload.get("sub")
                    request.state.user_email = payload.get("email")

        response = await call_next(request)
        return response
