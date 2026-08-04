from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from dagent.config import get_settings

password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return str(password_context.hash(password))


def verify_password(password: str, password_hash: str) -> bool:
    return bool(password_context.verify(password, password_hash))


def create_access_token(user_id: int, tenant_id: int, roles: list[str]) -> tuple[str, datetime, str]:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = uuid4().hex
    payload = {
        "sub": str(user_id),
        "tenant_id": tenant_id,
        "roles": roles,
        "jti": jti,
        "iat": datetime.now(UTC),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at, jti


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return cast(
        dict[str, Any],
        jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]),
    )


__all__ = [
    "JWTError",
    "create_access_token",
    "decode_access_token",
    "hash_password",
    "verify_password",
]
