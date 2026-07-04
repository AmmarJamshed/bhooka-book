"""JWT authentication and security utilities."""

from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings

security = HTTPBearer(auto_error=False)
settings = get_settings()


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    """Decode and validate a Supabase JWT access token."""
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication not configured",
        )
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    """Extract user ID from JWT; returns None for anonymous requests."""
    if credentials is None:
        return None
    payload = decode_supabase_jwt(credentials.credentials)
    user_id: str | None = payload.get("sub")
    return user_id


async def require_auth(user_id: str | None = Depends(get_current_user_id)) -> str:
    """Require authenticated user."""
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user_id
