from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from dagent.api.deps import CurrentUser, SessionDep, require_roles
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.platform import AuditLogRead
from dagent.models import AuditLog

router = APIRouter(dependencies=[Depends(require_roles("admin"))])


@router.get("/audit-logs", response_model=ApiResponse[list[AuditLogRead]])
async def list_audit_logs(
    user: CurrentUser,
    session: SessionDep,
    action: str | None = None,
    resource_type: str | None = None,
    trace_id: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> ApiResponse[list[AuditLogRead]]:
    query = select(AuditLog).where(AuditLog.tenant_id == user.tenant_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if trace_id:
        query = query.where(AuditLog.trace_id == trace_id)
    if created_from:
        query = query.where(AuditLog.created_at >= created_from)
    if created_to:
        query = query.where(AuditLog.created_at <= created_to)
    items = list((await session.scalars(query.order_by(AuditLog.id.desc()).limit(limit))).all())
    return ApiResponse(data=[AuditLogRead.model_validate(item) for item in items])
