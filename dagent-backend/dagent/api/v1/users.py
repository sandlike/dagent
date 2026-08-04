from fastapi import APIRouter
from sqlalchemy import select

from dagent.api.deps import CurrentUser, SessionDep
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.domain import UserRead
from dagent.models import User

router = APIRouter()


@router.get("", response_model=ApiResponse[list[UserRead]])
async def list_users(user: CurrentUser, session: SessionDep) -> ApiResponse[list[UserRead]]:
    users = list(
        (
            await session.scalars(
                select(User).where(User.tenant_id == user.tenant_id, User.status == "active").order_by(User.username)
            )
        ).all()
    )
    return ApiResponse(data=[UserRead.model_validate(item) for item in users])
