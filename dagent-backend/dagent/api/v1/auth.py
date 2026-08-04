from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select

from dagent.api.deps import CurrentUser, SessionDep, oauth2_scheme
from dagent.api.errors import DagentError
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.domain import LoginRequest, LoginResponse, UserRead
from dagent.models import RevokedToken, User
from dagent.security import create_access_token, decode_access_token, verify_password

router = APIRouter()


@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(payload: LoginRequest, session: SessionDep) -> ApiResponse[LoginResponse]:
    user = await session.scalar(select(User).where(User.username == payload.username, User.status == "active"))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise DagentError(401, 40101, "Invalid username or password")
    token, expires_at, _ = create_access_token(user.id, user.tenant_id, user.roles)
    return ApiResponse(
        data=LoginResponse(
            access_token=token,
            expires_at=expires_at,
            user=UserRead.model_validate(user),
        )
    )


@router.get("/me", response_model=ApiResponse[UserRead])
async def me(user: CurrentUser) -> ApiResponse[UserRead]:
    return ApiResponse(data=UserRead.model_validate(user))


@router.post("/logout", response_model=ApiResponse[dict[str, bool]])
async def logout(
    user: CurrentUser,
    session: SessionDep,
    token: str = Depends(oauth2_scheme),
) -> ApiResponse[dict[str, bool]]:
    payload = decode_access_token(token)
    expires_at = datetime.fromtimestamp(float(payload["exp"]), tz=UTC)
    session.add(RevokedToken(jti=str(payload["jti"]), expires_at=expires_at))
    await session.commit()
    return ApiResponse(data={"logged_out": True})
