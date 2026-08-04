from dagent.models import Repository
from dagent.services.workspaces import WorkspaceManagerClient


async def verify_repository(repository: Repository, timeout_seconds: float = 180.0) -> dict[str, object]:
    return await WorkspaceManagerClient().verify(repository, timeout=timeout_seconds)
