from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from dagent.models import AuditLog


def add_audit_log(
    session: AsyncSession,
    *,
    tenant_id: int,
    actor_id: int | None,
    action: str,
    resource_type: str,
    resource_id: int | str,
    trace_id: str,
    details: dict[str, Any] | None = None,
    actor_type: str = "user",
) -> None:
    session.add(
        AuditLog(
            tenant_id=tenant_id,
            actor_id=actor_id,
            actor_type=actor_type,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            details=details or {},
            trace_id=trace_id,
        )
    )
