from collections.abc import Awaitable, Callable
from typing import Annotated, cast

from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dagent.api.errors import PermissionDeniedError
from dagent.config import get_settings
from dagent.db.session import get_session
from dagent.models import RevokedToken, User
from dagent.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    credentials_error = HTTPException(status_code=401, detail="Invalid or expired access token")
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        tenant_id = int(payload["tenant_id"])
        jti = str(payload["jti"])
    except (JWTError, KeyError, TypeError, ValueError) as exc:
        raise credentials_error from exc

    if await session.get(RevokedToken, jti) is not None:
        raise credentials_error
    user = await session.scalar(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id, User.status == "active")
    )
    if user is None:
        raise credentials_error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*allowed_roles: str) -> Callable[..., Awaitable[User]]:
    async def check_role(user: CurrentUser) -> User:
        if "admin" not in user.roles and not set(user.roles).intersection(allowed_roles):
            raise PermissionDeniedError(f"Required role: {', '.join(allowed_roles)}")
        return user

    return check_role


def get_trace_id(request: Request) -> str:
    return cast(str, request.state.trace_id)


TraceId = Annotated[str, Depends(get_trace_id)]


async def verify_agent_callback_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected = f"Bearer {get_settings().AGENT_CALLBACK_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid agent callback token")
